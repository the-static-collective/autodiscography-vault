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

  const assignments = [...js.matchAll(/activeDownload\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/g)];
  assert.ok(assignments.length >= 2, 'both direct and user-WAV active download states should be explicit');
  for (const [, body] of assignments) {
    assert.equal(/\b(?:url|finalUrl|referrer)\s*:/.test(body), false,
      'bound active download state must not carry URL/referrer capability');
  }
});

test('a terminal download clears the one-shot WAV arm before async completed-path lookup', async () => {
  const js = await text('../extension/src/sidepanel/index.js');
  const start = js.indexOf('async function observeDownloadChanges(delta)');
  const end = js.indexOf('async function copyAdmissionCommand()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = js.slice(start, end);

  const activeClear = fn.indexOf('activeDownload = null;');
  const armClear = fn.indexOf('armedWavWitness = null;', activeClear);
  const completedLookup = fn.indexOf('await completedDownloadItem', activeClear);
  assert.notEqual(activeClear, -1);
  assert.notEqual(armClear, -1);
  assert.notEqual(completedLookup, -1);
  assert.ok(armClear < completedLookup,
    'terminal state must disarm the one-shot witness before yielding to the async filename lookup');
});

test('completed staging exposes a temporary safe Windows admission handoff without new browser authority', async () => {
  const html = await text('../extension/src/sidepanel/index.html');
  const js = await text('../extension/src/sidepanel/index.js');

  assert.match(html, /Vault root for local admission/i);
  assert.match(html, /id="vault-root"/i);
  assert.match(html, /E:\\Autodiscography-Vault/);
  assert.match(html, /id="admit-command"/i);
  assert.match(html, /id="copy-admit-command"[^>]*disabled/i);
  assert.match(html, /temporary[^<]*proof|proof[^<]*temporary/i);
  assert.match(html, /local companion/i);

  assert.match(js, /formatPowerShellAdmitCommand/);
  assert.match(js, /completedStaging/);
  assert.match(js, /navigator\.clipboard\.writeText\s*\(/);
  assert.match(js, /Copy unavailable; command remains visible\./);
  assert.match(js, /chrome\.downloads\.search\s*\(\s*\{\s*id:/);
  const permissionCall = js.match(/chrome\.permissions\.request\s*\(\s*\{([\s\S]*?)\}\s*\)/)?.[1] ?? '';
  assert.equal(/clipboard/i.test(permissionCall), false,
    'copying the command must not add clipboard extension permission');
});
