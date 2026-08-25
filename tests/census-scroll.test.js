import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadController() {
  const url = new URL('../extension/src/provider/suno/census-scroll.js', import.meta.url);
  assert.equal(existsSync(url), true, 'the pure Suno census scroll controller must exist');
  const source = readFileSync(url, 'utf8');
  const context = { URL };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'census-scroll.js' });
  const controller = context.AutodiscographyVaultSunoCensusScroll;
  assert.equal(typeof controller?.createCheckpoint, 'function');
  assert.equal(typeof controller?.advance, 'function');
  return controller;
}

const T0 = '2026-08-24T20:00:00.000Z';
const T1 = '2026-08-24T20:00:01.000Z';
const T2 = '2026-08-24T20:00:02.000Z';
const T3 = '2026-08-24T20:00:03.000Z';

function metrics({ top = 0, viewport = 800, height = 4000 } = {}) {
  return { scrollTop: top, viewportHeight: viewport, scrollHeight: height };
}

function candidate(stableProviderId, observation = {}) {
  return {
    stableProviderId,
    observation: {
      schema: 'autodiscography-vault-observation/v1',
      provider: 'suno',
      observedAt: T0,
      ...observation,
    },
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('10k checkpoint resumes with stable-ID dedupe and no mutation of prior state', () => {
  const controller = loadController();
  const initial = controller.createCheckpoint({ runId: 'census-run-10k', observedAt: T0 });
  const firstCandidates = Array.from({ length: 10_000 }, (_, index) =>
    candidate(`track-${index + 1}`, { payload: { ordinal: index + 1 } }));

  const first = controller.advance({
    checkpoint: initial,
    observedAt: T1,
    candidates: firstCandidates,
    scrollMetrics: metrics({ top: 3200 }),
  });
  assert.equal(first.observations.length, 10_000);
  assert.equal(first.checkpoint.seenStableIds.length, 10_000);
  assert.equal(first.checkpoint.emittedCount, 10_000);
  assert.deepEqual({ ...first.checkpoint.configuration }, {
    stableRoundsRequired: 3,
    bottomTolerance: 1,
  });
  assert.equal(initial.round, 0, 'input checkpoint remains unchanged');
  assert.equal(initial.seenStableIds.length, 0, 'input checkpoint is not used as mutable storage');

  const durableCheckpoint = JSON.parse(JSON.stringify(first.checkpoint));
  const resumed = controller.advance({
    checkpoint: durableCheckpoint,
    observedAt: T2,
    candidates: [
      candidate('track-10000', { observedAt: T2, payload: { ordinal: 10_000 } }),
      candidate('track-10001', { observedAt: T2, payload: { ordinal: 10_001 } }),
      candidate('track-10002', { observedAt: T2, payload: { ordinal: 10_002 } }),
    ],
    scrollMetrics: metrics({ top: 4000, height: 4800 }),
  });

  assert.deepEqual(Array.from(resumed.derived.newStableIds), ['track-10001', 'track-10002']);
  assert.equal(resumed.checkpoint.seenStableIds.length, 10_002);
  assert.equal(new Set(resumed.checkpoint.seenStableIds).size, 10_002);
  assert.equal(resumed.checkpoint.emittedCount, 10_003);
  assert.equal(first.checkpoint.seenStableIds.length, 10_000, 'a later round cannot rewrite a prior checkpoint');
});

test('an uncheckpointed tail is deterministically replayed instead of silently lost', () => {
  const controller = loadController();
  const base = controller.advance({
    checkpoint: controller.createCheckpoint({ runId: 'tail-replay', observedAt: T0 }),
    observedAt: T1,
    candidates: [candidate('track-1', { payload: { title: 'one' } })],
    scrollMetrics: metrics(),
  });
  const tailInput = [candidate('track-2', { observedAt: T2, payload: { title: 'two' } })];

  const attemptBeforeCrash = controller.advance({
    checkpoint: base.checkpoint,
    observedAt: T2,
    candidates: tailInput,
    scrollMetrics: metrics({ top: 800 }),
  });
  const replayAfterCrash = controller.advance({
    checkpoint: base.checkpoint,
    observedAt: T2,
    candidates: tailInput,
    scrollMetrics: metrics({ top: 800 }),
  });

  assert.deepEqual(replayAfterCrash, attemptBeforeCrash);
  assert.deepEqual(plain(replayAfterCrash.observations[0]), tailInput[0].observation,
    'the exact caller-supplied observation is replayed');
  assert.notEqual(replayAfterCrash.observations[0], tailInput[0].observation,
    'the preserved snapshot cannot be rewritten through the caller object');
  assert.equal(base.checkpoint.round, 1);
  assert.deepEqual(Array.from(base.checkpoint.seenStableIds), ['track-1']);
});

test('provider field drift remains a separate exact raw observation', () => {
  const controller = loadController();
  const oldObservation = candidate('track-drift', {
    payload: { style: 'old provider value', providerMysteryField: { shape: 1 } },
  });
  const first = controller.advance({
    checkpoint: controller.createCheckpoint({ runId: 'field-drift', observedAt: T0 }),
    observedAt: T1,
    candidates: [oldObservation],
    scrollMetrics: metrics(),
  });

  const driftedObservation = candidate('track-drift', {
    observedAt: T2,
    payload: { style: 'new provider value', providerMysteryField: ['changed', 2] },
  });
  const second = controller.advance({
    checkpoint: first.checkpoint,
    observedAt: T2,
    candidates: [driftedObservation],
    scrollMetrics: metrics({ top: 800 }),
  });

  assert.equal(second.observations.length, 1);
  assert.notEqual(second.observations[0], driftedObservation.observation);
  assert.deepEqual(plain(second.observations[0].payload), {
    style: 'new provider value',
    providerMysteryField: ['changed', 2],
  });
  assert.deepEqual(Array.from(second.derived.newStableIds), []);
  assert.equal(first.observations[0].payload.style, 'old provider value',
    'field drift never rewrites the earlier raw batch');
  oldObservation.observation.payload.style = 'caller tried to rewrite history';
  assert.equal(first.observations[0].payload.style, 'old provider value',
    'the earlier raw snapshot is isolated from later caller mutation');
  assert.equal(Object.isFrozen(first.observations[0].payload), true);
});

test('typed negative space is carried verbatim and unknown IDs are never merged or called roots', () => {
  const controller = loadController();
  const negativeSpace = {
    providerTrackId: { state: 'not_observed', reasonCode: 'dom_exposed_no_stable_id' },
    parentProviderTrackId: {
      state: 'historically_observed_now_missing',
      reasonCode: 'provider_field_removed',
      priorRawRecordSha256: 'a'.repeat(64),
    },
    lyricGenerationPromptRaw: { state: 'not_exposed', reasonCode: 'surface_has_no_prompt' },
    audioWav: { state: 'artifact_known_bytes_unavailable', reasonCode: 'not_downloaded' },
  };
  const unknownA = candidate(null, { payload: { title: 'same title' }, evidence: negativeSpace });
  const unknownB = candidate(null, { payload: { title: 'same title' }, evidence: negativeSpace });

  const round = controller.advance({
    checkpoint: controller.createCheckpoint({ runId: 'negative-space', observedAt: T0 }),
    observedAt: T1,
    candidates: [unknownA, unknownB],
    scrollMetrics: metrics(),
  });

  assert.equal(round.observations.length, 2);
  assert.notEqual(round.observations[0], unknownA.observation);
  assert.notEqual(round.observations[1], unknownB.observation);
  assert.deepEqual(plain(round.observations[0].evidence), negativeSpace);
  assert.deepEqual(Array.from(round.derived.unknownIdObservationIndexes), [0, 1]);
  assert.deepEqual(Array.from(round.derived.newStableIds), []);
  assert.equal('roots' in round, false);
  assert.equal(JSON.stringify(round).includes('root'), false);
});

test('ui_exhausted requires bottom plus stable rounds with no new or unidentified population evidence', () => {
  const controller = loadController();
  const start = controller.createCheckpoint({
    runId: 'terminal-logic',
    observedAt: T0,
    stableRoundsRequired: 2,
  });
  const discovered = controller.advance({
    checkpoint: start,
    observedAt: T1,
    candidates: [candidate('track-a')],
    scrollMetrics: metrics({ top: 3200 }),
  });
  assert.equal(discovered.checkpoint.status, 'running');
  assert.equal(discovered.checkpoint.scrollMetrics.stableRounds, 0);
  assert.deepEqual({ ...discovered.action }, { kind: 'scroll_to', scrollTop: 4000 });

  const grew = controller.advance({
    checkpoint: discovered.checkpoint,
    observedAt: T2,
    candidates: [],
    scrollMetrics: metrics({ top: 4000, height: 4800 }),
  });
  assert.equal(grew.checkpoint.scrollMetrics.atBottom, true);
  assert.equal(grew.checkpoint.scrollMetrics.stableRounds, 0, 'height growth resets stability');

  const notAtBottom = controller.advance({
    checkpoint: grew.checkpoint,
    observedAt: T3,
    candidates: [],
    scrollMetrics: metrics({ top: 1000, height: 4800 }),
  });
  assert.equal(notAtBottom.checkpoint.scrollMetrics.stableRounds, 0);

  const stableOnce = controller.advance({
    checkpoint: notAtBottom.checkpoint,
    observedAt: '2026-08-24T20:00:04.000Z',
    candidates: [candidate(null, { observedAt: '2026-08-24T20:00:04.000Z', payload: { title: 'unknown' } })],
    scrollMetrics: metrics({ top: 4000, height: 4800 }),
  });
  assert.equal(stableOnce.checkpoint.status, 'running');
  assert.equal(stableOnce.checkpoint.scrollMetrics.stableRounds, 0,
    'unknown-ID evidence may be a new object and must prevent an exhaustion claim');

  const stableEmpty = controller.advance({
    checkpoint: stableOnce.checkpoint,
    observedAt: '2026-08-24T20:00:05.000Z',
    candidates: [],
    scrollMetrics: metrics({ top: 4000, height: 4800 }),
  });
  assert.equal(stableEmpty.checkpoint.status, 'running');
  assert.equal(stableEmpty.checkpoint.scrollMetrics.stableRounds, 1);

  const shrank = controller.advance({
    checkpoint: stableEmpty.checkpoint,
    observedAt: '2026-08-24T20:00:06.000Z',
    candidates: [],
    scrollMetrics: metrics({ top: 3900, height: 4700 }),
  });
  assert.equal(shrank.checkpoint.scrollMetrics.stableRounds, 0,
    'virtualized scroll-height shrinkage is instability, not exhaustion');

  const stableAfterShrink = controller.advance({
    checkpoint: shrank.checkpoint,
    observedAt: '2026-08-24T20:00:07.000Z',
    candidates: [],
    scrollMetrics: metrics({ top: 3900, height: 4700 }),
  });
  const terminal = controller.advance({
    checkpoint: stableAfterShrink.checkpoint,
    observedAt: '2026-08-24T20:00:08.000Z',
    candidates: [],
    scrollMetrics: metrics({ top: 3900, height: 4700 }),
  });
  assert.equal(terminal.checkpoint.status, 'ui_exhausted');
  assert.equal(terminal.status, 'ui_exhausted');
  assert.deepEqual({ ...terminal.action }, { kind: 'stop', reasonCode: 'ui_exhausted' });
  assert.equal(JSON.stringify(terminal).includes('provider_complete'), false);
  assert.throws(() => controller.advance({
    checkpoint: terminal.checkpoint,
    observedAt: '2026-08-24T20:00:09.000Z',
    candidates: [],
    scrollMetrics: metrics({ top: 4000, height: 4800 }),
  }), /terminal/);
});

test('invalid checkpoints and noncanonical timestamps fail closed', () => {
  const controller = loadController();
  assert.throws(
    () => controller.createCheckpoint({ runId: 'bad-time', observedAt: '2026-08-24T20:00:00Z' }),
    /canonical UTC/,
  );

  const valid = controller.createCheckpoint({ runId: 'strict-checkpoint', observedAt: T0 });
  assert.throws(() => controller.advance({
    checkpoint: { ...valid, authorization: 'Bearer do-not-echo' },
    observedAt: T1,
    candidates: [],
    scrollMetrics: metrics(),
  }), /checkpoint shape/);
  assert.throws(() => controller.advance({
    checkpoint: { ...valid, seenStableIds: ['duplicate', 'duplicate'] },
    observedAt: T1,
    candidates: [],
    scrollMetrics: metrics(),
  }), /duplicate stable provider ID/);
  assert.throws(() => controller.advance({
    checkpoint: { ...valid, scrollMetrics: { ...valid.scrollMetrics, scrollHeight: -1 } },
    observedAt: T1,
    candidates: [],
    scrollMetrics: metrics(),
  }), /scrollHeight/);
  assert.throws(() => controller.advance({
    checkpoint: valid,
    observedAt: '2026-08-24 20:00:01Z',
    candidates: [],
    scrollMetrics: metrics(),
  }), /canonical UTC/);

  assert.throws(() => controller.advance({
    checkpoint: valid,
    observedAt: '2026-08-24T19:59:59.000Z',
    candidates: [],
    scrollMetrics: metrics(),
  }), /must not precede checkpoint updatedAt/);

  assert.throws(() => controller.advance({
    checkpoint: {
      ...valid,
      status: 'ui_exhausted',
      scrollMetrics: { ...valid.scrollMetrics, atBottom: true, stableRounds: 1 },
    },
    observedAt: T1,
    candidates: [],
    scrollMetrics: metrics(),
  }), /invalid terminal census scroll checkpoint/);
});

test('auth, session, and signed URL capability material is refused without echo', () => {
  const controller = loadController();
  const checkpoint = controller.createCheckpoint({ runId: 'safe-output', observedAt: T0 });
  const secret = 'Bearer abcdef-super-sensitive';
  const cases = [
    candidate('track-auth', { payload: { authorization: secret } }),
    candidate('track-auth-alias', { payload: { csrfToken: 'reusable-csrf' } }),
    candidate('track-session', { payload: { sessionToken: 'reusable-session' } }),
    candidate('track-url', { payload: { asset: 'https://cdn.example.test/file.wav?signature=secret' } }),
    candidate('track-google-url', {
      payload: { asset: 'https://cdn.example.test/file.wav?X-Goog-Signature=secret' },
    }),
  ];

  for (const unsafeCandidate of cases) {
    let error;
    try {
      controller.advance({
        checkpoint,
        observedAt: T1,
        candidates: [unsafeCandidate],
        scrollMetrics: metrics(),
      });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error);
    assert.equal(String(error).includes(secret), false);
  }
});

test('controller is an inert DOM seam with no network, storage, timer, or session primitive', () => {
  const url = new URL('../extension/src/provider/suno/census-scroll.js', import.meta.url);
  const source = readFileSync(url, 'utf8');
  for (const forbidden of [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /chrome\./,
    /document\./,
    /window\./,
    /localStorage/,
    /sessionStorage/,
    /setTimeout/,
    /setInterval/,
  ]) {
    assert.equal(forbidden.test(source), false, `pure controller must not contain ${forbidden}`);
  }
});
