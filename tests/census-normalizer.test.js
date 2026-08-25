import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
    },
    payload: {
      id: 'track-alpha',
      created_at: '2024-02-03 04:05:06+00:00',
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

  assert.deepEqual(normalized.fields.providerTrackId, {
    state: 'observed',
    value: 'track-alpha',
    sourcePointer: '/id',
  });
  assert.deepEqual(normalized.fields.providerCreatedAtRaw, {
    state: 'observed',
    value: '2024-02-03 04:05:06+00:00',
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
      providerCreatedAtRaw: { state: 'observed', pointer: '/created_at' },
      stylePromptRaw: {
        state: 'historically_observed_now_missing',
        reasonCode: 'provider_no_longer_exposes_field',
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
