(() => {
  'use strict';

  const CHECKPOINT_SCHEMA = 'autodiscography-vault-census-scroll-checkpoint/v1';
  const ROUND_SCHEMA = 'autodiscography-vault-census-scroll-round/v1';
  const VERSION = 1;
  const DEFAULT_STABLE_ROUNDS = 3;
  const DEFAULT_BOTTOM_TOLERANCE = 1;
  const CANONICAL_UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const REUSABLE_SECRET_VALUE = /\bbearer\s+[A-Za-z0-9._~+/=-]+/i;
  const FORBIDDEN_DURABLE_KEYS = new Set([
    'authorization',
    'proxyauthorization',
    'cookie',
    'setcookie',
    'accesstoken',
    'refreshtoken',
    'session',
    'sessionid',
    'sessiontoken',
    'password',
    'passwd',
    'secret',
    'credential',
    'credentials',
    'apikey',
    'authheader',
    'authorizationheader',
    'authtoken',
    'csrftoken',
    'idtoken',
    'jwt',
  ]);
  const CAPABILITY_QUERY_KEYS = new Set([
    'auth',
    'authorization',
    'cookie',
    'credential',
    'expires',
    'key',
    'keypairid',
    'policy',
    'session',
    'sig',
    'signature',
    'token',
  ]);
  const CHECKPOINT_KEYS = Object.freeze([
    'configuration',
    'emittedCount',
    'round',
    'runId',
    'schema',
    'scrollMetrics',
    'seenStableIds',
    'status',
    'updatedAt',
    'version',
  ]);
  const SCROLL_METRIC_KEYS = Object.freeze([
    'atBottom',
    'scrollHeight',
    'scrollTop',
    'stableRounds',
    'viewportHeight',
  ]);
  const INPUT_SCROLL_METRIC_KEYS = Object.freeze([
    'scrollHeight',
    'scrollTop',
    'viewportHeight',
  ]);
  const CANDIDATE_KEYS = Object.freeze(['observation', 'stableProviderId']);
  const CONFIGURATION_KEYS = Object.freeze(['bottomTolerance', 'stableRoundsRequired']);

  function isObject(value) {
    return value !== null && Object.prototype.toString.call(value) === '[object Object]';
  }

  function normalizeKey(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function assertExactKeys(value, expected, name) {
    if (!isObject(value)) throw new Error(`${name} must be an object`);
    const actual = Object.keys(value).sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
      throw new Error(`invalid ${name} shape`);
    }
  }

  function assertCanonicalUtc(value, name) {
    if (
      typeof value !== 'string'
      || !CANONICAL_UTC_ISO.test(value)
      || new Date(value).toISOString() !== value
    ) {
      throw new Error(`${name} must be canonical UTC ISO-8601`);
    }
    return value;
  }

  function isCapabilityUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }
    if (parsed.username || parsed.password || parsed.hash) return true;
    for (const key of parsed.searchParams.keys()) {
      const normalized = normalizeKey(key);
      if (
        normalized.startsWith('xamz')
        || normalized.startsWith('xgoog')
        || CAPABILITY_QUERY_KEYS.has(normalized)
      ) return true;
    }
    return false;
  }

  function assertJsonSafeAndCapabilityFree(value, seen = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      if (typeof value === 'string' && (REUSABLE_SECRET_VALUE.test(value) || isCapabilityUrl(value))) {
        throw new Error('candidate observation contains reusable capability material');
      }
      return;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('candidate observation must be finite JSON data');
      return;
    }
    if (typeof value !== 'object') throw new Error('candidate observation must be JSON data');
    if (seen.has(value)) throw new Error('candidate observation must not be cyclic');
    seen.add(value);

    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) {
        throw new Error('candidate observation arrays must be dense JSON data');
      }
      for (const nested of value) assertJsonSafeAndCapabilityFree(nested, seen);
      seen.delete(value);
      return;
    }
    if (!isObject(value)) throw new Error('candidate observation must contain only JSON objects');

    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_DURABLE_KEYS.has(normalizeKey(key))) {
        throw new Error('candidate observation contains reusable capability material');
      }
      assertJsonSafeAndCapabilityFree(nested, seen);
    }
    seen.delete(value);
  }

  function assertNonnegativeFinite(value, name) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a nonnegative finite number`);
    return value;
  }

  function assertNonnegativeSafeInteger(value, name) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a nonnegative safe integer`);
    return value;
  }

  function assertPositiveSafeInteger(value, name) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`);
    return value;
  }

  function assertRunId(value) {
    if (
      typeof value !== 'string'
      || value.length < 1
      || value.length > 128
      || value.trim() !== value
      || /[\u0000-\u001f\u007f]/.test(value)
      || REUSABLE_SECRET_VALUE.test(value)
      || isCapabilityUrl(value)
    ) {
      throw new Error('invalid census scroll run ID');
    }
    return value;
  }

  function assertStableProviderId(value) {
    if (
      typeof value !== 'string'
      || value.length < 1
      || value.length > 512
      || value.trim() !== value
      || /[\u0000-\u001f\u007f]/.test(value)
      || REUSABLE_SECRET_VALUE.test(value)
      || isCapabilityUrl(value)
    ) {
      throw new Error('invalid stable provider ID');
    }
    return value;
  }

  function freezeCheckpoint(value) {
    Object.freeze(value.configuration);
    Object.freeze(value.scrollMetrics);
    Object.freeze(value.seenStableIds);
    return Object.freeze(value);
  }

  function initialScrollMetrics() {
    return {
      scrollTop: 0,
      viewportHeight: 0,
      scrollHeight: 0,
      atBottom: false,
      stableRounds: 0,
    };
  }

  function validateConfiguration(value) {
    assertExactKeys(value, CONFIGURATION_KEYS, 'checkpoint configuration');
    return {
      stableRoundsRequired: assertPositiveSafeInteger(
        value.stableRoundsRequired,
        'stableRoundsRequired',
      ),
      bottomTolerance: assertNonnegativeFinite(value.bottomTolerance, 'bottomTolerance'),
    };
  }

  function createCheckpoint({
    runId,
    observedAt,
    stableRoundsRequired = DEFAULT_STABLE_ROUNDS,
    bottomTolerance = DEFAULT_BOTTOM_TOLERANCE,
  } = {}) {
    return freezeCheckpoint({
      schema: CHECKPOINT_SCHEMA,
      version: VERSION,
      runId: assertRunId(runId),
      configuration: validateConfiguration({ stableRoundsRequired, bottomTolerance }),
      round: 0,
      seenStableIds: [],
      emittedCount: 0,
      scrollMetrics: initialScrollMetrics(),
      status: 'running',
      updatedAt: assertCanonicalUtc(observedAt, 'observedAt'),
    });
  }

  function validateScrollMetrics(value, { checkpoint = false } = {}) {
    assertExactKeys(
      value,
      checkpoint ? SCROLL_METRIC_KEYS : INPUT_SCROLL_METRIC_KEYS,
      checkpoint ? 'checkpoint scrollMetrics' : 'scrollMetrics',
    );
    const normalized = {
      scrollTop: assertNonnegativeFinite(value.scrollTop, 'scrollTop'),
      viewportHeight: assertNonnegativeFinite(value.viewportHeight, 'viewportHeight'),
      scrollHeight: assertNonnegativeFinite(value.scrollHeight, 'scrollHeight'),
    };
    if (!checkpoint) return normalized;
    if (typeof value.atBottom !== 'boolean') throw new Error('atBottom must be boolean');
    normalized.atBottom = value.atBottom;
    normalized.stableRounds = assertNonnegativeSafeInteger(value.stableRounds, 'stableRounds');
    return normalized;
  }

  function validateCheckpoint(value) {
    assertExactKeys(value, CHECKPOINT_KEYS, 'checkpoint');
    if (value.schema !== CHECKPOINT_SCHEMA || value.version !== VERSION) {
      throw new Error('invalid census scroll checkpoint schema/version');
    }
    assertRunId(value.runId);
    const configuration = validateConfiguration(value.configuration);
    assertNonnegativeSafeInteger(value.round, 'checkpoint round');
    assertNonnegativeSafeInteger(value.emittedCount, 'checkpoint emittedCount');
    assertCanonicalUtc(value.updatedAt, 'checkpoint updatedAt');
    const savedMetrics = validateScrollMetrics(value.scrollMetrics, { checkpoint: true });
    if (!['running', 'ui_exhausted'].includes(value.status)) {
      throw new Error('invalid census scroll checkpoint status');
    }
    if (
      value.status === 'ui_exhausted'
      && (
        !savedMetrics.atBottom
        || savedMetrics.stableRounds < configuration.stableRoundsRequired
      )
    ) {
      throw new Error('invalid terminal census scroll checkpoint');
    }
    if (!Array.isArray(value.seenStableIds)) throw new Error('checkpoint seenStableIds must be an array');
    const seen = new Set();
    for (const id of value.seenStableIds) {
      assertStableProviderId(id);
      if (seen.has(id)) throw new Error('checkpoint contains duplicate stable provider ID');
      seen.add(id);
    }
    if (seen.size > value.emittedCount) throw new Error('checkpoint stable ID count exceeds emittedCount');
    return {
      schema: value.schema,
      version: value.version,
      runId: value.runId,
      configuration,
      round: value.round,
      seenStableIds: [...value.seenStableIds],
      emittedCount: value.emittedCount,
      scrollMetrics: savedMetrics,
      status: value.status,
      updatedAt: value.updatedAt,
    };
  }

  function validateCandidate(value, index) {
    assertExactKeys(value, CANDIDATE_KEYS, `candidate ${index}`);
    if (value.stableProviderId !== null) assertStableProviderId(value.stableProviderId);
    if (!isObject(value.observation)) throw new Error(`candidate ${index} observation must be an object`);
    assertJsonSafeAndCapabilityFree(value.observation);
    if (Object.hasOwn(value.observation, 'observedAt')) {
      assertCanonicalUtc(value.observation.observedAt, `candidate ${index} observedAt`);
    }
    return value;
  }

  function cloneAndFreezeJson(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return Object.freeze(value.map(cloneAndFreezeJson));
    const clone = {};
    for (const [key, nested] of Object.entries(value)) {
      Object.defineProperty(clone, key, {
        value: cloneAndFreezeJson(nested),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(clone);
  }

  function advance({
    checkpoint,
    observedAt,
    candidates = [],
    scrollMetrics,
  } = {}) {
    const prior = validateCheckpoint(checkpoint);
    if (prior.status === 'ui_exhausted') throw new Error('census scroll checkpoint is already terminal');
    assertCanonicalUtc(observedAt, 'observedAt');
    if (observedAt < prior.updatedAt) throw new Error('observedAt must not precede checkpoint updatedAt');
    const currentMetrics = validateScrollMetrics(scrollMetrics);
    if (!Array.isArray(candidates)) throw new Error('candidates must be an array');

    const seen = new Set(prior.seenStableIds);
    const newStableIds = [];
    const alreadySeenStableIdObservationIndexes = [];
    const unknownIdObservationIndexes = [];
    const observations = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = validateCandidate(candidates[index], index);
      observations.push(cloneAndFreezeJson(candidate.observation));
      if (candidate.stableProviderId === null) {
        unknownIdObservationIndexes.push(index);
      } else if (seen.has(candidate.stableProviderId)) {
        alreadySeenStableIdObservationIndexes.push(index);
      } else {
        seen.add(candidate.stableProviderId);
        newStableIds.push(candidate.stableProviderId);
      }
    }

    const atBottom = currentMetrics.scrollTop + currentMetrics.viewportHeight
      >= currentMetrics.scrollHeight - prior.configuration.bottomTolerance;
    const scrollHeightGrew = currentMetrics.scrollHeight > prior.scrollMetrics.scrollHeight;
    const scrollHeightStable = currentMetrics.scrollHeight === prior.scrollMetrics.scrollHeight;
    const stableRound = atBottom
      && newStableIds.length === 0
      && unknownIdObservationIndexes.length === 0
      && scrollHeightStable;
    const stableRounds = stableRound ? prior.scrollMetrics.stableRounds + 1 : 0;
    const status = stableRounds >= prior.configuration.stableRoundsRequired ? 'ui_exhausted' : 'running';

    const nextCheckpoint = freezeCheckpoint({
      schema: CHECKPOINT_SCHEMA,
      version: VERSION,
      runId: prior.runId,
      configuration: { ...prior.configuration },
      round: prior.round + 1,
      seenStableIds: [...seen],
      emittedCount: prior.emittedCount + observations.length,
      scrollMetrics: {
        scrollTop: currentMetrics.scrollTop,
        viewportHeight: currentMetrics.viewportHeight,
        scrollHeight: currentMetrics.scrollHeight,
        atBottom,
        stableRounds,
      },
      status,
      updatedAt: observedAt,
    });

    Object.freeze(observations);
    Object.freeze(newStableIds);
    Object.freeze(alreadySeenStableIdObservationIndexes);
    Object.freeze(unknownIdObservationIndexes);
    const derived = Object.freeze({
      newStableIds,
      alreadySeenStableIdObservationIndexes,
      unknownIdObservationIndexes,
      scrollHeightGrew,
    });
    const action = status === 'ui_exhausted'
      ? Object.freeze({ kind: 'stop', reasonCode: 'ui_exhausted' })
      : Object.freeze({ kind: 'scroll_to', scrollTop: currentMetrics.scrollHeight });

    return Object.freeze({
      schema: ROUND_SCHEMA,
      version: VERSION,
      runId: prior.runId,
      round: nextCheckpoint.round,
      observedAt,
      status,
      observations,
      derived,
      action,
      checkpoint: nextCheckpoint,
    });
  }

  globalThis.AutodiscographyVaultSunoCensusScroll = Object.freeze({
    CHECKPOINT_SCHEMA,
    ROUND_SCHEMA,
    VERSION,
    createCheckpoint,
    advance,
  });
})();
