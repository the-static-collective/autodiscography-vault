import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('Phase B2 UI requires explicit transport enablement and keeps 25-track gate closed', async () => {
  const html = await text('../extension/src/sidepanel/index.html');
  assert.match(html, /Phase B2/i);
  assert.match(html, /Enable pilot transport/i);
  assert.match(html, /id="enable-transport"/i);
  assert.match(html, /id="transport-status"/i);
  assert.match(html, /id="acquire-pilot"[^>]*disabled/i);
  assert.match(html, /25-track[^<]*(?:closed|disabled|locked)|(?:closed|disabled|locked)[^<]*25-track/i);
});

test('Phase B2 side panel requests downloads permission only from the extension page and stages one observed asset', async () => {
  const js = await text('../extension/src/sidepanel/index.js');
  assert.match(js, /chrome\.permissions\.request\s*\(\s*\{\s*permissions:\s*\['downloads'\]/);
  assert.match(js, /chrome\.downloads\.download\s*\(/);
  assert.match(js, /conflictAction:\s*'uniquify'/);
  assert.match(js, /saveAs:\s*false/);
  assert.match(js, /Autodiscography-Vault/);
  assert.match(js, /requestDescriptorSha256/);
  assert.match(js, /transportUrl/);
  assert.match(js, /observedAt/);
  assert.match(js, /Observed at/);

  for (const forbidden of [
    /chrome\.storage/,
    /localStorage/,
    /sessionStorage/,
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /document\.cookie/,
    /headers\s*:/,
  ]) {
    assert.equal(forbidden.test(js), false, `side panel must not contain ${forbidden}`);
  }
});

test('optional downloads permission is requested before the gated downloads API is required', async () => {
  const js = await text('../extension/src/sidepanel/index.js');
  const start = js.indexOf('async function requestTransportPermission()');
  const end = js.indexOf('async function stageObservedAsset', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const fn = js.slice(start, end);
  const requestIndex = fn.indexOf('chrome.permissions.request');
  assert.notEqual(requestIndex, -1);

  const beforeGrant = fn.slice(0, requestIndex);
  assert.equal(/chrome\?\.downloads\?\.download|chrome\.downloads\.download/.test(beforeGrant), false,
    'downloads API must not be required before the optional downloads permission request');

  const afterGrant = fn.slice(requestIndex);
  assert.match(afterGrant, /chrome\?\.downloads\?\.download|chrome\.downloads\.download/,
    'downloads API availability should be checked after the optional permission grant');
});
