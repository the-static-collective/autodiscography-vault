import { createHash, randomBytes } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeCensusObservation } from '../census-contract/index.js';
import { ingestCensusPack } from '../census-ingest/index.js';
import { parseCensusScrollSegment } from '../../extension/src/sidepanel/census-scroll-segment.js';

const CHECKPOINT_KEYS = Object.freeze([
  'configuration',
  'emittedCount',
  'round',
  'runId',
  'schema',
  'scrollMetrics',
  'seenStableIds',
  'status',
  'updatedAt',
  'version',
]);
const CONFIGURATION_KEYS = Object.freeze(['bottomTolerance', 'stableRoundsRequired']);
const SCROLL_METRIC_KEYS = Object.freeze([
  'atBottom',
  'scrollHeight',
  'scrollTop',
  'stableRounds',
  'viewportHeight',
]);
const CANONICAL_UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REUSABLE_SECRET_VALUE = /\bbearer\s+[A-Za-z0-9._~+/=-]+/i;
const UTF8 = new TextDecoder('utf-8', { fatal: true });

function slashPath(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertExactKeys(value, expected, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`invalid ${name} shape`);
  }
}

function assertNonnegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid ${name}`);
}

function assertNonnegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid ${name}`);
}

function assertCanonicalUtc(value, name) {
  if (
    typeof value !== 'string'
    || !CANONICAL_UTC_ISO.test(value)
    || new Date(value).toISOString() !== value
  ) throw new Error(`${name} must be canonical UTC ISO-8601`);
}

function parseBytes(bytes, name) {
  let text;
  try {
    text = UTF8.decode(bytes);
  } catch {
    throw new Error(`${name} is not valid UTF-8`);
  }
  return parseCensusScrollSegment(text);
}

function validateCheckpoint(segment) {
  const checkpoint = segment.checkpoint;
  assertExactKeys(checkpoint, CHECKPOINT_KEYS, 'census scroll checkpoint');
  assertExactKeys(checkpoint.configuration, CONFIGURATION_KEYS, 'census scroll checkpoint configuration');
  assertExactKeys(checkpoint.scrollMetrics, SCROLL_METRIC_KEYS, 'census scroll checkpoint metrics');
  if (checkpoint.schema !== 'autodiscography-vault-census-scroll-checkpoint/v1' || checkpoint.version !== 1) {
    throw new Error('invalid census scroll checkpoint schema/version');
  }
  if (!Number.isSafeInteger(checkpoint.configuration.stableRoundsRequired)
    || checkpoint.configuration.stableRoundsRequired < 1) {
    throw new Error('invalid census scroll stable-round configuration');
  }
  assertNonnegativeFinite(checkpoint.configuration.bottomTolerance, 'census scroll bottom tolerance');
  assertNonnegativeInteger(checkpoint.round, 'census scroll checkpoint round');
  assertNonnegativeInteger(checkpoint.emittedCount, 'census scroll emitted count');
  assertCanonicalUtc(checkpoint.updatedAt, 'census scroll checkpoint timestamp');
  for (const key of ['scrollTop', 'viewportHeight', 'scrollHeight']) {
    assertNonnegativeFinite(checkpoint.scrollMetrics[key], `census scroll ${key}`);
  }
  if (typeof checkpoint.scrollMetrics.atBottom !== 'boolean') {
    throw new Error('invalid census scroll bottom state');
  }
  assertNonnegativeInteger(checkpoint.scrollMetrics.stableRounds, 'census scroll stable rounds');
  if (!Array.isArray(checkpoint.seenStableIds)) throw new Error('invalid census scroll seen stable IDs');
  const seen = new Set();
  for (const id of checkpoint.seenStableIds) {
    if (typeof id !== 'string' || !id || seen.has(id)) {
      throw new Error('invalid census scroll seen stable IDs');
    }
    seen.add(id);
  }
  if (seen.size > checkpoint.emittedCount) {
    throw new Error('census scroll seen stable IDs exceed emitted observations');
  }
  if (!['running', 'ui_exhausted'].includes(checkpoint.status)) {
    throw new Error('invalid census scroll checkpoint status');
  }
  if (
    checkpoint.status === 'ui_exhausted'
    && (
      !checkpoint.scrollMetrics.atBottom
      || checkpoint.scrollMetrics.stableRounds < checkpoint.configuration.stableRoundsRequired
    )
  ) throw new Error('invalid terminal census scroll checkpoint');
  return checkpoint;
}

function preflightObservation(value) {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  return normalizeCensusObservation(value, {
    rawSourceSha256: '0'.repeat(64),
    rawRecordSha256: sha256(bytes),
    rawRecordOffset: 0,
    rawRecordByteLength: bytes.byteLength,
  });
}

function controllerStableId(normalized) {
  const field = normalized.fields.providerTrackId;
  if (field.state !== 'observed') return null;
  const value = field.value;
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > 512
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/.test(value)
    || REUSABLE_SECRET_VALUE.test(value)
    || /^https?:\/\//i.test(value)
  ) throw new Error('invalid census scroll stable provider ID');
  return value;
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateSegmentLineage(segment, prior) {
  const checkpoint = validateCheckpoint(segment);
  assertCanonicalUtc(segment.observedAt, 'census scroll segment timestamp');
  if (checkpoint.round !== segment.round || checkpoint.updatedAt !== segment.observedAt) {
    throw new Error('census scroll segment lineage mismatch');
  }
  const stableIds = [];
  let unknownIdObservations = 0;
  for (const observation of segment.observations) {
    if (observation?.observedAt !== segment.observedAt) {
      throw new Error('census scroll observation timestamp does not match its segment');
    }
    const stableId = controllerStableId(preflightObservation(observation));
    if (stableId === null) unknownIdObservations += 1;
    else stableIds.push(stableId);
  }

  if (!prior) {
    if (segment.round !== 1) throw new Error('census scroll rounds must be contiguous from round 1');
  } else {
    if (prior.status === 'ui_exhausted') throw new Error('terminal census scroll segment must be last');
    if (segment.runId !== prior.runId || segment.round !== prior.round + 1) {
      throw new Error('census scroll rounds must have one contiguous run lineage');
    }
    if (segment.observedAt < prior.updatedAt) {
      throw new Error('census scroll timestamps must be monotonic');
    }
    if (
      checkpoint.configuration.stableRoundsRequired !== prior.configuration.stableRoundsRequired
      || checkpoint.configuration.bottomTolerance !== prior.configuration.bottomTolerance
    ) throw new Error('census scroll configuration changed within one run');
  }

  const previous = prior ?? {
    emittedCount: 0,
    seenStableIds: [],
    scrollMetrics: { scrollHeight: 0, stableRounds: 0 },
  };
  if (checkpoint.emittedCount !== previous.emittedCount + segment.observations.length) {
    throw new Error('census scroll emitted-count lineage mismatch');
  }

  const expectedSeenStableIds = [...previous.seenStableIds];
  const seen = new Set(expectedSeenStableIds);
  let newStableIds = 0;
  for (const stableId of stableIds) {
    if (seen.has(stableId)) continue;
    seen.add(stableId);
    expectedSeenStableIds.push(stableId);
    newStableIds += 1;
  }
  if (!sameStrings(checkpoint.seenStableIds, expectedSeenStableIds)) {
    throw new Error('census scroll seen stable IDs do not match controller transition');
  }

  const computedAtBottom = checkpoint.scrollMetrics.scrollTop + checkpoint.scrollMetrics.viewportHeight
    >= checkpoint.scrollMetrics.scrollHeight - checkpoint.configuration.bottomTolerance;
  if (checkpoint.scrollMetrics.atBottom !== computedAtBottom) {
    throw new Error('census scroll bottom state does not match controller transition');
  }
  const heightStable = checkpoint.scrollMetrics.scrollHeight === previous.scrollMetrics.scrollHeight;
  const stableRound = computedAtBottom
    && newStableIds === 0
    && unknownIdObservations === 0
    && heightStable;
  const expectedStableRounds = stableRound ? previous.scrollMetrics.stableRounds + 1 : 0;
  if (checkpoint.scrollMetrics.stableRounds !== expectedStableRounds) {
    throw new Error('census scroll stable rounds do not match controller transition');
  }
  const expectedStatus = expectedStableRounds >= checkpoint.configuration.stableRoundsRequired
    ? 'ui_exhausted'
    : 'running';
  if (checkpoint.status !== expectedStatus) {
    throw new Error('census scroll status does not match controller transition');
  }
  return checkpoint;
}

async function regularJsonFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('census scroll segment directory is missing');
    throw error;
  }
  const jsonEntries = entries.filter(entry => entry.name.toLowerCase().endsWith('.json'));
  if (jsonEntries.length === 0) throw new Error('census scroll segment directory has no JSON segments');
  for (const entry of jsonEntries) {
    if (!entry.isFile()) throw new Error(`census scroll segment is not a regular file: ${entry.name}`);
  }
  return jsonEntries.map(entry => join(directory, entry.name));
}

async function describeSegments(directory) {
  const sourcePaths = await regularJsonFiles(directory);
  const descriptors = [];
  for (const sourcePath of sourcePaths) {
    const bytes = await readFile(sourcePath);
    const segment = parseBytes(bytes, 'census scroll segment');
    descriptors.push({
      sourcePath,
      round: segment.round,
      sha256: sha256(bytes),
      byteLength: bytes.byteLength,
    });
  }
  descriptors.sort((left, right) => left.round - right.round || left.sourcePath.localeCompare(right.sourcePath));
  for (let index = 0; index < descriptors.length; index += 1) {
    if (descriptors[index].round !== index + 1) {
      throw new Error('census scroll rounds must be unique and contiguous from round 1');
    }
  }

  let prior = null;
  const records = [];
  for (const descriptor of descriptors) {
    const bytes = await readFile(descriptor.sourcePath);
    if (bytes.byteLength !== descriptor.byteLength || sha256(bytes) !== descriptor.sha256) {
      throw new Error('census scroll segment changed during preflight');
    }
    const segment = parseBytes(bytes, 'census scroll segment');
    const checkpoint = validateSegmentLineage(segment, prior);
    records.push({
      ...descriptor,
      runId: segment.runId,
      observedAt: segment.observedAt,
      status: segment.status,
      observationCount: segment.observations.length,
    });
    prior = checkpoint;
  }
  return records;
}

async function fileInfo(path) {
  try {
    return await stat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function commitContentAddressedBytes({ bytes, directory, extension }) {
  const identity = sha256(bytes);
  const finalPath = join(directory, `${identity}.${extension}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const existing = await fileInfo(finalPath);
  if (existing) {
    const existingBytes = await readFile(finalPath);
    if (existingBytes.byteLength !== bytes.byteLength || sha256(existingBytes) !== identity) {
      throw new Error('immutable census scroll raw identity mismatch');
    }
    return finalPath;
  }

  const partialPath = join(
    directory,
    `.${identity}.${process.pid}.${randomBytes(8).toString('hex')}.partial`,
  );
  await writeFile(partialPath, bytes, { flag: 'wx', mode: 0o600 });
  try {
    await chmod(partialPath, 0o600);
    const copied = await readFile(partialPath);
    if (copied.byteLength !== bytes.byteLength || sha256(copied) !== identity) {
      throw new Error('census scroll raw bytes changed during admission');
    }
    await rename(partialPath, finalPath);
  } finally {
    await unlink(partialPath).catch(error => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
  return finalPath;
}

async function commitSegments(descriptors, vaultRoot) {
  const directory = join(vaultRoot, 'raw', 'census-scroll-segments');
  const committed = [];
  for (const descriptor of descriptors) {
    const bytes = await readFile(descriptor.sourcePath);
    if (bytes.byteLength !== descriptor.byteLength || sha256(bytes) !== descriptor.sha256) {
      throw new Error('census scroll segment changed before admission');
    }
    const rawPath = await commitContentAddressedBytes({ bytes, directory, extension: 'json' });
    committed.push(Object.freeze({
      round: descriptor.round,
      observedAt: descriptor.observedAt,
      status: descriptor.status,
      observationCount: descriptor.observationCount,
      sha256: descriptor.sha256,
      byteLength: descriptor.byteLength,
      rawPath,
    }));
  }
  return committed;
}

async function writeAll(handle, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset);
    if (!bytesWritten) throw new Error('census scroll pack write made no progress');
    offset += bytesWritten;
  }
}

async function buildObservationPack(segmentRecords, packPath) {
  const handle = await open(packPath, 'wx', 0o600);
  let observations = 0;
  try {
    for (const record of segmentRecords) {
      const segment = parseBytes(await readFile(record.rawPath), 'admitted census scroll segment');
      for (const observation of segment.observations) {
        await writeAll(handle, Buffer.from(`${JSON.stringify(observation)}\n`, 'utf8'));
        observations += 1;
      }
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  return observations;
}

async function commitRunManifest({ vaultRoot, runId, captureStatus, segmentRecords, ingestResult }) {
  const manifest = {
    schema: 'autodiscography-vault-census-scroll-run-receipt/v1',
    version: 1,
    runId,
    captureStatus,
    uiExhausted: captureStatus === 'ui_exhausted',
    segments: segmentRecords.map(record => ({
      round: record.round,
      observedAt: record.observedAt,
      status: record.status,
      observationCount: record.observationCount,
      raw: {
        path: slashPath(relative(vaultRoot, record.rawPath)),
        sha256: record.sha256,
        byteLength: record.byteLength,
      },
    })),
    rawObservationPack: {
      path: slashPath(relative(vaultRoot, ingestResult.rawPath)),
      sha256: ingestResult.rawSourceSha256,
    },
  };
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const segmentManifestSha256 = sha256(bytes);
  const segmentManifestPath = await commitContentAddressedBytes({
    bytes,
    directory: join(vaultRoot, 'receipts', 'census-scroll-runs'),
    extension: 'json',
  });
  return { segmentManifestPath, segmentManifestSha256 };
}

export async function ingestCensusScrollSegments({
  segmentsDir,
  vaultRoot,
  checkpointEvery = 250,
  onCheckpoint,
} = {}) {
  if (!segmentsDir) throw new Error('segmentsDir is required');
  if (!vaultRoot) throw new Error('vaultRoot is required');
  if (!Number.isSafeInteger(checkpointEvery) || checkpointEvery < 1) {
    throw new Error('checkpointEvery must be a positive integer');
  }
  const resolvedSegments = resolve(String(segmentsDir));
  const resolvedVault = resolve(String(vaultRoot));
  const descriptors = await describeSegments(resolvedSegments);
  const segmentRecords = await commitSegments(descriptors, resolvedVault);
  const runId = descriptors[0].runId;
  const captureStatus = descriptors.at(-1).status;
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'autodiscography-census-scroll-pack-'));
  const packPath = join(temporaryDirectory, 'observations.ndjson');
  try {
    const observationCount = await buildObservationPack(segmentRecords, packPath);
    const ingestResult = await ingestCensusPack({
      inputPath: packPath,
      vaultRoot: resolvedVault,
      checkpointEvery,
      onCheckpoint,
      allowEmpty: true,
    });
    if (ingestResult.processedRecords !== observationCount) {
      throw new Error('census scroll observation-pack count mismatch');
    }
    const manifest = await commitRunManifest({
      vaultRoot: resolvedVault,
      runId,
      captureStatus,
      segmentRecords,
      ingestResult,
    });
    return Object.freeze({
      ...ingestResult,
      runId,
      captureStatus,
      uiExhausted: captureStatus === 'ui_exhausted',
      segmentRecords: Object.freeze(segmentRecords),
      ...manifest,
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
