import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ingestCensusPack } from '../packages/census-ingest/index.js';

function observation(index, overrides = {}) {
  return {
    schema: 'autodiscography-vault-observation/v1',
    provider: 'suno',
    observedAt: '2026-08-24T21:30:00.000Z',
    source: {
      kind: 'provider_export',
      locator: `synthetic-page:${Math.floor(index / 50)}`,
    },
    payload: {
      id: `track-${String(index).padStart(5, '0')}`,
      created_at: '2024-02-03T04:05:06.000Z',
      style: `style-${index}`,
      lyrics: `lyrics-${index}`,
      unknown_future_field: { sequence: index },
    },
    evidence: {
      providerTrackId: { state: 'observed', pointer: '/id' },
      providerCreatedAtRaw: { state: 'observed', pointer: '/created_at' },
      stylePromptRaw: { state: 'observed', pointer: '/style' },
      lyricsTextRaw: { state: 'observed', pointer: '/lyrics' },
      lyricGenerationPromptRaw: {
        state: 'not_exposed',
        reasonCode: 'not_exposed_on_surface',
      },
      parentProviderTrackId: {
        state: 'not_observed',
        reasonCode: 'not_observed_on_surface',
      },
      audioWav: {
        state: 'artifact_known_bytes_unavailable',
        reasonCode: 'bytes_not_acquired',
      },
    },
    ...overrides,
  };
}

function packBytes(observations) {
  return Buffer.from(`${observations.map(value => JSON.stringify(value)).join('\n')}\n`, 'utf8');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fixture(name = 'census') {
  const root = await mkdtemp(join(tmpdir(), `autodiscography-${name}-`));
  const vaultRoot = join(root, 'vault');
  const inputPath = join(root, 'observations.ndjson');
  await mkdir(vaultRoot, { recursive: true });
  return { root, vaultRoot, inputPath };
}

test('crash halfway through 20k observations resumes without duplicates or raw mutation', { timeout: 120_000 }, async () => {
  const { vaultRoot, inputPath } = await fixture('census-20k');
  const bytes = packBytes(Array.from({ length: 20_000 }, (_, index) => observation(index)));
  await writeFile(inputPath, bytes);
  const sourceSha256 = sha256(bytes);

  await assert.rejects(
    () => ingestCensusPack({
      inputPath,
      vaultRoot,
      checkpointEvery: 500,
      onCheckpoint(progress) {
        if (progress.processedRecords === 10_000) throw new Error('simulated process crash');
      },
    }),
    /simulated process crash/,
  );

  const rawPath = join(vaultRoot, 'raw', 'observations', `${sourceSha256}.ndjson`);
  const partialPath = join(vaultRoot, 'normalized', 'census-v1', `${sourceSha256}.ndjson.partial`);
  assert.deepEqual(await readFile(rawPath), bytes, 'raw source must be fully preserved before normalization completes');

  // Model a crash after another projection line reached disk but before its
  // checkpoint. Restart must truncate disposable projection bytes back to the
  // durable checkpoint rather than duplicating them.
  await appendFile(partialPath, `${JSON.stringify({ crashTail: true })}\n`);

  const resumed = await ingestCensusPack({
    inputPath,
    vaultRoot,
    checkpointEvery: 500,
  });
  assert.equal(resumed.resumedFromRecords, 10_000);
  assert.equal(resumed.processedRecords, 20_000);
  assert.equal(resumed.skippedExisting, false);

  const normalizedText = await readFile(resumed.normalizedPath, 'utf8');
  const records = normalizedText.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records.length, 20_000);
  assert.equal(new Set(records.map(record => record.fields.providerTrackId.value)).size, 20_000);
  assert.equal(records.some(record => record.crashTail), false);
  assert.deepEqual(await readFile(rawPath), bytes, 'restart must not rewrite immutable raw evidence');

  const normalizedIdentity = sha256(Buffer.from(normalizedText));
  const third = await ingestCensusPack({ inputPath, vaultRoot, checkpointEvery: 500 });
  assert.equal(third.skippedExisting, true);
  assert.equal(third.processedRecords, 20_000);
  assert.equal(sha256(await readFile(third.normalizedPath)), normalizedIdentity);
  assert.deepEqual(await readFile(rawPath), bytes);
});

test('provider field drift creates new immutable history and yesterday remains byte-exact', async () => {
  const { root, vaultRoot } = await fixture('census-drift');
  const firstPath = join(root, 'first.ndjson');
  const secondPath = join(root, 'second.ndjson');
  const firstObservation = observation(1, {
    payload: {
      id: 'track-stable',
      created_at: '2024-01-01T00:00:00.000Z',
      style: 'old style',
      lyrics: 'old lyrics',
      provider_field_removed_tomorrow: 'keep me exactly',
    },
  });
  const secondObservation = observation(1, {
    observedAt: '2026-08-25T21:30:00.000Z',
    payload: {
      id: 'track-stable',
      created_at: '2024-01-01T00:00:00.000Z',
      style: 'changed style',
      lyrics: 'old lyrics',
      brand_new_unknown_field: { providerMeaning: 'unknown' },
    },
  });
  const firstBytes = packBytes([firstObservation]);
  const secondBytes = packBytes([secondObservation]);
  await writeFile(firstPath, firstBytes);
  await writeFile(secondPath, secondBytes);

  const first = await ingestCensusPack({ inputPath: firstPath, vaultRoot });
  const second = await ingestCensusPack({ inputPath: secondPath, vaultRoot });

  assert.notEqual(first.rawSourceSha256, second.rawSourceSha256);
  assert.deepEqual(await readFile(first.rawPath), firstBytes);
  assert.deepEqual(await readFile(second.rawPath), secondBytes);
  assert.equal((await readFile(first.rawPath, 'utf8')).includes('provider_field_removed_tomorrow'), true);
  assert.equal((await readFile(second.rawPath, 'utf8')).includes('brand_new_unknown_field'), true);

  const rawFiles = (await readdir(join(vaultRoot, 'raw', 'observations')))
    .filter(name => name.endsWith('.ndjson'));
  assert.equal(rawFiles.length, 2);
});

test('later missing parent, prompt, and artifact remain typed absence without carry-forward', async () => {
  const { vaultRoot, inputPath } = await fixture('census-negative-space');
  const earlier = observation(1, {
    payload: {
      id: 'track-negative-space',
      created_at: '2024-01-01T00:00:00.000Z',
      style: 'once observed',
      lyrics: 'still observed',
      lyric_prompt: 'once available',
      parent_id: 'parent-once-visible',
    },
    evidence: {
      ...observation(1).evidence,
      lyricGenerationPromptRaw: { state: 'observed', pointer: '/lyric_prompt' },
      parentProviderTrackId: { state: 'observed', pointer: '/parent_id' },
    },
  });
  const later = observation(1, {
    observedAt: '2026-08-25T21:30:00.000Z',
    payload: {
      id: 'track-negative-space',
      created_at: '2024-01-01T00:00:00.000Z',
      lyrics: 'still observed',
    },
    evidence: {
      providerTrackId: { state: 'observed', pointer: '/id' },
      providerCreatedAtRaw: { state: 'observed', pointer: '/created_at' },
      stylePromptRaw: {
        state: 'historically_observed_now_missing',
        reasonCode: 'provider_no_longer_exposes_field',
      },
      lyricsTextRaw: { state: 'observed', pointer: '/lyrics' },
      lyricGenerationPromptRaw: {
        state: 'historically_observed_now_missing',
        reasonCode: 'provider_no_longer_exposes_field',
      },
      parentProviderTrackId: {
        state: 'not_observed',
        reasonCode: 'not_observed_on_surface',
      },
      audioWav: {
        state: 'artifact_known_bytes_unavailable',
        reasonCode: 'bytes_not_acquired',
      },
    },
  });
  await writeFile(inputPath, packBytes([earlier, later]));

  const result = await ingestCensusPack({ inputPath, vaultRoot });
  const normalized = (await readFile(result.normalizedPath, 'utf8'))
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));

  assert.equal(normalized[0].fields.lyricGenerationPromptRaw.value, 'once available');
  assert.equal(normalized[0].fields.parentProviderTrackId.value, 'parent-once-visible');
  assert.deepEqual(normalized[1].fields.lyricGenerationPromptRaw, {
    state: 'historically_observed_now_missing',
    reasonCode: 'provider_no_longer_exposes_field',
  });
  assert.deepEqual(normalized[1].fields.parentProviderTrackId, {
    state: 'not_observed',
    reasonCode: 'not_observed_on_surface',
  });
  assert.deepEqual(normalized[1].artifacts.audioWav, {
    state: 'artifact_known_bytes_unavailable',
    reasonCode: 'bytes_not_acquired',
  });
  assert.equal(JSON.stringify(normalized[1]).includes('once available'), false);
  assert.equal(JSON.stringify(normalized[1]).includes('parent-once-visible'), false);
  assert.equal('rootAncestor' in normalized[1], false);
});

test('credential-bearing durable fields are refused before raw admission', async () => {
  const { vaultRoot, inputPath } = await fixture('census-secret');
  const unsafe = observation(1, {
    payload: {
      id: 'track-secret',
      created_at: '2024-01-01T00:00:00.000Z',
      style: 'style',
      lyrics: 'lyrics',
      authorization: 'Bearer do-not-persist',
    },
  });
  await writeFile(inputPath, packBytes([unsafe]));

  await assert.rejects(
    () => ingestCensusPack({ inputPath, vaultRoot }),
    /durable credential field refused/,
  );
  const rawDir = join(vaultRoot, 'raw', 'observations');
  await assert.rejects(() => readdir(rawDir), error => error?.code === 'ENOENT');
});
