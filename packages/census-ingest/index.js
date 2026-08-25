import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  copyFile,
  chmod,
  link,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  truncate,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {
  assertDurableObservationSafe,
  normalizeCensusObservation,
} from '../census-contract/index.js';

const NORMALIZER = 'census-v1';
const SHA256_HEX = /^[a-f0-9]{64}$/;

function slashPath(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function verifyFileStreaming(path) {
  const hash = createHash('sha256');
  let byteLength = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    byteLength += chunk.byteLength;
  }
  return Object.freeze({ byteLength, sha256: hash.digest('hex') });
}

async function fileInfo(path) {
  try {
    return await stat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function assertRegularFile(path, name) {
  const info = await fileInfo(path);
  if (!info) throw new Error(`${name} is missing`);
  if (!info.isFile()) throw new Error(`${name} is not a file`);
  return info;
}

async function* readNdjsonRecords(path, startOffset = 0) {
  let carry = Buffer.alloc(0);
  let recordOffset = startOffset;
  const stream = createReadStream(path, { start: startOffset });

  for await (const chunk of stream) {
    const bytes = carry.length ? Buffer.concat([carry, chunk]) : Buffer.from(chunk);
    let cursor = 0;
    let newline;
    while ((newline = bytes.indexOf(0x0a, cursor)) !== -1) {
      const recordBytes = Buffer.from(bytes.subarray(cursor, newline));
      if (recordBytes.length === 0) throw new Error(`raw observation at byte ${recordOffset} is blank`);
      const nextOffset = recordOffset + recordBytes.length + 1;
      yield Object.freeze({
        bytes: recordBytes,
        offset: recordOffset,
        byteLength: recordBytes.length,
        nextOffset,
      });
      recordOffset = nextOffset;
      cursor = newline + 1;
    }
    carry = Buffer.from(bytes.subarray(cursor));
  }

  if (carry.length) {
    yield Object.freeze({
      bytes: carry,
      offset: recordOffset,
      byteLength: carry.length,
      nextOffset: recordOffset + carry.length,
    });
  }
}

function parseRecord(record) {
  try {
    return JSON.parse(record.bytes.toString('utf8'));
  } catch {
    throw new Error(`raw observation at byte ${record.offset} is invalid JSON`);
  }
}

async function preflightDurableSafety(path) {
  let records = 0;
  for await (const record of readNdjsonRecords(path)) {
    assertDurableObservationSafe(parseRecord(record));
    records += 1;
  }
  if (records === 0) throw new Error('raw observation pack is empty');
  return records;
}

async function commitRawSource({ inputPath, vaultRoot, identity }) {
  const rawDir = join(vaultRoot, 'raw', 'observations');
  const rawPath = join(rawDir, `${identity.sha256}.ndjson`);
  await mkdir(rawDir, { recursive: true, mode: 0o700 });

  const existing = await fileInfo(rawPath);
  if (existing) {
    const actual = await verifyFileStreaming(rawPath);
    if (actual.byteLength !== identity.byteLength || actual.sha256 !== identity.sha256) {
      throw new Error('immutable raw observation identity mismatch');
    }
    return rawPath;
  }

  const suffix = randomBytes(8).toString('hex');
  const partialPath = join(rawDir, `.${identity.sha256}.${process.pid}.${suffix}.partial`);
  await copyFile(inputPath, partialPath);
  try {
    await chmod(partialPath, 0o600);
    const copied = await verifyFileStreaming(partialPath);
    if (copied.byteLength !== identity.byteLength || copied.sha256 !== identity.sha256) {
      throw new Error('raw observation changed during admission');
    }
    try {
      await link(partialPath, rawPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const concurrent = await verifyFileStreaming(rawPath);
      if (concurrent.byteLength !== identity.byteLength || concurrent.sha256 !== identity.sha256) {
        throw new Error('immutable raw observation identity mismatch');
      }
    }
  } finally {
    await unlink(partialPath).catch(error => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
  return rawPath;
}

function initialCheckpoint(rawIdentity) {
  return {
    schema: 'autodiscography-vault-census-checkpoint/v1',
    normalizer: NORMALIZER,
    rawSourceSha256: rawIdentity.sha256,
    rawSourceByteLength: rawIdentity.byteLength,
    rawOffset: 0,
    outputByteLength: 0,
    processedRecords: 0,
    status: 'normalizing',
  };
}

function validateCheckpoint(value, rawIdentity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid census checkpoint');
  if (value.schema !== 'autodiscography-vault-census-checkpoint/v1') throw new Error('invalid census checkpoint schema');
  if (value.normalizer !== NORMALIZER) throw new Error('census checkpoint normalizer mismatch');
  if (
    value.rawSourceSha256 !== rawIdentity.sha256
    || value.rawSourceByteLength !== rawIdentity.byteLength
  ) {
    throw new Error('census checkpoint raw identity mismatch');
  }
  for (const key of ['rawOffset', 'outputByteLength', 'processedRecords']) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) throw new Error(`invalid census checkpoint ${key}`);
  }
  if (value.rawOffset > rawIdentity.byteLength) throw new Error('census checkpoint offset exceeds raw source');
  if (!['normalizing', 'complete'].includes(value.status)) throw new Error('invalid census checkpoint status');
  return { ...value };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new Error(`invalid JSON file: ${basename(path)}`);
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const partialPath = `${path}.${process.pid}.partial`;
  await writeFile(partialPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(partialPath, path);
}

async function writeAll(handle, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset);
    if (!bytesWritten) throw new Error('normalized projection write made no progress');
    offset += bytesWritten;
  }
}

function pathsFor(vaultRoot, sourceSha256) {
  const normalizedDir = join(vaultRoot, 'normalized', NORMALIZER);
  const stateDir = join(vaultRoot, 'state', NORMALIZER);
  const receiptDir = join(vaultRoot, 'receipts', NORMALIZER);
  const normalizedPath = join(normalizedDir, `${sourceSha256}.ndjson`);
  return Object.freeze({
    normalizedDir,
    normalizedPath,
    partialPath: `${normalizedPath}.partial`,
    checkpointPath: join(stateDir, `${sourceSha256}.json`),
    receiptPath: join(receiptDir, `${sourceSha256}.json`),
  });
}

function validateReceipt(receipt, rawIdentity) {
  if (!receipt || typeof receipt !== 'object') throw new Error('invalid census receipt');
  if (receipt.schema !== 'autodiscography-vault-census-receipt/v1') throw new Error('invalid census receipt schema');
  if (receipt.normalizer !== NORMALIZER) throw new Error('census receipt normalizer mismatch');
  if (
    receipt.raw?.sha256 !== rawIdentity.sha256
    || receipt.raw?.byteLength !== rawIdentity.byteLength
    || !SHA256_HEX.test(receipt.normalized?.sha256 ?? '')
    || !Number.isSafeInteger(receipt.normalized?.byteLength)
    || !Number.isSafeInteger(receipt.processedRecords)
  ) {
    throw new Error('invalid census receipt identity');
  }
  return receipt;
}

async function completedResult({ receipt, rawPath, paths, resumedFromRecords, skippedExisting }) {
  const normalizedIdentity = await verifyFileStreaming(paths.normalizedPath);
  if (
    normalizedIdentity.sha256 !== receipt.normalized.sha256
    || normalizedIdentity.byteLength !== receipt.normalized.byteLength
  ) {
    throw new Error('normalized census receipt mismatch');
  }
  return Object.freeze({
    skippedExisting,
    resumedFromRecords,
    processedRecords: receipt.processedRecords,
    rawSourceSha256: receipt.raw.sha256,
    rawPath,
    normalizedPath: paths.normalizedPath,
    checkpointPath: paths.checkpointPath,
    receiptPath: paths.receiptPath,
  });
}

async function finalizeFromCheckpoint({ vaultRoot, rawIdentity, rawPath, paths, checkpoint }) {
  const normalizedIdentity = await verifyFileStreaming(paths.normalizedPath);
  if (normalizedIdentity.byteLength !== checkpoint.outputByteLength) {
    throw new Error('completed normalized projection length mismatch');
  }
  const receipt = {
    schema: 'autodiscography-vault-census-receipt/v1',
    normalizer: NORMALIZER,
    processedRecords: checkpoint.processedRecords,
    raw: {
      path: slashPath(relative(vaultRoot, rawPath)),
      sha256: rawIdentity.sha256,
      byteLength: rawIdentity.byteLength,
    },
    normalized: {
      path: slashPath(relative(vaultRoot, paths.normalizedPath)),
      sha256: normalizedIdentity.sha256,
      byteLength: normalizedIdentity.byteLength,
    },
  };
  await writeJsonAtomic(paths.receiptPath, receipt);
  await writeJsonAtomic(paths.checkpointPath, { ...checkpoint, status: 'complete' });
  return receipt;
}

export async function ingestCensusPack({
  inputPath,
  vaultRoot,
  checkpointEvery = 250,
  onCheckpoint,
} = {}) {
  const resolvedInput = resolve(String(inputPath ?? ''));
  const resolvedVault = resolve(String(vaultRoot ?? ''));
  if (!inputPath) throw new Error('inputPath is required');
  if (!vaultRoot) throw new Error('vaultRoot is required');
  if (!Number.isSafeInteger(checkpointEvery) || checkpointEvery < 1) {
    throw new Error('checkpointEvery must be a positive integer');
  }
  await assertRegularFile(resolvedInput, 'census input');

  const inputIdentity = await verifyFileStreaming(resolvedInput);
  await preflightDurableSafety(resolvedInput);
  const rawPath = await commitRawSource({
    inputPath: resolvedInput,
    vaultRoot: resolvedVault,
    identity: inputIdentity,
  });
  const rawIdentity = await verifyFileStreaming(rawPath);
  if (rawIdentity.sha256 !== inputIdentity.sha256 || rawIdentity.byteLength !== inputIdentity.byteLength) {
    throw new Error('immutable raw observation identity mismatch');
  }

  const paths = pathsFor(resolvedVault, rawIdentity.sha256);
  const existingReceiptValue = await readJson(paths.receiptPath);
  if (existingReceiptValue) {
    const receipt = validateReceipt(existingReceiptValue, rawIdentity);
    return completedResult({
      receipt,
      rawPath,
      paths,
      resumedFromRecords: receipt.processedRecords,
      skippedExisting: true,
    });
  }

  await mkdir(paths.normalizedDir, { recursive: true, mode: 0o700 });
  let checkpointValue = await readJson(paths.checkpointPath);
  let checkpoint = checkpointValue
    ? validateCheckpoint(checkpointValue, rawIdentity)
    : initialCheckpoint(rawIdentity);
  const resumedFromRecords = checkpoint.processedRecords;

  const finalInfo = await fileInfo(paths.normalizedPath);
  if (finalInfo) {
    if (checkpoint.rawOffset !== rawIdentity.byteLength) {
      throw new Error('normalized final exists before raw source was fully projected');
    }
    const receipt = await finalizeFromCheckpoint({
      vaultRoot: resolvedVault,
      rawIdentity,
      rawPath,
      paths,
      checkpoint,
    });
    return completedResult({
      receipt,
      rawPath,
      paths,
      resumedFromRecords,
      skippedExisting: false,
    });
  }

  const partialInfo = await fileInfo(paths.partialPath);
  if (!partialInfo) {
    if (checkpoint.outputByteLength !== 0) {
      checkpoint = initialCheckpoint(rawIdentity);
      await writeJsonAtomic(paths.checkpointPath, checkpoint);
    }
    await writeFile(paths.partialPath, '', { flag: 'wx', mode: 0o600 });
  } else if (partialInfo.size < checkpoint.outputByteLength) {
    checkpoint = initialCheckpoint(rawIdentity);
    await truncate(paths.partialPath, 0);
    await writeJsonAtomic(paths.checkpointPath, checkpoint);
  } else if (partialInfo.size > checkpoint.outputByteLength) {
    await truncate(paths.partialPath, checkpoint.outputByteLength);
  }

  const handle = await open(paths.partialPath, 'a', 0o600);
  let sinceCheckpoint = 0;
  try {
    for await (const record of readNdjsonRecords(rawPath, checkpoint.rawOffset)) {
      const parsed = parseRecord(record);
      const normalized = normalizeCensusObservation(parsed, {
        rawSourceSha256: rawIdentity.sha256,
        rawRecordSha256: sha256(record.bytes),
        rawRecordOffset: record.offset,
        rawRecordByteLength: record.byteLength,
      });
      const output = Buffer.from(`${JSON.stringify(normalized)}\n`, 'utf8');
      await writeAll(handle, output);
      checkpoint.rawOffset = record.nextOffset;
      checkpoint.outputByteLength += output.byteLength;
      checkpoint.processedRecords += 1;
      sinceCheckpoint += 1;

      if (sinceCheckpoint >= checkpointEvery) {
        await handle.sync();
        await writeJsonAtomic(paths.checkpointPath, checkpoint);
        sinceCheckpoint = 0;
        if (onCheckpoint) await onCheckpoint(Object.freeze({ ...checkpoint }));
      }
    }

    await handle.sync();
    await writeJsonAtomic(paths.checkpointPath, checkpoint);
    if (sinceCheckpoint > 0 && onCheckpoint) await onCheckpoint(Object.freeze({ ...checkpoint }));
  } finally {
    await handle.close();
  }

  if (checkpoint.rawOffset !== rawIdentity.byteLength) {
    throw new Error('census normalization stopped before raw source EOF');
  }
  const partialIdentity = await verifyFileStreaming(paths.partialPath);
  if (partialIdentity.byteLength !== checkpoint.outputByteLength) {
    throw new Error('normalized projection checkpoint mismatch');
  }
  await rename(paths.partialPath, paths.normalizedPath);
  const receipt = await finalizeFromCheckpoint({
    vaultRoot: resolvedVault,
    rawIdentity,
    rawPath,
    paths,
    checkpoint,
  });
  return completedResult({
    receipt,
    rawPath,
    paths,
    resumedFromRecords,
    skippedExisting: false,
  });
}
