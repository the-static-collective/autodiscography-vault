const CANONICAL_UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EXPLICIT_OFFSET_RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const REASON_CODE = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const CAPTURE_ADAPTER = /^[a-z0-9][a-z0-9._-]{0,127}\/v[1-9]\d*$/;
const SOURCE_SURFACE = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const DURABLE_CREDENTIAL_VALUE = /\bbearer\s+[A-Za-z0-9._~+/=-]+/i;
const REQUIRED_EVIDENCE = Object.freeze([
  'providerTrackId',
  'providerCreatedAtRaw',
  'stylePromptRaw',
  'lyricsTextRaw',
  'lyricGenerationPromptRaw',
  'parentProviderTrackId',
  'audioWav',
]);
const POINTER_STATES = new Set(['observed', 'known_null']);
const ABSENCE_STATES = new Set([
  'not_observed',
  'not_exposed',
  'unavailable',
  'refused',
  'failed_to_fetch',
  'artifact_known_bytes_unavailable',
  'historically_observed_now_missing',
]);
const FORBIDDEN_DURABLE_KEYS = new Set([
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'session',
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
  'sessionid',
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

export const FIELD_STATES = Object.freeze([
  'observed',
  'known_null',
  ...ABSENCE_STATES,
  'derived',
  'normalization_failed',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`missing ${name}`);
  return value;
}

function assertCanonicalUtc(value, name) {
  requireString(value, name);
  if (!CANONICAL_UTC_ISO.test(value) || new Date(value).toISOString() !== value) {
    throw new Error(`${name} must be canonical UTC ISO-8601`);
  }
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isCapabilityUrl(value) {
  if (typeof value !== 'string') return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (url.username || url.password || url.hash) return true;
  for (const key of url.searchParams.keys()) {
    const normalized = normalizeKey(key);
    if (
      normalized.startsWith('xamz')
      || normalized.startsWith('xgoog')
      || CAPABILITY_QUERY_KEYS.has(normalized)
    ) return true;
  }
  return false;
}

export function assertDurableObservationSafe(value, seen = new Set()) {
  if (typeof value === 'string') {
    if (DURABLE_CREDENTIAL_VALUE.test(value)) throw new Error('durable credential value refused');
    if (isCapabilityUrl(value)) throw new Error('durable capability URL refused: value');
    return true;
  }
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);

  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);
    if (FORBIDDEN_DURABLE_KEYS.has(normalizedKey)) {
      throw new Error(`durable credential field refused: ${key}`);
    }
    if (isCapabilityUrl(nested)) {
      throw new Error(`durable capability URL refused: ${key}`);
    }
    assertDurableObservationSafe(nested, seen);
  }
  return true;
}

function decodePointerToken(token) {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolvePointer(root, pointer) {
  if (pointer === '') return { found: true, value: root };
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return { found: false };
  let value = root;
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = decodePointerToken(rawToken);
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, token)) {
      return { found: false };
    }
    value = value[token];
  }
  return { found: true, value };
}

function assertEvidenceKeys(name, evidence, allowed) {
  for (const key of Object.keys(evidence)) {
    if (!allowed.has(key)) throw new Error(`unknown evidence field: ${name}.${key}`);
  }
}

function normalizeEvidence(name, evidence, payload, { observedType } = {}) {
  if (!isObject(evidence)) throw new Error(`missing evidence state: ${name}`);
  const state = evidence.state;
  if (!FIELD_STATES.includes(state) || ['derived', 'normalization_failed'].includes(state)) {
    throw new Error(`invalid evidence state: ${name}`);
  }

  if (POINTER_STATES.has(state)) {
    if ('value' in evidence) throw new Error(`pointer evidence cannot carry inline value: ${name}`);
    assertEvidenceKeys(name, evidence, new Set(['state', 'pointer']));
    const pointer = requireString(evidence.pointer, `${name} pointer`);
    const resolved = resolvePointer(payload, pointer);
    if (!resolved.found) throw new Error(`observed pointer does not resolve: ${name}`);
    if (state === 'known_null' && resolved.value !== null) {
      throw new Error(`known_null pointer is not null: ${name}`);
    }
    if (state === 'observed' && resolved.value === null) {
      throw new Error(`observed pointer resolved null: ${name}; use known_null`);
    }
    if (observedType && state === 'observed' && typeof resolved.value !== observedType) {
      throw new Error(`${name} observed value must be a ${observedType}`);
    }
    if (state === 'known_null') return Object.freeze({ state: 'known_null', sourcePointer: pointer });
    return Object.freeze({ state: 'observed', value: resolved.value, sourcePointer: pointer });
  }

  if (!ABSENCE_STATES.has(state)) throw new Error(`invalid evidence state: ${name}`);
  const historical = state === 'historically_observed_now_missing';
  assertEvidenceKeys(
    name,
    evidence,
    new Set(historical ? ['state', 'reasonCode', 'priorRawRecordSha256'] : ['state', 'reasonCode']),
  );
  const reasonCode = requireString(evidence.reasonCode, `${name} reasonCode`);
  if (!REASON_CODE.test(reasonCode)) throw new Error(`invalid reasonCode: ${name}`);
  if (historical) {
    if (!SHA256_HEX.test(evidence.priorRawRecordSha256 ?? '')) {
      throw new Error(`historically missing evidence requires priorRawRecordSha256: ${name}`);
    }
    return Object.freeze({ state, reasonCode, priorRawRecordSha256: evidence.priorRawRecordSha256 });
  }
  return Object.freeze({ state, reasonCode });
}

function leapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  return [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function normalizeExplicitOffsetTimestamp(value) {
  const match = EXPLICIT_OFFSET_RFC3339.exec(value);
  if (!match) return null;
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, fractionRaw = '', offsetRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  if (
    year < 1
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth(year, month)
    || hour > 23
    || minute > 59
    || second > 59
  ) return null;

  let offsetMinutes = 0;
  if (offsetRaw !== 'Z') {
    if (offsetRaw === '-00:00') return null;
    const offsetHours = Number(offsetRaw.slice(1, 3));
    const offsetRemainder = Number(offsetRaw.slice(4, 6));
    if (offsetHours > 14 || offsetRemainder > 59 || (offsetHours === 14 && offsetRemainder !== 0)) return null;
    offsetMinutes = (offsetHours * 60) + offsetRemainder;
    if (offsetRaw[0] === '-') offsetMinutes *= -1;
  }

  const milliseconds = Number((fractionRaw.slice(0, 3) || '0').padEnd(3, '0'));
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  utc.setUTCHours(hour, minute, second, milliseconds);
  const normalized = new Date(utc.getTime() - (offsetMinutes * 60_000));
  try {
    return normalized.toISOString();
  } catch {
    return null;
  }
}

function normalizeProviderCreatedAt(rawField) {
  if (rawField.state !== 'observed') {
    return Object.freeze({
      state: rawField.state,
      ...(rawField.reasonCode ? { reasonCode: rawField.reasonCode } : {}),
      derivedFrom: 'providerCreatedAtRaw',
    });
  }

  if (typeof rawField.value !== 'string') {
    return Object.freeze({
      state: 'normalization_failed',
      reasonCode: 'invalid_provider_created_at',
      derivedFrom: 'providerCreatedAtRaw',
    });
  }
  const normalized = normalizeExplicitOffsetTimestamp(rawField.value);
  if (!normalized) {
    return Object.freeze({
      state: 'normalization_failed',
      reasonCode: 'invalid_provider_created_at',
      derivedFrom: 'providerCreatedAtRaw',
    });
  }
  return Object.freeze({
    state: 'derived',
    value: normalized,
    derivedFrom: 'providerCreatedAtRaw',
  });
}

function assertDistinctExactTextPointers(evidence) {
  const pointers = new Map();
  for (const name of ['stylePromptRaw', 'lyricsTextRaw', 'lyricGenerationPromptRaw']) {
    const item = evidence[name];
    if (!POINTER_STATES.has(item?.state) || typeof item.pointer !== 'string') continue;
    const prior = pointers.get(item.pointer);
    if (prior) {
      throw new Error(`distinct exact-text fields cannot share a source pointer: ${prior}, ${name}`);
    }
    pointers.set(item.pointer, name);
  }
}

function assertProvenance(provenance) {
  if (!isObject(provenance)) throw new Error('raw provenance is required');
  for (const key of ['rawSourceSha256', 'rawRecordSha256']) {
    if (!SHA256_HEX.test(provenance[key] ?? '')) throw new Error(`invalid ${key}`);
  }
  for (const key of ['rawRecordOffset', 'rawRecordByteLength']) {
    if (!Number.isSafeInteger(provenance[key]) || provenance[key] < 0) throw new Error(`invalid ${key}`);
  }
}

function topLevelPointer(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return null;
  const [first] = pointer.slice(1).split('/');
  return `/${first}`;
}

function unmappedTopLevelPointers(payload, evidence) {
  const mapped = new Set(
    Object.values(evidence)
      .map(item => topLevelPointer(item?.pointer))
      .filter(Boolean),
  );
  return Object.keys(payload)
    .map(key => `/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`)
    .filter(pointer => !mapped.has(pointer))
    .sort();
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export function normalizeCensusObservation(input, provenance) {
  if (!isObject(input)) throw new Error('census observation must be an object');
  if (input.schema !== 'autodiscography-vault-observation/v1') throw new Error('invalid census observation schema');
  if (input.provider !== 'suno') throw new Error('provider must be suno');
  assertCanonicalUtc(input.observedAt, 'observedAt');
  if (!isObject(input.source)) throw new Error('source evidence is required');
  const sourceKind = requireString(input.source.kind, 'source.kind');
  const sourceLocator = requireString(input.source.locator, 'source.locator');
  const sourceAdapter = requireString(input.source.adapter, 'source.adapter');
  const sourceSurface = requireString(input.source.surface, 'source.surface');
  if (!CAPTURE_ADAPTER.test(sourceAdapter)) throw new Error('source.adapter must be explicitly versioned');
  if (!SOURCE_SURFACE.test(sourceSurface)) throw new Error('source.surface must be a bounded profile name');
  if (!isObject(input.payload)) throw new Error('payload must be an object');
  if (!isObject(input.evidence)) throw new Error('evidence must be an object');
  assertProvenance(provenance);
  assertDurableObservationSafe(input);

  for (const name of REQUIRED_EVIDENCE) {
    if (!Object.hasOwn(input.evidence, name)) throw new Error(`missing evidence state: ${name}`);
  }
  assertDistinctExactTextPointers(input.evidence);

  const providerTrackId = normalizeEvidence(
    'providerTrackId',
    input.evidence.providerTrackId,
    input.payload,
    { observedType: 'string' },
  );
  const providerCreatedAtRaw = normalizeEvidence('providerCreatedAtRaw', input.evidence.providerCreatedAtRaw, input.payload);
  const stylePromptRaw = normalizeEvidence(
    'stylePromptRaw',
    input.evidence.stylePromptRaw,
    input.payload,
    { observedType: 'string' },
  );
  const lyricsTextRaw = normalizeEvidence(
    'lyricsTextRaw',
    input.evidence.lyricsTextRaw,
    input.payload,
    { observedType: 'string' },
  );
  const lyricGenerationPromptRaw = normalizeEvidence(
    'lyricGenerationPromptRaw',
    input.evidence.lyricGenerationPromptRaw,
    input.payload,
    { observedType: 'string' },
  );
  const parentProviderTrackId = normalizeEvidence(
    'parentProviderTrackId',
    input.evidence.parentProviderTrackId,
    input.payload,
    { observedType: 'string' },
  );
  const audioWav = normalizeEvidence('audioWav', input.evidence.audioWav, input.payload);

  return deepFreeze({
    schema: 'autodiscography-vault-normalized-observation/v1',
    normalizer: 'census-v1',
    provider: 'suno',
    observedAt: input.observedAt,
    source: {
      kind: sourceKind,
      locator: sourceLocator,
      adapter: sourceAdapter,
      surface: sourceSurface,
    },
    rawProvenance: { ...provenance },
    fields: {
      providerTrackId,
      providerCreatedAtRaw,
      providerCreatedAtNormalized: normalizeProviderCreatedAt(providerCreatedAtRaw),
      stylePromptRaw,
      lyricsTextRaw,
      lyricGenerationPromptRaw,
      parentProviderTrackId,
    },
    artifacts: { audioWav },
    unmappedTopLevelPointers: unmappedTopLevelPointers(input.payload, input.evidence),
  });
}
