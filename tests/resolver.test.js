import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { validateReceipt } from '../packages/acquisition-contract/index.js';
import { appendJournalEntry } from '../packages/journal/index.js';
import {
  parseAddress,
  ResolverError,
  resolveVerifiedAudio,
} from '../packages/resolver/index.js';

async function makeVault({ tamper = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vault-resolver-'));
  const assetDir = join(root, 'assets', 'track-wav');
  const receiptDir = join(root, 'receipts');
  await mkdir(assetDir, { recursive: true });
  await mkdir(receiptDir, { recursive: true });

  const goodBytes = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WAVE', 'ascii'),
    Buffer.from('resolver-wave-payload'),
  ]);
  const sha256 = createHash('sha256').update(goodBytes).digest('hex');
  const assetPath = join(assetDir, 'audio_wav.wav');
  await writeFile(assetPath, tamper ? Buffer.from('tampered') : goodBytes);

  const receipt = validateReceipt({
    schemaVersion: 1,
    runId: 'resolver-test',
    provider: 'suno',
    providerTrackId: 'track-wav',
    assetRole: 'audio_wav',
    state: 'verified',
    observedAt: '2026-10-01T19:40:00.000Z',
    sourceRelativePath: 'assets/track-wav/audio_wav.wav',
    byteLength: goodBytes.byteLength,
    sha256,
  });
  await appendJournalEntry(join(receiptDir, 'acquisition.jsonl'), receipt);

  return { root, sha256, goodBytes };
}

test('content address resolves only after local byte re-verification', async () => {
  const { root, sha256, goodBytes } = await makeVault();
  const descriptor = await resolveVerifiedAudio(root, `sha256:${sha256}`);

  assert.equal(descriptor.status, 'resolved-verified');
  assert.equal(descriptor.address, `sha256:${sha256}`);
  assert.equal(descriptor.byteLength, goodBytes.byteLength);
  assert.equal(descriptor.mediaType, 'audio/wav');
  assert.equal(descriptor.authority, 'none');
  assert.ok(descriptor.boundary.includes('RESOLUTION REQUIRES BYTE REVERIFICATION'));
});

test('tampered bytes refuse resolution even when journal still says verified', async () => {
  const { root, sha256 } = await makeVault({ tamper: true });

  await assert.rejects(
    () => resolveVerifiedAudio(root, `sha256:${sha256}`),
    error => error instanceof ResolverError && error.code === 'BYTE_MISMATCH',
  );
});

test('unknown content address is not invented', async () => {
  const { root } = await makeVault();

  await assert.rejects(
    () => resolveVerifiedAudio(root, 'sha256:' + 'f'.repeat(64)),
    error => error instanceof ResolverError && error.code === 'NOT_FOUND',
  );
});

test('address syntax is strict', () => {
  assert.throws(
    () => parseAddress('https://example.com/song.wav'),
    error => error instanceof ResolverError && error.code === 'INVALID_ADDRESS',
  );
});

test('duplicate verified paths for one digest fail ambiguous', async () => {
  const { root, sha256, goodBytes } = await makeVault();
  const secondPath = join(root, 'assets', 'other-track', 'audio_wav.wav');
  await mkdir(join(root, 'assets', 'other-track'), { recursive: true });
  await writeFile(secondPath, goodBytes);

  await appendJournalEntry(
    join(root, 'receipts', 'acquisition.jsonl'),
    validateReceipt({
      schemaVersion: 1,
      runId: 'resolver-test-2',
      provider: 'suno',
      providerTrackId: 'other-track',
      assetRole: 'audio_wav',
      state: 'verified',
      observedAt: '2026-10-01T19:41:00.000Z',
      sourceRelativePath: 'assets/other-track/audio_wav.wav',
      byteLength: goodBytes.byteLength,
      sha256,
    }),
  );

  await assert.rejects(
    () => resolveVerifiedAudio(root, `sha256:${sha256}`),
    error => error instanceof ResolverError && error.code === 'AMBIGUOUS_ADDRESS',
  );
});
