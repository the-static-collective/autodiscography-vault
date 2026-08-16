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
  assert.match(html, /Witness one WAV/i);
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

test('optional downloads permission is requested before any gated downloads API is required', async () => {
  const js = await text('../extension/src/sidepanel/index.js');
  const start = js.indexOf('async function requestTransportPermission()');
  const end = js.indexOf('async function stageObservedAsset', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const fn = js.slice(start, end);
  const requestIndex = fn.indexOf('chrome.permissions.request');
  assert.notEqual(requestIndex, -1);

  const beforeGrant = fn.slice(0, requestIndex);
  assert.equal(/chrome\?\.downloads|chrome\.downloads/.test(beforeGrant), false,
    'downloads APIs must not be required before the optional permission request');

  const afterGrant = fn.slice(requestIndex);
  assert.match(afterGrant, /chrome\?\.downloads\?\.download|chrome\.downloads\.download/,
    'download capability should be checked after the optional permission grant');
  assert.match(afterGrant, /chrome\?\.downloads\?\.search|chrome\.downloads\.search/,
    'download search capability should be checked after the optional permission grant');
  assert.match(afterGrant, /chrome\?\.downloads\?\.onCreated|chrome\.downloads\.onCreated/,
    'download creation events should be checked after the optional permission grant');
});

test('one-shot WAV witness binds a future Chrome download without persisting transport capability', async () => {
  const js = await text('../extension/src/sidepanel/index.js');
  assert.match(js, /bindCreatedWav/);
  assert.match(js, /isWavDownloadItem/);
  assert.match(js, /chrome\.downloads\.onCreated\.addListener\s*\(\s*observeCreatedDownload/);
  assert.match(js, /chrome\.downloads\.search\s*\(\s*\{\s*id:/);
  assert.match(js, /audio_wav/);
  assert.match(js, /wav_witness_ambiguous/);
  assert.match(js, /request descriptor unavailable by design/i);
  assert.match(js, /armedWavWitness/);
  assert.equal(/activeDownload\s*=\s*Object\.freeze\([\s\S]*?\b(?:url|finalUrl|referrer)\s*:/.test(js), false,
    'bound active download state must not carry URL/referrer capability');
});
