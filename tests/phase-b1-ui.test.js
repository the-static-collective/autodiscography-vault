import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('side panel preserves bounded live witness and keeps 25-track acquisition disabled', async () => {
  const html = await text('../extension/src/sidepanel/index.html');
  assert.match(html, /LIVE WITNESS/i);
  assert.match(html, /Refresh live witness/i);
  assert.match(html, /25-track/i);
  assert.match(html, /id="acquire-pilot"[^>]*disabled/i);
});

test('provider content script still performs observation only', async () => {
  const js = await text('../extension/src/provider/suno/content-script.js');
  assert.match(js, /vault:observe/);
  assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket|chrome\.downloads|chrome\.permissions/i.test(js), false);
});
