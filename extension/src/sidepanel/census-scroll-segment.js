const SEGMENT_SCHEMA = 'autodiscography-vault-census-scroll-segment/v1';
const ROUND_SCHEMA = 'autodiscography-vault-census-scroll-round/v1';
const CHECKPOINT_SCHEMA = 'autodiscography-vault-census-scroll-checkpoint/v1';
const SEGMENT_KEYS = Object.freeze([
  'checkpoint',
  'observations',
  'observedAt',
  'round',
  'runId',
  'schema',
  'status',
  'version',
]);
const FORBIDDEN_KEYS = new Set([
  'authorization',
  'authorizationheader',
  'accesstoken',
  'apikey',
  'authheader',
  'authtoken',
  'cookie',
  'csrftoken',
  'credential',
  'credentials',
  'idtoken',
  'jwt',
  'passwd',
  'password',
  'proxyauthorization',
  'refreshtoken',
  'secret',
  'session',
  'sessionid',
  'sessiontoken',
  'setcookie',
]);
const SECRET_VALUE = /\bbearer\s+[A-Za-z0-9._~+/=-]+/i;

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

function assertCapabilityFree(value, seen = new Set()) {
  if (typeof value === 'string') {
    if (SECRET_VALUE.test(value)) throw new Error('census scroll segment contains reusable authority');
    if (/^https?:\/\//i.test(value)) {
      let url;
      try {
        url = new URL(value);
      } catch {
        return;
      }
      const queryKeys = Array.from(url.searchParams.keys()).map(normalizeKey);
      if (
        url.username
        || url.password
        || url.hash
        || queryKeys.some(key => (
          key.startsWith('xamz')
          || key.startsWith('xgoog')
          || ['auth', 'authorization', 'cookie', 'credential', 'expires', 'key', 'keypairid', 'policy', 'session', 'sig', 'signature', 'token'].includes(key)
        ))
      ) throw new Error('census scroll segment contains reusable authority');
    }
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) throw new Error('census scroll segment must be acyclic JSON');
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizeKey(key))) {
      throw new Error('census scroll segment contains reusable authority');
    }
    assertCapabilityFree(nested, seen);
  }
  seen.delete(value);
}

function deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const clone = {};
  for (const [key, nested] of Object.entries(value)) {
    Object.defineProperty(clone, key, {
      value: deepClone(nested),
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return clone;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function validateSegment(value) {
  assertExactKeys(value, SEGMENT_KEYS, 'census scroll segment');
  if (value.schema !== SEGMENT_SCHEMA || value.version !== 1) {
    throw new Error('invalid census scroll segment schema/version');
  }
  if (typeof value.runId !== 'string' || !value.runId) throw new Error('invalid census scroll segment run ID');
  if (!Number.isSafeInteger(value.round) || value.round < 1) throw new Error('invalid census scroll segment round');
  if (!Array.isArray(value.observations)) throw new Error('invalid census scroll segment observations');
  if (!isObject(value.checkpoint) || value.checkpoint.schema !== CHECKPOINT_SCHEMA) {
    throw new Error('invalid census scroll segment checkpoint');
  }
  if (
    value.runId !== value.checkpoint.runId
    || value.round !== value.checkpoint.round
    || value.observedAt !== value.checkpoint.updatedAt
    || value.status !== value.checkpoint.status
  ) throw new Error('segment lineage mismatch');
  assertCapabilityFree(value);
  return deepFreeze(deepClone(value));
}

export function buildCensusScrollSegment(roundResult) {
  if (!isObject(roundResult) || roundResult.schema !== ROUND_SCHEMA || roundResult.version !== 1) {
    throw new Error('invalid census scroll round');
  }
  return validateSegment({
    schema: SEGMENT_SCHEMA,
    version: 1,
    runId: roundResult.runId,
    round: roundResult.round,
    observedAt: roundResult.observedAt,
    status: roundResult.status,
    observations: roundResult.observations,
    checkpoint: roundResult.checkpoint,
  });
}

export function parseCensusScrollSegment(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid census scroll segment JSON');
  }
  return validateSegment(parsed);
}

export function serializeCensusScrollSegment(segment) {
  return `${JSON.stringify(validateSegment(segment))}\n`;
}
