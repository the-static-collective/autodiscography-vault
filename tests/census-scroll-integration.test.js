import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

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
    'function applyCensusScroll(message)',
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

test('content-script observation is side-effect free until an explicit post-persistence apply', async () => {
  const source = await text('../extension/src/provider/suno/content-script.js');
  const scrollCalls = [];
  let listener = null;
  const round = {
    schema: 'autodiscography-vault-census-scroll-round/v1',
    version: 1,
    runId: 'runtime-handshake',
    round: 1,
    observedAt: '2026-08-25T04:00:01.000Z',
    status: 'running',
    observations: [],
    action: { kind: 'scroll_to', scrollTop: 640 },
    checkpoint: { runId: 'runtime-handshake', round: 1 },
  };
  const scroller = {
    scrollTop: 0,
    clientHeight: 800,
    scrollHeight: 4800,
    scrollTo(action) {
      scrollCalls.push(action);
    },
  };
  const context = {
    URL,
    location: { origin: 'https://suno.com', href: 'https://suno.com/library' },
    document: { scrollingElement: scroller, documentElement: scroller },
    chrome: {
      runtime: {
        onMessage: {
          addListener(value) {
            listener = value;
          },
        },
      },
    },
    AutodiscographyVaultSuno: {
      extractSunoCensusCandidates() {
        return { candidates: [], candidateNodeCount: 0 };
      },
    },
    AutodiscographyVaultSunoCensusCardObserver: {
      buildCardCandidates() {
        return [];
      },
    },
    AutodiscographyVaultSunoCensusScroll: {
      advance() {
        return round;
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'content-script.js' });
  assert.equal(typeof listener, 'function');

  const send = message => {
    let response;
    listener(message, {}, value => { response = value; });
    return response;
  };
  const probe = send({ type: 'vault:census-scroll:probe' });
  assert.equal(probe.status, 'ready');
  assert.equal(probe.candidateNodeCount, 0);
  assert.match(probe.renderSignature, /^[a-f0-9]{8}$/);
  assert.equal(probe.scrollMetrics.scrollTop, 0);

  const freshApply = send({
    type: 'vault:census-scroll:apply',
    runId: round.runId,
    round: round.round,
    action: round.action,
  });
  assert.equal(freshApply.status, 'refused', 'a fresh document has no observed action to apply');
  assert.deepEqual(scrollCalls, []);

  const observed = send({
    type: 'vault:census-scroll:advance',
    checkpoint: { runId: 'runtime-handshake', round: 0 },
    observedAt: round.observedAt,
  });
  assert.equal(observed, round);
  assert.deepEqual(scrollCalls, [], 'advance must only observe and propose an action');

  const mismatched = send({
    type: 'vault:census-scroll:apply',
    runId: round.runId,
    round: round.round + 1,
    action: round.action,
  });
  assert.equal(mismatched.status, 'refused');
  assert.deepEqual(scrollCalls, [], 'a mismatched run/round cannot consume the pending action');

  assert.equal(send({
    type: 'vault:census-scroll:apply',
    runId: round.runId,
    round: round.round,
    action: round.action,
  }).status, 'applied');
  assert.equal(scrollCalls.length, 1);
  assert.equal(scrollCalls[0].top, 640);
  assert.equal(scrollCalls[0].behavior, 'auto');

  send({
    type: 'vault:census-scroll:advance',
    checkpoint: { runId: 'runtime-handshake', round: 0 },
    observedAt: round.observedAt,
  });
  scroller.clientHeight = 700;
  const resized = send({
    type: 'vault:census-scroll:apply',
    runId: round.runId,
    round: round.round,
    action: round.action,
  });
  assert.equal(resized.status, 'refused', 'viewport drift invalidates an observed pending action');
  assert.equal(scrollCalls.length, 1);

  scroller.clientHeight = 800;
  send({
    type: 'vault:census-scroll:advance',
    checkpoint: { runId: 'runtime-handshake', round: 0 },
    observedAt: round.observedAt,
  });
  context.location.href = 'https://suno.com/create';
  const navigated = send({
    type: 'vault:census-scroll:apply',
    runId: round.runId,
    round: round.round,
    action: round.action,
  });
  assert.equal(navigated.status, 'refused', 'navigation invalidates an observed pending action');
  assert.equal(scrollCalls.length, 1, 'a stale action cannot move a different Suno surface');
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
  const settledAt = advancePhase.indexOf('await waitForCensusScrollSettled', appliedAt);
  const scheduledAt = advancePhase.indexOf('setTimeout(advanceCensusScroll', settledAt);
  assert.ok(settledAt > appliedAt && scheduledAt > settledAt,
    'the next round must wait for acknowledged rendered-state stability after scrolling');

  const downloadWait = between(
    panel,
    'async function waitForDownloadCompletion(downloadId)',
    'async function persistCensusRound(roundResult)',
  );
  assert.ok(
    downloadWait.indexOf('Number.isSafeInteger(downloadId)')
      < downloadWait.indexOf('chrome.downloads.search'),
    'a download ID must be validated before it reaches the browser lookup boundary',
  );

  const startPhase = between(panel, 'async function startCensusScroll()', 'function extensionForAsset');
  const resetSettledAt = startPhase.indexOf('await waitForCensusScrollSettled');
  const firstScheduledAt = startPhase.indexOf('setTimeout(advanceCensusScroll', resetSettledAt);
  assert.ok(resetSettledAt >= 0 && firstScheduledAt > resetSettledAt,
    'the first observation must wait for acknowledged reset-to-top DOM stability');
  assert.equal(startPhase.includes('await advanceCensusScroll()'), false);
  const settlePhase = between(
    panel,
    'async function waitForCensusScrollSettled',
    'async function advanceCensusScroll()',
  );
  assert.match(settlePhase, /stableProbes/);
  assert.match(settlePhase, /maxWaitMs/);
  assert.match(settlePhase, /requiredTop/);
  assert.match(settlePhase, /vault:census-scroll:probe/);
  assert.equal(/chrome\.storage|localStorage|sessionStorage/.test(panel), false);
  assert.equal(/provider_complete/.test(`${html}\n${panel}`), false);
});

test('side panel invalidates stale async rounds before a Stop-to-Start replacement can apply them', async () => {
  const panel = await text('../extension/src/sidepanel/index.js');
  assert.match(panel, /let censusScrollGeneration = 0/);

  const stopPhase = between(panel, 'function stopCensusScroll(status)', 'function safeCensusDownloadName');
  assert.match(stopPhase, /censusScrollGeneration \+= 1/,
    'stopping or replacing a run must invalidate every in-flight async continuation');

  const advancePhase = between(
    panel,
    'async function advanceCensusScroll()',
    'async function startCensusScroll()',
  );
  const capturedAt = advancePhase.indexOf('const generation = censusScrollGeneration');
  const persistedAt = advancePhase.indexOf('await persistCensusRound');
  const guardedAt = advancePhase.indexOf('if (!isCurrentCensusScroll(generation)) return', persistedAt);
  const appliedAt = advancePhase.indexOf('await applyCensusScrollAction');
  assert.ok(capturedAt >= 0 && persistedAt > capturedAt && guardedAt > persistedAt && appliedAt > guardedAt,
    'a stale durable completion must exit before overwriting or applying into a replacement run');

  const startPhase = between(panel, 'async function startCensusScroll()', 'function extensionForAsset');
  const activeAt = startPhase.indexOf('setCensusScrollActive(true)');
  const firstAwaitAt = startPhase.indexOf('await ');
  assert.ok(activeAt >= 0 && activeAt < firstAwaitAt,
    'Start must disable duplicate starts before its first asynchronous boundary');
  assert.match(startPhase, /const generation = censusScrollGeneration/);
  assert.ok((startPhase.match(/isCurrentCensusScroll\(generation\)/g) ?? []).length >= 3,
    'permission, tab lookup, and create continuations must all refuse stale starts');
});
