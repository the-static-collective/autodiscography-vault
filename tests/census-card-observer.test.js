import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizeCensusObservation } from '../packages/census-contract/index.js';

function loadCardObserver() {
  const url = new URL('../extension/src/provider/suno/census-card-observer.js', import.meta.url);
  const source = readFileSync(url, 'utf8');
  const context = { URL };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'census-card-observer.js' });
  return context.AutodiscographyVaultSunoCensusCardObserver;
}

const provenance = Object.freeze({
  rawSourceSha256: 'a'.repeat(64),
  rawRecordSha256: 'b'.repeat(64),
  rawRecordOffset: 0,
  rawRecordByteLength: 512,
});

test('library-card adapter preserves population identity and types every uninspected detail field', () => {
  const adapter = loadCardObserver();
  const results = adapter.buildCardCandidates({
    runId: 'scroll-run-001',
    round: 7,
    observedAt: '2026-08-25T04:00:00.000Z',
    candidates: [{
      providerTrackId: 'track-exact-id',
      title: 'bounded pilot title must not impersonate exact raw text',
      sourceUrl: 'https://suno.com/song/track-exact-id?utm_source=ui#player',
      observedAssets: [{
        transportUrl: 'https://cdn.example.test/file.wav?X-Amz-Signature=never-durable',
      }],
    }],
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].stableProviderId, 'track-exact-id');
  assert.deepEqual(JSON.parse(JSON.stringify(results[0].observation.source)), {
    kind: 'ordinary_signed_in_dom',
    locator: 'suno-library-scroll:scroll-run-001:round:7:candidate:1',
    adapter: 'suno-library-auto-scroll/v1',
    surface: 'library_card',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(results[0].observation.payload)), {
    providerTrackId: 'track-exact-id',
    sourcePath: '/song/track-exact-id',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(results[0].observation.evidence.providerTrackId)), {
    state: 'observed',
    pointer: '/providerTrackId',
  });
  for (const field of [
    'providerCreatedAtRaw',
    'stylePromptRaw',
    'lyricsTextRaw',
    'lyricGenerationPromptRaw',
    'parentProviderTrackId',
    'audioWav',
  ]) {
    assert.deepEqual(JSON.parse(JSON.stringify(results[0].observation.evidence[field])), {
      state: 'not_observed',
      reasonCode: 'field_not_inspected_on_library_card',
    });
  }

  const serialized = JSON.stringify(results[0]);
  assert.equal(serialized.includes('bounded pilot title'), false);
  assert.equal(serialized.includes('never-durable'), false);
  assert.equal(serialized.includes('transportUrl'), false);
  assert.equal(serialized.includes('not_exposed'), false);

  const normalized = normalizeCensusObservation(results[0].observation, provenance);
  assert.equal(normalized.fields.providerTrackId.value, 'track-exact-id');
  assert.equal(normalized.fields.stylePromptRaw.state, 'not_observed');
  assert.equal(normalized.source.adapter, 'suno-library-auto-scroll/v1');
});

test('unknown identity remains a separate typed observation without root or fabricated null', () => {
  const adapter = loadCardObserver();
  const [first, second] = adapter.buildCardCandidates({
    runId: 'scroll-run-unknown',
    round: 1,
    observedAt: '2026-08-25T04:00:00.000Z',
    candidates: [
      { providerTrackId: null, sourceUrl: 'https://suno.com/library' },
      { providerTrackId: null, sourceUrl: 'https://suno.com/library' },
    ],
  });

  assert.equal(first.stableProviderId, null);
  assert.equal(second.stableProviderId, null);
  assert.notEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first.observation.evidence.providerTrackId)), {
    state: 'not_observed',
    reasonCode: 'stable_id_not_observed_on_library_card',
  });
  assert.equal('providerTrackId' in first.observation.payload, false);
  assert.equal(JSON.stringify(first).includes('root'), false);
  assert.equal(JSON.stringify(first).includes('known_null'), false);
});

test('card adapter fails closed on unsafe identity and malformed run provenance', () => {
  const adapter = loadCardObserver();
  const base = {
    runId: 'scroll-run-safe',
    round: 1,
    observedAt: '2026-08-25T04:00:00.000Z',
    candidates: [],
  };
  assert.throws(
    () => adapter.buildCardCandidates({ ...base, runId: ' https://bad.test/?token=x ' }),
    /invalid census scroll run ID/,
  );
  assert.throws(
    () => adapter.buildCardCandidates({ ...base, observedAt: '2026-08-25T04:00:00Z' }),
    /canonical UTC/,
  );
  assert.throws(
    () => adapter.buildCardCandidates({
      ...base,
      candidates: [{ providerTrackId: 'Bearer reusable-secret', sourceUrl: 'https://suno.com/library' }],
    }),
    /unsafe provider track identity/,
  );
});

test('card observer has no network, storage, download, or session primitive', () => {
  const source = readFileSync(
    new URL('../extension/src/provider/suno/census-card-observer.js', import.meta.url),
    'utf8',
  );
  for (const forbidden of [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /chrome\./,
    /document\./,
    /localStorage/,
    /sessionStorage/,
    /transportUrl\s*:/,
  ]) {
    assert.equal(forbidden.test(source), false, `card observer must not contain ${forbidden}`);
  }
});
