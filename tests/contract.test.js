import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReceipt, makeAcquisitionKey } from '../packages/acquisition-contract/index.js';

const base = {
  schemaVersion: 1,
  runId: 'pilot-001',
  provider: 'suno',
  providerTrackId: 'track-alpha',
  assetRole: 'audio_mp3',
  state: 'verified',
  observedAt: '2026-08-12T00:00:00.000Z',
};

test('verified receipt requires exact hash and byte length', () => {
  assert.throws(() => validateReceipt(base), /verified receipt requires byteLength and sha256/);
});

test('non-verified receipt requires a bounded reason code', () => {
  assert.throws(() => validateReceipt({ ...base, state: 'partial' }), /non-verified receipt requires reasonCode/);
});

test('secret-shaped fields fail closed without echoing value', () => {
  const secret = 'Bearer SUPER-SECRET';
  assert.throws(
    () => validateReceipt({ ...base, authorization: secret }),
    error => !String(error.message).includes(secret) && /secret-shaped field refused/.test(error.message),
  );
});

test('secret-shaped values fail closed without echoing value', () => {
  const secret = 'Bearer SUPER-SECRET';
  assert.throws(
    () => validateReceipt({ ...base, state: 'refused', reasonCode: secret }),
    error => !String(error.message).includes(secret) && /secret-shaped value refused/.test(error.message),
  );
});

test('unknown receipt fields are rejected', () => {
  assert.throws(() => validateReceipt({ ...base, byteLength: 3, sha256: 'a'.repeat(64), diagnostic: 'x' }), /unknown receipt field: diagnostic/);
});

test('observedAt must be canonical UTC ISO-8601', () => {
  assert.throws(() => validateReceipt({ ...base, observedAt: '08/12/2026', byteLength: 3, sha256: 'a'.repeat(64) }), /observedAt must be canonical UTC ISO-8601/);
});

test('acquisition key is run + track + role', () => {
  assert.equal(makeAcquisitionKey({ runId: 'r', providerTrackId: 't', assetRole: 'lyrics' }), 'r\u0000t\u0000lyrics');
});

test('validated receipt is frozen', () => {
  const receipt = validateReceipt({ ...base, byteLength: 3, sha256: 'a'.repeat(64) });
  assert.equal(Object.isFrozen(receipt), true);
});

test('non-verified receipt cannot carry admitted asset hash or byte length', () => {
  assert.throws(
    () => validateReceipt({
      ...base,
      state: 'partial',
      reasonCode: 'interrupted',
      byteLength: 3,
      sha256: 'a'.repeat(64),
    }),
    /non-verified receipt cannot carry byteLength or sha256/,
  );
});
