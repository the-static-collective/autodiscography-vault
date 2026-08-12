import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendJournalEntry, readJournal, latestReceiptForKey } from '../packages/journal/index.js';
import { makeAcquisitionKey } from '../packages/acquisition-contract/index.js';

const base = state => ({
  schemaVersion: 1,
  runId: 'r1',
  provider: 'suno',
  providerTrackId: 't1',
  assetRole: 'audio_mp3',
  state,
  observedAt: '2026-08-12T00:00:00.000Z',
});

test('append preserves prior history and latest is derived', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-'));
  const path = join(dir, 'journal.jsonl');
  await appendJournalEntry(path, { ...base('partial'), reasonCode: 'interrupted' });
  await appendJournalEntry(path, { ...base('verified'), byteLength: 3, sha256: 'a'.repeat(64) });
  const entries = await readJournal(path);
  assert.equal(entries.length, 2);
  assert.equal(latestReceiptForKey(entries, makeAcquisitionKey(entries[0])).state, 'verified');
  assert.equal((await readFile(path, 'utf8')).trim().split('\n').length, 2);
});

test('missing journal is an empty history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-'));
  assert.deepEqual(await readJournal(join(dir, 'missing.jsonl')), []);
});

test('malformed journal line fails closed with line number', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-'));
  const path = join(dir, 'journal.jsonl');
  await writeFile(path, `${JSON.stringify({ ...base('partial'), reasonCode: 'interrupted' })}\n{broken\n`);
  await assert.rejects(() => readJournal(path), /journal line 2 is invalid JSON/);
});

test('non-newline-terminated journal fails as truncated', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-'));
  const path = join(dir, 'journal.jsonl');
  await writeFile(path, JSON.stringify({ ...base('partial'), reasonCode: 'interrupted' }));
  await assert.rejects(() => readJournal(path), /journal is truncated/);
});
