import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyBytes, assertMatchesReceipt } from '../packages/verifier/index.js';

test('hash and length are exact for known bytes', () => {
  const bytes = Buffer.from('alpha\n');
  const result = verifyBytes(bytes);
  assert.equal(result.byteLength, 6);
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.sha256, 'b6a98d9ce9a2d9149288fa3df42d377c3e42737afdcdaf714e33c0a100b51060');
});

test('one-byte corruption is refused', () => {
  const expected = verifyBytes(Buffer.from('alpha\n'));
  const actual = verifyBytes(Buffer.from('alphb\n'));
  assert.throws(() => assertMatchesReceipt(actual, expected), /verification mismatch/);
});

test('same filename is irrelevant when bytes differ', () => {
  assert.notEqual(verifyBytes(Buffer.from('one')).sha256, verifyBytes(Buffer.from('two')).sha256);
});
