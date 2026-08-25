import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCensusScrollSegment,
  parseCensusScrollSegment,
  serializeCensusScrollSegment,
} from '../extension/src/sidepanel/census-scroll-segment.js';

function roundResult() {
  return {
    schema: 'autodiscography-vault-census-scroll-round/v1',
    version: 1,
    runId: 'scroll-run-1',
    round: 3,
    observedAt: '2026-08-25T04:00:03.000Z',
    status: 'running',
    observations: [{
      schema: 'autodiscography-vault-observation/v1',
      provider: 'suno',
      observedAt: '2026-08-25T04:00:03.000Z',
      source: {
        kind: 'ordinary_signed_in_dom',
        locator: 'suno-library-scroll:scroll-run-1:round:3:candidate:1',
        adapter: 'suno-library-auto-scroll/v1',
        surface: 'library_card',
      },
      payload: { providerTrackId: 'track-3' },
      evidence: {},
    }],
    derived: {
      newStableIds: ['track-3'],
      alreadySeenStableIdObservationIndexes: [],
      unknownIdObservationIndexes: [],
      scrollHeightGrew: true,
    },
    action: { kind: 'scroll_to', scrollTop: 4800 },
    checkpoint: {
      schema: 'autodiscography-vault-census-scroll-checkpoint/v1',
      version: 1,
      runId: 'scroll-run-1',
      configuration: { stableRoundsRequired: 3, bottomTolerance: 1 },
      round: 3,
      seenStableIds: ['track-1', 'track-2', 'track-3'],
      emittedCount: 3,
      scrollMetrics: {
        scrollTop: 4000,
        viewportHeight: 800,
        scrollHeight: 4800,
        atBottom: true,
        stableRounds: 0,
      },
      status: 'running',
      updatedAt: '2026-08-25T04:00:03.000Z',
    },
  };
}

test('one immutable segment carries raw round evidence and its exact resume checkpoint together', () => {
  const input = roundResult();
  const segment = buildCensusScrollSegment(input);
  assert.equal(segment.schema, 'autodiscography-vault-census-scroll-segment/v1');
  assert.equal(segment.runId, 'scroll-run-1');
  assert.equal(segment.round, 3);
  assert.deepEqual(segment.observations, input.observations);
  assert.deepEqual(segment.checkpoint, input.checkpoint);
  assert.equal(Object.isFrozen(segment), true);
  assert.equal(Object.isFrozen(segment.observations[0].payload), true);

  input.observations[0].payload.providerTrackId = 'caller-mutation';
  assert.equal(segment.observations[0].payload.providerTrackId, 'track-3');

  const serialized = serializeCensusScrollSegment(segment);
  assert.equal(serialized.endsWith('\n'), true);
  const parsed = parseCensusScrollSegment(serialized);
  assert.deepEqual(parsed, segment);
  assert.equal(Object.isFrozen(parsed.checkpoint.seenStableIds), true);
});

test('segment parsing fails closed on mismatched lineage or extra authority fields', () => {
  const segment = buildCensusScrollSegment(roundResult());
  assert.throws(
    () => parseCensusScrollSegment(JSON.stringify({ ...segment, runId: 'different-run' })),
    /segment lineage mismatch/,
  );
  assert.throws(
    () => parseCensusScrollSegment(JSON.stringify({ ...segment, authorization: 'Bearer hidden' })),
    /invalid census scroll segment shape/,
  );
  assert.throws(
    () => parseCensusScrollSegment('{"schema":'),
    /invalid census scroll segment JSON/,
  );
});

