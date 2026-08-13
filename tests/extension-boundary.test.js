import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('MV3 shell has no live-origin or cookie authority', async () => {
  const manifest = JSON.parse(await text('../extension/manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal('host_permissions' in manifest, false);
  assert.equal((manifest.permissions ?? []).includes('cookies'), false);
  assert.deepEqual(manifest.permissions, ['sidePanel']);
  assert.equal(manifest.side_panel.default_path, 'src/sidepanel/index.html');
});

test('fixture adapter contains no network or browser-session primitive', async () => {
  const adapter = await text('../extension/src/provider/suno/fixture-adapter.js');
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket|chrome\.cookies|document\.cookie|authorization/i.test(adapter), false);
});

test('side panel permanently declares the Phase-A lock', async () => {
  const html = await text('../extension/src/sidepanel/index.html');
  assert.match(html, /SYNTHETIC ONLY/);
  assert.match(html, /Locked until Phase-A receipt passes/);
  assert.match(html, /disabled/);
});
