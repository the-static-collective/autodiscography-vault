import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { admitStagedAsset } from '../scripts/admit-staged-asset.js';

const observedAt = '2026-08-15T20:00:00.000Z';
const requestDescriptorSha256 = 'c'.repeat(64);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'vault-b2-admit-'));
  const staging = join(root, 'Downloads', 'Autodiscography-Vault', 'suno-b2-test');
  const vaultRoot = join(root, 'vault');
  await mkdir(staging, { recursive: true });
  const stagedFile = join(staging, 'audio_mp3.mp3');
  const bytes = Buffer.from('phase-b2-one-track-exact-bytes\n', 'utf8');
  await writeFile(stagedFile, bytes);
  return { root, stagedFile, vaultRoot, bytes };
}

async function wavFixture({ valid = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vault-b2c-wav-admit-'));
  const staging = join(root, 'Downloads');
  const vaultRoot = join(root, 'vault');
  await mkdir(staging, { recursive: true });
  const stagedFile = join(staging, 'master.wav');
  const bytes = valid
    ? Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WAVE', 'ascii'), Buffer.from('exact-wave-payload')])
    : Buffer.from('not-a-wave-container', 'utf8');
  await writeFile(stagedFile, bytes);
  return { stagedFile, vaultRoot, bytes };
}

function options({ stagedFile, vaultRoot }) {
  return {
    stagedFile,
    vaultRoot,
    runId: 'suno-b2-test',
    providerTrackId: 'track-alpha',
    assetRole: 'audio_mp3',
    observedAt,
    requestDescriptorSha256,
  };
}

test('staged bytes are verified, atomically promoted, journaled, handed off, and idempotently resumed', async () => {
  const { stagedFile, vaultRoot, bytes } = await fixture();
  const expectedSha256 = createHash('sha256').update(bytes).digest('hex');

  const first = await admitStagedAsset(options({ stagedFile, vaultRoot }));
  assert.equal(first.skippedExistingVerified, false);
  assert.equal(first.receipt.sha256, expectedSha256);
  assert.equal(first.receipt.byteLength, bytes.length);
  assert.equal(first.receipt.requestDescriptorSha256, requestDescriptorSha256);
  assert.equal(first.receipt.sourceRelativePath, 'assets/track-alpha/audio_mp3.mp3');
  assert.deepEqual(await readFile(first.finalPath), bytes);
  assert.equal(existsSync(`${first.finalPath}.partial`), false);

  const journal = (await readFile(join(vaultRoot, 'receipts', 'acquisition.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  assert.equal(journal.length, 1);
  assert.equal(journal[0].state, 'verified');
  assert.equal(journal[0].sha256, expectedSha256);
  assert.equal(journal[0].requestDescriptorSha256, requestDescriptorSha256);

  const handoff = JSON.parse(await readFile(join(vaultRoot, 'receipts', 'handoff.json'), 'utf8'));
  assert.equal(handoff.records.length, 1);
  assert.equal(handoff.records[0].asset.sha256, expectedSha256);
  assert.equal(handoff.records[0].requestDescriptorSha256, requestDescriptorSha256);
  assert.equal(JSON.stringify(handoff).includes('transportUrl'), false);

  const second = await admitStagedAsset(options({ stagedFile, vaultRoot }));
  assert.equal(second.skippedExistingVerified, true);
  const journalAfterSecond = (await readFile(join(vaultRoot, 'receipts', 'acquisition.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(journalAfterSecond.length, 1);

  await writeFile(first.finalPath, Buffer.from('corrupted-final'));
  await assert.rejects(
    () => admitStagedAsset(options({ stagedFile, vaultRoot })),
    /verification mismatch/,
  );
});

test('user-triggered WAV may omit a nonexistent request descriptor and still admit exact bytes', async () => {
  const { stagedFile, vaultRoot, bytes } = await wavFixture();
  const result = await admitStagedAsset({
    stagedFile,
    vaultRoot,
    runId: 'suno-b2c-wav-test',
    providerTrackId: 'track-wav',
    assetRole: 'audio_wav',
    observedAt,
  });

  assert.equal(result.receipt.assetRole, 'audio_wav');
  assert.equal(result.receipt.byteLength, bytes.length);
  assert.equal('requestDescriptorSha256' in result.receipt, false);
  assert.equal(result.receipt.sourceRelativePath, 'assets/track-wav/audio_wav.wav');

  const handoff = JSON.parse(await readFile(join(vaultRoot, 'receipts', 'handoff.json'), 'utf8'));
  assert.equal(handoff.records[0].requestDescriptorSha256, null);
});

test('fake .wav bytes are refused before a verified journal can be created', async () => {
  const { stagedFile, vaultRoot } = await wavFixture({ valid: false });
  const journalPath = join(vaultRoot, 'receipts', 'acquisition.jsonl');
  await assert.rejects(
    () => admitStagedAsset({
      stagedFile,
      vaultRoot,
      runId: 'suno-b2c-fake-wav',
      providerTrackId: 'track-fake-wav',
      assetRole: 'audio_wav',
      observedAt,
    }),
    /invalid WAV container/,
  );
  assert.equal(existsSync(journalPath), false);
});

test('invalid local admission inputs fail before journal mutation', async () => {
  const { stagedFile, vaultRoot } = await fixture();
  const journalPath = join(vaultRoot, 'receipts', 'acquisition.jsonl');

  await assert.rejects(
    () => admitStagedAsset({ ...options({ stagedFile, vaultRoot }), requestDescriptorSha256: 'BAD' }),
    /requestDescriptorSha256 must be lowercase SHA-256/,
  );
  assert.equal(existsSync(journalPath), false);

  await assert.rejects(
    () => admitStagedAsset({ ...options({ stagedFile, vaultRoot }), runId: 'token=reusable-secret' }),
    /secret-shaped value refused/,
  );
  assert.equal(existsSync(journalPath), false);

  await assert.rejects(
    () => admitStagedAsset({ ...options({ stagedFile, vaultRoot }), assetRole: 'made_up_role' }),
    /invalid assetRole/,
  );
  assert.equal(existsSync(journalPath), false);

  await assert.rejects(
    () => admitStagedAsset({ ...options({ stagedFile: `${stagedFile}.missing`, vaultRoot }) }),
    /staged file/i,
  );
  assert.equal(existsSync(journalPath), false);
});
