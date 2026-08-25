import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPowerShellAdmitCommand } from '../extension/src/sidepanel/powershell-handoff.js';

const base = Object.freeze({
  stagedFile: "C:\\Users\\Example User\\Downloads\\Song's master.wav",
  vaultRoot: 'E:\\Autodiscography-Vault',
  runId: 'suno-b2c-test',
  providerTrackId: 'track-alpha',
  assetRole: 'audio_wav',
  observedAt: '2026-08-15T21:00:00.000Z',
});

test('PowerShell handoff quotes local paths and omits nonexistent request evidence', () => {
  const command = formatPowerShellAdmitCommand(base);
  assert.match(command, /^npm run pilot:admit -- /);
  assert.match(command, /--staged-file 'C:\\Users\\Example User\\Downloads\\Song''s master\.wav'/);
  assert.match(command, /--vault-root 'E:\\Autodiscography-Vault'/);
  assert.match(command, /--run-id 'suno-b2c-test'/);
  assert.match(command, /--provider-track-id 'track-alpha'/);
  assert.match(command, /--asset-role 'audio_wav'/);
  assert.match(command, /--observed-at '2026-08-15T21:00:00\.000Z'/);
  assert.equal(command.includes('--request-descriptor-sha256'), false);
  assert.equal(command.includes('\n'), false);
});

test('PowerShell handoff includes a supplied bounded request descriptor hash', () => {
  const requestDescriptorSha256 = 'a'.repeat(64);
  const command = formatPowerShellAdmitCommand({ ...base, requestDescriptorSha256 });
  assert.match(command, new RegExp(`--request-descriptor-sha256 '${requestDescriptorSha256}'$`));
});

test('PowerShell handoff refuses secret-shaped durable values', () => {
  assert.throws(
    () => formatPowerShellAdmitCommand({ ...base, runId: 'token=reusable-secret' }),
    /unsafe handoff value/,
  );
  assert.throws(
    () => formatPowerShellAdmitCommand({ ...base, vaultRoot: 'Bearer reusable-secret' }),
    /unsafe handoff value/,
  );
});
