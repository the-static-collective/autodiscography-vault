import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSyntheticPilot } from '../scripts/synthetic-pilot.js';

test('synthetic pilot interrupts, resumes, verifies, and then skips the verified final', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'vault-pilot-'));
  const summary = await runSyntheticPilot({ outputRoot });

  assert.equal(summary.verifiedAssets, 2);
  assert.equal(summary.partialEntries, 1);
  assert.equal(summary.missingEntries, 1);
  assert.equal(summary.historyEntries, 4);
  assert.equal(summary.skippedExistingVerified, true);
  assert.match(summary.audio.sha256, /^[a-f0-9]{64}$/);
  assert.equal(summary.audio.byteLength > 0, true);
});
