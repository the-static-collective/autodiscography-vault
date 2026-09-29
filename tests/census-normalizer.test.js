import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDurableObservationSafe,
  FIELD_STATES,
  normalizeCensusObservation,
} from '../packages/census-contract/index.js';

const provenance = Object.freeze({
  rawSourceSha256: 'a'.repeat(64),
  rawRecordSha256: 'b'.repeat(64),
  rawRecordOffset: 17,
  rawRecordByteLength: 991,
});

function observation(overrides = {}) {
  return {
    schema: 'autodiscography-vault-observation/v1',
    provider: 'suno',
    observedAt: '2026-08-24T21:30:00.000Z',
    source: {
      kind: 'provider_export',
      locator: 'suno-export:page-1',
      adapter: 'synthetic-provider-export/v1',
      surface: 'provider_export',
    },
    payload: {
      id: 'track-alpha',
      created_at: '2024-02-03T04:05:06+00:00',
      metadata: {
        style_prompt: '  glitch-hop, Φ³\nNO smoothing; [raw]  ',
        lyrics: '[Verse 1]\nExact  spacing\n\n✠ keep punctuation.',
      },
      future_provider_field: {
        meaning_unknown: true,
      },
    },
    evidence: {
      providerTrackId: { state: 'observed', pointer: '/id' },
      providerCreatedAtRaw: { state: 'observed', pointer: '/created_at' },
      stylePromptRaw: { state: 'observed', pointer: '/metadata/style_prompt' },
      lyricsTextRaw: { state: 'observed', pointer: '/metadata/lyrics' },
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

test('exact provider prompt provenance remains distinct from normalization and observation time', () => {
  const input = observation();
  const normalized = normalizeCensusObservation(input, provenance);

  assert.equal(normalized.schema, 'autodiscography-vault-normalized-observation/v1');
  assert.equal(normalized.normalizer, 'census-v1');
  assert.equal(normalized.observedAt, '2026-08-24T21:30:00.000Z');
  assert.deepEqual(normalized.rawProvenance, provenance);
  assert.deepEqual(normalized.source, {
    kind: 'provider_export',
    locator: 'suno-export:page-1',
    adapter: 'synthetic-provider-export/v1',
    surface: 'provider_export',
  });

  assert.deepEqual(normalized.fields.providerTrackId, {
    state: 'observed',
    value: 'track-alpha',
    sourcePointer: '/id',
  });
  assert.deepEqual(normalized.fields.providerCreatedAtRaw, {
    state: 'observed',
    value: '2024-02-03T04:05:06+00:00',
    sourcePointer: '/created_at',
  });
  assert.deepEqual(normalized.fields.providerCreatedAtNormalized, {
    state: 'derived',
    value: '2024-02-03T04:05:06.000Z',
    derivedFrom: 'providerCreatedAtRaw',
  });
  assert.notEqual(
    normalized.fields.providerCreatedAtNormalized.value,
    normalized.observedAt,
    'provider creation time must never be substituted with observedAt',
  );
  assert.equal(normalized.fields.stylePromptRaw.value, input.payload.metadata.style_prompt);
  assert.equal(normalized.fields.lyricsTextRaw.value, input.payload.metadata.lyrics);
  assert.deepEqual(normalized.fields.lyricGenerationPromptRaw, {
    state: 'not_exposed',
    reasonCode: 'not_exposed_on_surface',
  });
  assert.deepEqual(normalized.fields.parentProviderTrackId, {
    state: 'not_observed',
    reasonCode: 'not_observed_on_surface',
  });
  assert.deepEqual(normalized.artifacts.audioWav, {
    state: 'artifact_known_bytes_unavailable',
    reasonCode: 'bytes_not_acquired',
  });
  assert.deepEqual(normalized.unmappedTopLevelPointers, ['/future_provider_field']);
  assert.equal('rootAncestor' in normalized, false);
  assert.equal('interpretation' in normalized, false);
});

test('typed negative space is required and is never helpfully completed', () => {
  const historicallyMissing = observation({
    payload: {
      id: 'track-alpha',
      created_at: null,
    },
    evidence: {
      providerTrackId: { state: 'observed', pointer: '/id' },
      providerCreatedAtRaw: { state: 'known_null', pointer: '/created_at' },
      stylePromptRaw: {
        state: 'historically_observed_now_missing',
        reasonCode: 'provider_no_longer_exposes_field',
        priorRawRecordSha256: 'c'.repeat(64),
      },
      lyricsTextRaw: { state: 'known_null', pointer: '/created_at' },
      lyricGenerationPromptRaw: {
        state: 'unavailable',
        reasonCode: 'provider_surface_unavailable',
      },
      parentProviderTrackId: {
        state: 'not_observed',
        reasonCode: 'not_observed_on_surface',
      },
      audioWav: {
        state: 'failed_to_fetch',
        reasonCode: 'download_failed',
      },
    },
  });

  const normalized = normalizeCensusObservation(historicallyMissing, provenance);
  assert.deepEqual(normalized.fields.stylePromptRaw, {
    state: 'historically_observed_now_missing',
    reasonCode: 'provider_no_longer_exposes_field',
    priorRawRecordSha256: 'c'.repeat(64),
  });
  assert.equal('value' in normalized.fields.stylePromptRaw, false);
  assert.deepEqual(normalized.fields.providerCreatedAtRaw, {
    state: 'known_null',
    sourcePointer: '/created_at',
  });
  assert.deepEqual(normalized.fields.providerCreatedAtNormalized, {
    state: 'known_null',
    derivedFrom: 'providerCreatedAtRaw',
  });
  assert.equal('value' in normalized.fields.parentProviderTrackId, false);
  assert.equal('rootAncestor' in normalized, false);
});

test('missing evidence does not silently become not-observed', () => {
  const input = observation();
  delete input.evidence.lyricGenerationPromptRaw;
  assert.throws(
    () => normalizeCensusObservation(input, provenance),
    /missing evidence state: lyricGenerationPromptRaw/,
  );
});

test('capture provenance requires a versioned adapter and explicit surface profile', () => {
  const missingAdapter = observation();
  delete missingAdapter.source.adapter;
  assert.throws(
    () => normalizeCensusObservation(missingAdapter, provenance),
    /missing source.adapter/,
  );

  const missingSurface = observation();
  delete missingSurface.source.surface;
  assert.throws(
    () => normalizeCensusObservation(missingSurface, provenance),
    /missing source.surface/,
  );

  const unversioned = observation();
  unversioned.source.adapter = 'helpful-guesser';
  assert.throws(
    () => normalizeCensusObservation(unversioned, provenance),
    /source.adapter must be explicitly versioned/,
  );
});

test('observed evidence must resolve exactly and normalization failure stays explicit', () => {
  const input = observation({
    payload: {
      id: 'track-alpha',
      created_at: 'not a timestamp',
      metadata: { style_prompt: '', lyrics: '' },
    },
  });
  const normalized = normalizeCensusObservation(input, provenance);
  assert.deepEqual(normalized.fields.providerCreatedAtNormalized, {
    state: 'normalization_failed',
    reasonCode: 'invalid_provider_created_at',
    derivedFrom: 'providerCreatedAtRaw',
  });

  input.evidence.stylePromptRaw.pointer = '/metadata/missing';
  assert.throws(
    () => normalizeCensusObservation(input, provenance),
    /observed pointer does not resolve: stylePromptRaw/,
  );
});

test('provider creation normalization accepts only valid explicit-offset RFC3339 timestamps', () => {
  const valid = observation({
    payload: {
      ...observation().payload,
      created_at: '2024-02-03T04:05:06.123+05:30',
    },
  });
  assert.deepEqual(
    normalizeCensusObservation(valid, provenance).fields.providerCreatedAtNormalized,
    {
      state: 'derived',
      value: '2024-02-02T22:35:06.123Z',
      derivedFrom: 'providerCreatedAtRaw',
    },
  );

  for (const raw of [
    '03/04/2024',
    '2024-02-03 04:05:06',
    '2024-02-03T04:05:06',
    '2024-02-03T04:05:06-00:00',
    '2024-02-31T00:00:00Z',
    'yesterday',
  ]) {
    const input = observation({
      payload: { ...observation().payload, created_at: raw },
    });
    assert.deepEqual(
      normalizeCensusObservation(input, provenance).fields.providerCreatedAtNormalized,
      {
        state: 'normalization_failed',
        reasonCode: 'invalid_provider_created_at',
        derivedFrom: 'providerCreatedAtRaw',
      },
      `must refuse ambiguous or invalid provider timestamp ${raw}`,
    );
  }
});

test('pointer evidence cannot smuggle values, collapse null, or alias distinct prompt fields', () => {
  const inline = observation();
  inline.evidence.stylePromptRaw.value = 'helpful replacement';
  assert.throws(
    () => normalizeCensusObservation(inline, provenance),
    /pointer evidence cannot carry inline value: stylePromptRaw/,
  );

  const observedNull = observation({
    payload: { ...observation().payload, created_at: null },
  });
  assert.throws(
    () => normalizeCensusObservation(observedNull, provenance),
    /observed pointer resolved null: providerCreatedAtRaw/,
  );

  const aliased = observation();
  aliased.evidence.lyricGenerationPromptRaw = {
    state: 'observed',
    pointer: '/metadata/lyrics',
  };
  assert.throws(
    () => normalizeCensusObservation(aliased, provenance),
    /distinct exact-text fields cannot share a source pointer/,
  );
});

test('exact prompt and lyrics evidence must resolve to strings without truncation or coercion', () => {
  const input = observation({
    payload: {
      ...observation().payload,
      metadata: { style_prompt: 42, lyrics: { text: 'not the exact field' } },
    },
  });
  assert.throws(
    () => normalizeCensusObservation(input, provenance),
    /stylePromptRaw observed value must be a string/,
  );

  input.payload.metadata.style_prompt = 'exact';
  assert.throws(
    () => normalizeCensusObservation(input, provenance),
    /lyricsTextRaw observed value must be a string/,
  );
});

test('historically missing evidence requires exact prior raw-record lineage', () => {
  const input = observation();
  input.evidence.stylePromptRaw = {
    state: 'historically_observed_now_missing',
    reasonCode: 'provider_no_longer_exposes_field',
  };
  assert.throws(
    () => normalizeCensusObservation(input, provenance),
    /historically missing evidence requires priorRawRecordSha256: stylePromptRaw/,
  );
});

test('durable safety refuses credential aliases, bearer values, and signed URL dialects', () => {
  for (const key of [
    'authorization',
    'proxyAuthorization',
    'cookie',
    'setCookie',
    'accessToken',
    'refreshToken',
    'authToken',
    'session',
    'sessionId',
    'sessionToken',
    'password',
    'passwd',
    'secret',
    'credential',
    'credentials',
    'apiKey',
    'authHeader',
    'csrfToken',
    'idToken',
    'jwt',
    'authorizationHeader',
  ]) {
    assert.throws(
      () => assertDurableObservationSafe({ payload: { [key]: 'opaque' } }),
      /durable credential field refused/,
      `must refuse credential-shaped field ${key}`,
    );
  }

  assert.throws(
    () => assertDurableObservationSafe({ payload: { note: 'Bearer abc.def.ghi' } }),
    /durable credential value refused/,
  );

  for (const url of [
    'https://cdn.example.test/object?sig=secret',
    'https://cdn.example.test/object?X-Goog-Signature=secret',
    'https://cdn.example.test/object?Expires=9999999999&Key-Pair-Id=K123',
  ]) {
    assert.throws(
      () => assertDurableObservationSafe({ payload: { source: url } }),
      /durable capability URL refused/,
      `must refuse capability URL ${url}`,
    );
  }
});

test('field-state vocabulary keeps materially different absences distinct', () => {
  for (const required of [
    'observed',
    'known_null',
    'not_observed',
    'not_exposed',
    'unavailable',
    'refused',
    'failed_to_fetch',
    'artifact_known_bytes_unavailable',
    'historically_observed_now_missing',
    'derived',
    'normalization_failed',
  ]) {
    assert.equal(FIELD_STATES.includes(required), true, `missing field state ${required}`);
  }
});
