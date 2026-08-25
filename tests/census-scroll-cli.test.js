import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);

function segment(round, { observations = [], stableRounds = 0, status = 'running' } = {}) {
  const observedAt = `2026-08-25T04:00:0${round}.000Z`;
  const seenStableIds = observations.length ? ['track-cli'] : ['track-cli'];
  const emittedCount = observations.length ? 1 : 1;
  return {
    schema: 'autodiscography-vault-census-scroll-segment/v1',
    version: 1,
    runId: 'cli-run',
    round,
    observedAt,
    status,
    observations,
    checkpoint: {
      schema: 'autodiscography-vault-census-scroll-checkpoint/v1',
      version: 1,
      runId: 'cli-run',
      configuration: { stableRoundsRequired: 3, bottomTolerance: 1 },
      round,
      seenStableIds,
      emittedCount,
      scrollMetrics: {
        scrollTop: 0,
        viewportHeight: 800,
        scrollHeight: 800,
        atBottom: true,
        stableRounds,
      },
      status,
      updatedAt: observedAt,
    },
  };
}

function terminalSegments() {
  const observedAt = '2026-08-25T04:00:01.000Z';
  const observation = {
    schema: 'autodiscography-vault-observation/v1',
    provider: 'suno',
    observedAt,
    source: {
      kind: 'ordinary_signed_in_dom',
      locator: 'suno-library-scroll:cli-run:round:1:candidate:1',
      adapter: 'suno-library-auto-scroll/v1',
      surface: 'library_card',
    },
    payload: { providerTrackId: 'track-cli' },
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
  return [
    segment(1, { observations: [observation] }),
    segment(2, { stableRounds: 1 }),
    segment(3, { stableRounds: 2 }),
    segment(4, { stableRounds: 3, status: 'ui_exhausted' }),
  ];
}

test('scroll-ingest CLI preserves segments and reports UI exhaustion without a completeness claim', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autodiscography-scroll-cli-'));
  const segmentsDir = join(root, 'segments');
  const vaultRoot = join(root, 'vault');
  await mkdir(segmentsDir, { recursive: true });
  const sourceSegments = terminalSegments();
  const sourceBytes = [];
  for (const sourceSegment of sourceSegments) {
    const bytes = Buffer.from(`${JSON.stringify(sourceSegment)}\n`);
    sourceBytes.push(bytes);
    await writeFile(
      join(segmentsDir, `round-${String(sourceSegment.round).padStart(6, '0')}.json`),
      bytes,
    );
  }

  const args = [
    'scripts/ingest-census-scroll.js',
    '--segments', segmentsDir,
    '--vault-root', vaultRoot,
    '--checkpoint-every', '1',
  ];
  const first = await run(process.execPath, args, { cwd: process.cwd() });
  const firstResult = JSON.parse(first.stdout);
  assert.equal(firstResult.processedRecords, 1);
  assert.equal(firstResult.captureStatus, 'ui_exhausted');
  assert.equal(firstResult.uiExhausted, true);
  assert.equal('providerComplete' in firstResult, false);
  assert.equal(firstResult.layers.raw.segments.count, 4);
  assert.equal(firstResult.layers.derived.status, 'not_built');
  assert.deepEqual(await readFile(firstResult.segmentRecords[0].rawPath), sourceBytes[0]);

  const second = await run(process.execPath, args, { cwd: process.cwd() });
  assert.equal(JSON.parse(second.stdout).skippedExisting, true);
});
