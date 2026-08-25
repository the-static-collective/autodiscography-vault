import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ingestCensusScrollSegments } from '../packages/census-scroll-ingest/index.js';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function observation(id, round, index) {
  return {
    schema: 'autodiscography-vault-observation/v1',
    provider: 'suno',
    observedAt: `2026-08-25T04:00:0${round}.000Z`,
    source: {
      kind: 'ordinary_signed_in_dom',
      locator: `suno-library-scroll:scroll-run-1:round:${round}:candidate:${index}`,
      adapter: 'suno-library-auto-scroll/v1',
      surface: 'library_card',
    },
    payload: {
      providerTrackId: id,
      providerFutureField: { round, index, meaning: 'unknown' },
    },
    evidence: {
      providerTrackId: { state: 'observed', pointer: '/providerTrackId' },
      providerCreatedAtRaw: { state: 'not_observed', reasonCode: 'field_not_inspected_on_library_card' },
      stylePromptRaw: { state: 'not_observed', reasonCode: 'field_not_inspected_on_library_card' },
      lyricsTextRaw: { state: 'not_observed', reasonCode: 'field_not_inspected_on_library_card' },
      lyricGenerationPromptRaw: { state: 'not_observed', reasonCode: 'field_not_inspected_on_library_card' },
      parentProviderTrackId: { state: 'not_observed', reasonCode: 'field_not_inspected_on_library_card' },
      audioWav: { state: 'not_observed', reasonCode: 'field_not_inspected_on_library_card' },
    },
  };
}

function segment({ round, ids, seenStableIds, emittedCount, status = 'running' }) {
  const observedAt = `2026-08-25T04:00:0${round}.000Z`;
  return {
    schema: 'autodiscography-vault-census-scroll-segment/v1',
    version: 1,
    runId: 'scroll-run-1',
    round,
    observedAt,
    status,
    observations: ids.map((id, index) => observation(id, round, index + 1)),
    checkpoint: {
      schema: 'autodiscography-vault-census-scroll-checkpoint/v1',
      version: 1,
      runId: 'scroll-run-1',
      configuration: { stableRoundsRequired: 3, bottomTolerance: 1 },
      round,
      seenStableIds,
      emittedCount,
      scrollMetrics: {
        scrollTop: status === 'ui_exhausted' ? 4000 : round * 640,
        viewportHeight: 800,
        scrollHeight: 4800,
        atBottom: status === 'ui_exhausted',
        stableRounds: status === 'ui_exhausted' ? 3 : 0,
      },
      status,
      updatedAt: observedAt,
    },
  };
}

async function fixture(name) {
  const root = await mkdtemp(join(tmpdir(), `autodiscography-${name}-`));
  const segmentsDir = join(root, 'segments');
  const vaultRoot = join(root, 'vault');
  await mkdir(segmentsDir, { recursive: true });
  return { root, segmentsDir, vaultRoot };
}

async function writeSegments(segmentsDir, values) {
  const written = [];
  for (const value of values) {
    const path = join(segmentsDir, `round-${String(value.round).padStart(6, '0')}.json`);
    const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
    await writeFile(path, bytes);
    written.push({ path, bytes, sha256: sha256(bytes) });
  }
  return written;
}

test('scroll segments enter Census v1 without losing exact segment bytes, repeats, drift, or negative space', async () => {
  const { segmentsDir, vaultRoot } = await fixture('scroll-ingest');
  const written = await writeSegments(segmentsDir, [
    segment({ round: 1, ids: ['track-a', 'track-b'], seenStableIds: ['track-a', 'track-b'], emittedCount: 2 }),
    segment({ round: 2, ids: ['track-b', 'track-c'], seenStableIds: ['track-a', 'track-b', 'track-c'], emittedCount: 4 }),
    segment({ round: 3, ids: [], seenStableIds: ['track-a', 'track-b', 'track-c'], emittedCount: 4, status: 'ui_exhausted' }),
  ]);

  await assert.rejects(
    () => ingestCensusScrollSegments({
      segmentsDir,
      vaultRoot,
      checkpointEvery: 2,
      onCheckpoint(progress) {
        if (progress.processedRecords === 2) throw new Error('simulated assembly ingest crash');
      },
    }),
    /simulated assembly ingest crash/,
  );

  const result = await ingestCensusScrollSegments({ segmentsDir, vaultRoot, checkpointEvery: 2 });
  assert.equal(result.resumedFromRecords, 2);
  assert.equal(result.processedRecords, 4);
  assert.equal(result.captureStatus, 'ui_exhausted');
  assert.equal(result.uiExhausted, true);
  assert.equal('providerComplete' in result, false);
  assert.equal(result.segmentRecords.length, 3);

  for (let index = 0; index < written.length; index += 1) {
    assert.equal(result.segmentRecords[index].sha256, written[index].sha256);
    assert.deepEqual(await readFile(result.segmentRecords[index].rawPath), written[index].bytes);
    assert.deepEqual(await readFile(written[index].path), written[index].bytes,
      'source segment must remain untouched');
  }

  const rawLines = (await readFile(result.rawPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(rawLines.map(value => value.payload.providerTrackId), [
    'track-a',
    'track-b',
    'track-b',
    'track-c',
  ], 're-observation is raw history and must not be deduplicated out of the pack');
  assert.deepEqual(rawLines[2].payload.providerFutureField, {
    round: 2,
    index: 1,
    meaning: 'unknown',
  });
  assert.deepEqual(rawLines[2].evidence.stylePromptRaw, {
    state: 'not_observed',
    reasonCode: 'field_not_inspected_on_library_card',
  });

  const repeated = await ingestCensusScrollSegments({ segmentsDir, vaultRoot, checkpointEvery: 2 });
  assert.equal(repeated.skippedExisting, true);
  assert.equal(repeated.rawSourceSha256, result.rawSourceSha256);
  assert.equal(repeated.segmentManifestSha256, result.segmentManifestSha256);
  assert.equal((await readdir(join(vaultRoot, 'raw', 'observations'))).length, 1);
  assert.equal((await readdir(join(vaultRoot, 'raw', 'census-scroll-segments'))).length, 3);
});

test('segment lineage gaps and checkpoint rewrites fail before any raw segment admission', async () => {
  const { segmentsDir, vaultRoot } = await fixture('scroll-lineage-refusal');
  await writeSegments(segmentsDir, [
    segment({ round: 1, ids: ['track-a'], seenStableIds: ['track-a'], emittedCount: 1 }),
    segment({ round: 3, ids: [], seenStableIds: [], emittedCount: 1, status: 'ui_exhausted' }),
  ]);

  await assert.rejects(
    () => ingestCensusScrollSegments({ segmentsDir, vaultRoot }),
    /contiguous|lineage|seen stable IDs/i,
  );
  await assert.rejects(
    () => readdir(join(vaultRoot, 'raw', 'census-scroll-segments')),
    error => error?.code === 'ENOENT',
  );
});
