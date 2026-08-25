import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);

function observation() {
  return {
    schema: 'autodiscography-vault-observation/v1',
    provider: 'suno',
    observedAt: '2026-08-24T21:30:00.000Z',
    source: {
      kind: 'provider_export',
      locator: 'synthetic-cli',
      adapter: 'synthetic-provider-export/v1',
      surface: 'provider_export',
    },
    payload: {
      id: 'track-cli',
      created_at: '2024-01-01T00:00:00.000Z',
      style: 'exact style',
      lyrics: 'exact lyrics',
    },
    evidence: {
      providerTrackId: { state: 'observed', pointer: '/id' },
      providerCreatedAtRaw: { state: 'observed', pointer: '/created_at' },
      stylePromptRaw: { state: 'observed', pointer: '/style' },
      lyricsTextRaw: { state: 'observed', pointer: '/lyrics' },
      lyricGenerationPromptRaw: { state: 'not_exposed', reasonCode: 'not_exposed_on_surface' },
      parentProviderTrackId: { state: 'not_observed', reasonCode: 'not_observed_on_surface' },
      audioWav: { state: 'artifact_known_bytes_unavailable', reasonCode: 'bytes_not_acquired' },
    },
  };
}

test('census CLI admits a raw pack and reports an idempotent second run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autodiscography-census-cli-'));
  const inputPath = join(root, 'input.ndjson');
  const vaultRoot = join(root, 'vault');
  await writeFile(inputPath, `${JSON.stringify(observation())}\n`);

  const args = [
    'scripts/ingest-census.js',
    '--input', inputPath,
    '--vault-root', vaultRoot,
    '--checkpoint-every', '1',
  ];
  const first = await run(process.execPath, args, { cwd: process.cwd() });
  const firstResult = JSON.parse(first.stdout);
  assert.equal(firstResult.processedRecords, 1);
  assert.equal(firstResult.skippedExisting, false);
  assert.equal(firstResult.layers.raw.sha256, firstResult.rawSourceSha256);
  assert.equal(firstResult.layers.normalized.normalizer, 'census-v1');
  assert.equal(firstResult.layers.derived.status, 'not_built');
  assert.equal((await readFile(firstResult.rawPath, 'utf8')).includes('exact style'), true);

  const second = await run(process.execPath, args, { cwd: process.cwd() });
  const secondResult = JSON.parse(second.stdout);
  assert.equal(secondResult.processedRecords, 1);
  assert.equal(secondResult.skippedExisting, true);
  assert.equal(secondResult.rawSourceSha256, firstResult.rawSourceSha256);
});

test('census CLI refuses incomplete argument pairs without creating a receipt', async () => {
  await assert.rejects(
    () => run(process.execPath, ['scripts/ingest-census.js', '--input'], { cwd: process.cwd() }),
    error => {
      assert.match(error.stderr, /census:ingest refused: arguments must be --name value pairs/);
      return true;
    },
  );
});
