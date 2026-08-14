import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('side panel exposes live witness but keeps acquisition disabled', async () => {
  const html = await text('../extension/src/sidepanel/index.html');
  assert.match(html, /LIVE WITNESS/i);
  assert.match(html, /Refresh live witness/i);
  assert.match(html, /25-track/i);
  assert.match(html, /transport disabled/i);
  assert.match(html, /id="acquire-pilot"[^>]*disabled/i);
});

test('side panel code requests bounded observation and never initiates acquisition', async () => {
  const js = await text('../extension/src/sidepanel/index.js');
  assert.match(js, /vault:observe/);
  assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket/i.test(js), false);
  assert.equal(/vault:acquire|download|chrome\.downloads/i.test(js), false);
});
