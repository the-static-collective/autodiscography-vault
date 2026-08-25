import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test('manifest loads pure census seams before the Suno message adapter', async () => {
  const manifest = JSON.parse(await text('../extension/manifest.json'));
  assert.deepEqual(manifest.content_scripts[0].js, [
    'src/provider/suno/live-observer.js',
    'src/provider/suno/census-card-observer.js',
    'src/provider/suno/census-scroll.js',
    'src/provider/suno/content-script.js',
  ]);
});

test('content script advances one explicit auto-scroll round without network or durable authority', async () => {
  const source = await text('../extension/src/provider/suno/content-script.js');
  assert.match(source, /vault:census-scroll:create/);
  assert.match(source, /vault:census-scroll:advance/);
  assert.match(source, /vault:census-scroll:apply/);
  assert.match(source, /extractSunoCensusCandidates/);
  assert.match(source, /buildCardCandidates/);
  assert.match(source, /censusScroll\.advance/);
  assert.match(source, /scrollTo/);

  const observationPhase = between(
    source,
    'function advanceCensusScroll(message)',
    'chrome.runtime.onMessage.addListener',
  );
  assert.equal(/scrollTo\s*\(/.test(observationPhase), false,
    'observing a round must not mutate the UI before its raw segment is durable');
  for (const forbidden of [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /chrome\.storage/,
    /localStorage/,
    /sessionStorage/,
    /chrome\.cookies/,
    /chrome\.downloads/,
  ]) {
    assert.equal(forbidden.test(source), false, `content script must not contain ${forbidden}`);
  }
});

test('side panel exposes operator-started resumable census and persists every round before advancing', async () => {
  const html = await text('../extension/src/sidepanel/index.html');
  const panel = await text('../extension/src/sidepanel/index.js');
  assert.match(html, /id="census-scroll-start"/);
  assert.match(html, /id="census-scroll-stop"[^>]*disabled/);
  assert.match(html, /id="census-scroll-resume"[^>]*type="file"/);
  assert.match(html, /ui_exhausted/);
  assert.match(panel, /vault:census-scroll:create/);
  assert.match(panel, /vault:census-scroll:advance/);
  assert.match(panel, /vault:census-scroll:apply/);
  assert.match(panel, /buildCensusScrollSegment/);
  assert.match(panel, /chrome\.downloads\.download/);
  assert.match(panel, /new Blob/);
  assert.match(panel, /URL\.createObjectURL/);
  assert.match(panel, /setTimeout/);

  const advancePhase = between(
    panel,
    'async function advanceCensusScroll()',
    'async function startCensusScroll()',
  );
  const persistedAt = advancePhase.indexOf('await persistCensusRound');
  const appliedAt = advancePhase.indexOf('await applyCensusScrollAction');
  assert.ok(persistedAt >= 0 && appliedAt > persistedAt,
    'the side panel must durably persist a round before applying its scroll action');

  const startPhase = between(panel, 'async function startCensusScroll()', 'function extensionForAsset');
  assert.match(startPhase, /setTimeout\(advanceCensusScroll, 1400\)/,
    'the first observation must wait for the reset-to-top DOM to settle');
  assert.equal(startPhase.includes('await advanceCensusScroll()'), false);
  assert.equal(/chrome\.storage|localStorage|sessionStorage/.test(panel), false);
  assert.equal(/provider_complete/.test(`${html}\n${panel}`), false);
});
