export const ASSET_ROLES = Object.freeze([
  'audio_mp3',
  'audio_wav',
  'artwork',
  'raw_metadata',
  'lyrics',
  'other',
]);

export const ACQUISITION_STATES = Object.freeze([
  'verified',
  'missing',
  'partial',
  'refused',
  'failed',
]);

const ALLOWED_FIELDS = new Set([
  'schemaVersion',
  'runId',
  'provider',
  'providerTrackId',
  'assetRole',
  'state',
  'observedAt',
  'sourceRelativePath',
  'byteLength',
  'sha256',
  'reasonCode',
  'rawMetadataPath',
  'rawMetadataSha256',
]);

const SECRET_FIELD = /(authorization|cookie|password|token|secret|session)/i;
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:authorization|cookie|session|token|password|secret)\s*[:=])/i;
const CANONICAL_UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const REASON_CODE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function makeAcquisitionKey({ runId, providerTrackId, assetRole }) {
  return `${runId}\u0000${providerTrackId}\u0000${assetRole}`;
}

function requireString(input, key) {
  if (typeof input[key] !== 'string' || input[key].length === 0) {
    throw new Error(`missing ${key}`);
  }
}

function rejectSecretValues(input) {
  for (const value of Object.values(input)) {
    if (typeof value === 'string' && SECRET_VALUE.test(value)) {
      throw new Error('secret-shaped value refused');
    }
  }
}

export function validateReceipt(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('receipt must be an object');
  }

  for (const key of Object.keys(input)) {
    if (SECRET_FIELD.test(key)) {
      throw new Error(`secret-shaped field refused: ${key}`);
    }
    if (!ALLOWED_FIELDS.has(key)) {
      throw new Error(`unknown receipt field: ${key}`);
    }
  }

  rejectSecretValues(input);

  if (input.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (input.provider !== 'suno') throw new Error('provider must be suno');
  if (!ASSET_ROLES.includes(input.assetRole)) throw new Error('invalid assetRole');
  if (!ACQUISITION_STATES.includes(input.state)) throw new Error('invalid acquisition state');

  for (const key of ['runId', 'providerTrackId', 'observedAt']) requireString(input, key);

  if (!CANONICAL_UTC_ISO.test(input.observedAt) || new Date(input.observedAt).toISOString() !== input.observedAt) {
    throw new Error('observedAt must be canonical UTC ISO-8601');
  }

  if (input.state === 'verified') {
    if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 0 || !SHA256_HEX.test(input.sha256 ?? '')) {
      throw new Error('verified receipt requires byteLength and sha256');
    }
  } else {
    if (typeof input.reasonCode !== 'string' || !REASON_CODE.test(input.reasonCode)) {
      throw new Error('non-verified receipt requires reasonCode');
    }
  }

  if (input.sha256 !== undefined && !SHA256_HEX.test(input.sha256)) throw new Error('sha256 must be lowercase hex');
  if (input.rawMetadataSha256 !== undefined && !SHA256_HEX.test(input.rawMetadataSha256)) throw new Error('rawMetadataSha256 must be lowercase hex');

  return Object.freeze({ ...input });
}
