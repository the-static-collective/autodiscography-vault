import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('MV3 Phase B2 keeps transport optional and Suno witness permanent', async () => {
  const manifest = JSON.parse(await text('../extension/manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal('host_permissions' in manifest, false);
  assert.deepEqual(manifest.permissions, ['sidePanel']);
  assert.deepEqual(manifest.optional_permissions, ['downloads']);
  assert.equal(manifest.side_panel.default_path, 'src/sidepanel/index.html');

  assert.equal(Array.isArray(manifest.content_scripts), true);
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    'https://suno.com/*',
    'https://www.suno.com/*',
  ]);
  assert.deepEqual(manifest.content_scripts[0].js, [
    'src/provider/suno/live-observer.js',
    'src/provider/suno/content-script.js',
  ]);

  const serialized = JSON.stringify(manifest);
  for (const forbidden of ['cookies', 'webRequest', 'declarativeNetRequest', '<all_urls>']) {
    assert.equal(serialized.includes(forbidden), false, `manifest must not request ${forbidden}`);
  }
});

test('toolbar action explicitly opens the registered Vault side panel', async () => {
  const manifest = JSON.parse(await text('../extension/manifest.json'));
  assert.equal(manifest.action.default_title, 'Open Autodiscography Vault');
  assert.equal(manifest.background.service_worker, 'src/background.js');

  const background = await text('../extension/src/background.js');
  assert.match(background, /chrome\.sidePanel\.setPanelBehavior\s*\(\s*\{\s*openPanelOnActionClick:\s*true\s*\}\s*\)/);
  assert.equal(/fetch\s*\(|chrome\.downloads|chrome\.cookies|webRequest|document\.cookie/i.test(background), false);
});

test('fixture adapter contains no network or browser-session primitive', async () => {
  const adapter = await text('../extension/src/provider/suno/fixture-adapter.js');
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket|chrome\.cookies|document\.cookie|authorization/i.test(adapter), false);
});

test('provider witness remains observation-only after Phase B2 transport is added to extension page', async () => {
  const contentScript = await text('../extension/src/provider/suno/content-script.js');
  const observer = await text('../extension/src/provider/suno/live-observer.js');
  const source = `${contentScript}\n${observer}`;
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket|chrome\.cookies|document\.cookie|webRequest|chrome\.downloads/i.test(source), false);
});
