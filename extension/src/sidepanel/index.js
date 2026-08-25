import { listSyntheticTracks } from '../provider/suno/fixture-adapter.js';
import {
  buildCensusScrollSegment,
  parseCensusScrollSegment,
  serializeCensusScrollSegment,
} from './census-scroll-segment.js';
import { formatPowerShellAdmitCommand } from './powershell-handoff.js';
import { bindCreatedWav, isWavDownloadItem } from './wav-witness.js';

const syntheticHost = document.querySelector('#tracks');
const liveHost = document.querySelector('#live-tracks');
const liveStatus = document.querySelector('#live-status');
const liveCount = document.querySelector('#live-count');
const refreshLive = document.querySelector('#refresh-live');
const enableTransport = document.querySelector('#enable-transport');
const transportStatus = document.querySelector('#transport-status');
const vaultRootInput = document.querySelector('#vault-root');
const admitCommand = document.querySelector('#admit-command');
const copyAdmitCommand = document.querySelector('#copy-admit-command');
const censusScrollStart = document.querySelector('#census-scroll-start');
const censusScrollStop = document.querySelector('#census-scroll-stop');
const censusScrollResume = document.querySelector('#census-scroll-resume');
const censusScrollStatus = document.querySelector('#census-scroll-status');

let latestObservation = null;
let transportEnabled = false;
let selectedProviderTrackId = null;
let activeDownload = null;
let armedWavWitness = null;
let completedStaging = null;
let censusScrollActive = false;
let censusScrollTimer = null;
let censusScrollCheckpoint = null;
let censusScrollTabId = null;
let censusScrollGeneration = 0;
let censusScrollSurfaceBinding = null;

function appendField(article, label, value) {
  const row = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  row.append(strong, document.createTextNode(value ?? 'unknown'));
  article.append(row);
}

function renderSyntheticProof() {
  for (const track of listSyntheticTracks()) {
    const article = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = track.title;

    const id = document.createElement('code');
    id.textContent = track.providerTrackId;

    const assets = document.createElement('p');
    assets.textContent = `Proposed assets: ${track.proposedAssets.join(', ')}`;

    article.append(title, id, assets);
    if (track.missingAssets?.length) {
      const missing = document.createElement('p');
      missing.textContent = `Explicitly missing in fixture: ${track.missingAssets.join(', ')}`;
      article.append(missing);
    }
    syntheticHost.append(article);
  }
}

function safePathSegment(value, fallback) {
  const bounded = typeof value === 'string' ? value.slice(0, 128) : '';
  const safe = bounded.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+$/, '_');
  return safe || fallback;
}

function runId() {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  const random = new Uint8Array(4);
  crypto.getRandomValues(random);
  const suffix = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return `suno-b2-${timestamp}-${suffix}`;
}

function censusRunId() {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  const random = new Uint8Array(4);
  crypto.getRandomValues(random);
  const suffix = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return `suno-census-${timestamp}-${suffix}`;
}

function setCensusScrollActive(active) {
  censusScrollActive = active;
  censusScrollStart.disabled = active;
  censusScrollStop.disabled = !active;
  censusScrollResume.disabled = active;
}

function stopCensusScroll(status) {
  censusScrollGeneration += 1;
  if (censusScrollTimer !== null) clearTimeout(censusScrollTimer);
  censusScrollTimer = null;
  censusScrollCheckpoint = null;
  censusScrollTabId = null;
  censusScrollSurfaceBinding = null;
  setCensusScrollActive(false);
  if (status) censusScrollStatus.textContent = status;
}

function isCurrentCensusScroll(generation) {
  return censusScrollActive && generation === censusScrollGeneration;
}

function stopCensusScrollIfCurrent(generation, status) {
  if (isCurrentCensusScroll(generation)) stopCensusScroll(status);
}

function safeCensusDownloadName(checkpoint) {
  const safeRunId = safePathSegment(checkpoint.runId, 'unknown-census-run');
  const round = String(checkpoint.round).padStart(6, '0');
  return `Autodiscography-Vault/${safeRunId}/census/round-${round}.json`;
}

async function waitForDownloadCompletion(downloadId) {
  if (!Number.isSafeInteger(downloadId) || downloadId < 0) {
    throw new Error('invalid census segment download ID');
  }
  const terminalState = async () => {
    const [item] = await chrome.downloads.search({ id: downloadId });
    return item?.state ?? null;
  };
  const initial = await terminalState();
  if (initial === 'complete') return;
  if (initial === 'interrupted') throw new Error('segment download interrupted');

  await new Promise((resolve, reject) => {
    const finish = (error) => {
      chrome.downloads.onChanged.removeListener(listener);
      if (error) reject(error);
      else resolve();
    };
    const listener = (delta) => {
      if (delta?.id !== downloadId || !delta.state?.current) return;
      if (delta.state.current === 'complete') finish();
      else if (delta.state.current === 'interrupted') finish(new Error('segment download interrupted'));
    };
    chrome.downloads.onChanged.addListener(listener);
    terminalState()
      .then((state) => {
        if (state === 'complete') finish();
        else if (state === 'interrupted') finish(new Error('segment download interrupted'));
      })
      .catch(() => finish(new Error('segment download state unavailable')));
  });
}

async function persistCensusRound(roundResult) {
  const segment = buildCensusScrollSegment(roundResult);
  const body = serializeCensusScrollSegment(segment);
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename: safeCensusDownloadName(segment.checkpoint),
      conflictAction: 'uniquify',
      saveAs: false,
    });
    await waitForDownloadCompletion(downloadId);
  } finally {
    URL.revokeObjectURL(url);
  }
  return segment;
}

function validatedCensusSurfaceBinding(binding) {
  if (
    !binding
    || typeof binding !== 'object'
    || typeof binding.documentNonce !== 'string'
    || !/^[a-f0-9]{32}$/.test(binding.documentNonce)
    || typeof binding.routeIdentity !== 'string'
    || binding.routeIdentity.length > 2048
  ) throw new Error('invalid census surface binding');
  const route = new URL(binding.routeIdentity);
  if (
    route.protocol !== 'https:'
    || !['suno.com', 'www.suno.com'].includes(route.hostname)
    || route.username
    || route.password
    || route.search
    || route.hash
    || `${route.origin}${route.pathname}` !== binding.routeIdentity
  ) throw new Error('invalid census surface binding');
  return Object.freeze({
    documentNonce: binding.documentNonce,
    routeIdentity: binding.routeIdentity,
  });
}

async function applyCensusScrollAction({ action, runId, round, tabId, surfaceBinding }) {
  const safeSurfaceBinding = validatedCensusSurfaceBinding(surfaceBinding);
  if (
    !Number.isSafeInteger(tabId)
    || tabId < 0
    || typeof runId !== 'string'
    || !runId
    || !Number.isSafeInteger(round)
    || round < 1
    || action?.kind !== 'scroll_to'
    || !Number.isFinite(action.scrollTop)
    || action.scrollTop < 0
  ) throw new Error('invalid census scroll action');
  const applied = await chrome.tabs.sendMessage(tabId, {
    type: 'vault:census-scroll:apply',
    runId,
    round,
    action,
    surfaceBinding: safeSurfaceBinding,
  });
  if (applied?.status !== 'applied') throw new Error('census scroll action was not applied');
}

function validatedSettleProbe(probe, requiredTop, surfaceBinding) {
  const safeProbeBinding = validatedCensusSurfaceBinding(probe?.surfaceBinding);
  if (
    probe?.status !== 'ready'
    || !Number.isSafeInteger(probe.candidateNodeCount)
    || probe.candidateNodeCount < 0
    || typeof probe.renderSignature !== 'string'
    || !/^[a-f0-9]{8}$/.test(probe.renderSignature)
    || !probe.scrollMetrics
  ) throw new Error('invalid census scroll settle probe');
  if (
    safeProbeBinding.documentNonce !== surfaceBinding.documentNonce
    || safeProbeBinding.routeIdentity !== surfaceBinding.routeIdentity
  ) throw new Error('census scroll surface changed while settling');
  const { scrollTop, viewportHeight, scrollHeight } = probe.scrollMetrics;
  for (const value of [scrollTop, viewportHeight, scrollHeight]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('invalid census scroll settle metrics');
  }
  return {
    atRequiredTop: requiredTop === null || Math.abs(scrollTop - requiredTop) <= 1,
    signature: JSON.stringify([
      scrollTop,
      viewportHeight,
      scrollHeight,
      probe.candidateNodeCount,
      probe.renderSignature,
    ]),
  };
}

async function waitForCensusScrollSettled({
  generation,
  tabId,
  runId,
  surfaceBinding,
  requiredTop = null,
  minWaitMs = 600,
  maxWaitMs = 10_000,
  stableProbes = 3,
} = {}) {
  const safeSurfaceBinding = validatedCensusSurfaceBinding(surfaceBinding);
  if (typeof runId !== 'string' || !runId) throw new Error('invalid census run binding');
  const startedAt = Date.now();
  let priorSignature = null;
  let consecutiveStableProbes = 0;
  while (isCurrentCensusScroll(generation)) {
    const probe = await chrome.tabs.sendMessage(tabId, {
      type: 'vault:census-scroll:probe',
      runId,
      surfaceBinding: safeSurfaceBinding,
    });
    if (!isCurrentCensusScroll(generation)) return false;
    const validated = validatedSettleProbe(probe, requiredTop, safeSurfaceBinding);
    if (validated.atRequiredTop && validated.signature === priorSignature) {
      consecutiveStableProbes += 1;
    } else {
      consecutiveStableProbes = validated.atRequiredTop ? 1 : 0;
      priorSignature = validated.signature;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= minWaitMs && consecutiveStableProbes >= stableProbes) return true;
    if (elapsed >= maxWaitMs) throw new Error('census scroll surface did not settle');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
}

async function advanceCensusScroll() {
  if (
    !censusScrollActive
    || censusScrollTabId === null
    || !censusScrollCheckpoint
    || !censusScrollSurfaceBinding
  ) return;
  const generation = censusScrollGeneration;
  const tabId = censusScrollTabId;
  const checkpoint = censusScrollCheckpoint;
  const surfaceBinding = censusScrollSurfaceBinding;
  try {
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'vault:census-scroll:advance',
      checkpoint,
      observedAt: new Date().toISOString(),
      surfaceBinding,
    });
    if (!isCurrentCensusScroll(generation)) return;
    if (!result || result.status === 'refused') {
      stopCensusScrollIfCurrent(
        generation,
        `Census refused: ${result?.reasonCode ?? 'unsupported_census_scroll_surface'}.`,
      );
      return;
    }

    const segment = await persistCensusRound(result);
    if (!isCurrentCensusScroll(generation)) return;
    censusScrollCheckpoint = segment.checkpoint;
    censusScrollStatus.textContent = [
      `Saved round ${segment.round}.`,
      `${segment.checkpoint.seenStableIds.length} stable IDs observed;`,
      `${segment.checkpoint.emittedCount} raw card observations preserved.`,
    ].join(' ');

    if (segment.status === 'ui_exhausted') {
      stopCensusScrollIfCurrent(
        generation,
        `${censusScrollStatus.textContent} ui_exhausted is a terminal UI witness, not provider completeness.`,
      );
      return;
    }
    await applyCensusScrollAction({
      action: result.action,
      runId: segment.runId,
      round: segment.round,
      tabId,
      surfaceBinding,
    });
    if (!isCurrentCensusScroll(generation)) return;
    censusScrollStatus.textContent += ' Waiting for the new rendered viewport to settle…';
    const maximumTop = Math.max(
      0,
      segment.checkpoint.scrollMetrics.scrollHeight
        - segment.checkpoint.scrollMetrics.viewportHeight,
    );
    const requiredTop = Math.min(result.action.scrollTop, maximumTop);
    const settled = await waitForCensusScrollSettled({
      generation,
      tabId,
      runId: segment.runId,
      surfaceBinding,
      requiredTop,
    });
    if (!settled || !isCurrentCensusScroll(generation)) return;
    censusScrollTimer = setTimeout(advanceCensusScroll, 0);
  } catch {
    stopCensusScrollIfCurrent(
      generation,
      'Census paused safely. Resume from the last completed round file; the unsaved viewport will be replayed.',
    );
  }
}

async function startCensusScroll() {
  stopCensusScroll();
  const generation = censusScrollGeneration;
  setCensusScrollActive(true);
  censusScrollStatus.textContent = 'Preparing explicit local round-file persistence…';

  if (
    !globalThis.chrome?.permissions?.request
    || !globalThis.chrome?.tabs?.query
    || !globalThis.chrome?.tabs?.sendMessage
    || !globalThis.chrome?.downloads?.download
    || !globalThis.chrome?.downloads?.search
    || !globalThis.chrome?.downloads?.onChanged
  ) {
    stopCensusScrollIfCurrent(
      generation,
      'Census unavailable: required local browser capabilities are absent.',
    );
    return;
  }

  try {
    const granted = await chrome.permissions.request({ permissions: ['downloads'] });
    if (!isCurrentCensusScroll(generation)) return;
    if (!granted) {
      stopCensusScrollIfCurrent(
        generation,
        'Census refused: downloads permission is required to preserve each round before continuing.',
      );
      return;
    }

    let resumeCheckpoint = null;
    const resumeFile = censusScrollResume.files?.[0];
    if (resumeFile) {
      const resumeText = await resumeFile.text();
      if (!isCurrentCensusScroll(generation)) return;
      const segment = parseCensusScrollSegment(resumeText);
      if (segment.status === 'ui_exhausted') {
        stopCensusScrollIfCurrent(
          generation,
          'Resume refused: that segment already records ui_exhausted.',
        );
        return;
      }
      resumeCheckpoint = segment.checkpoint;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isCurrentCensusScroll(generation)) return;
    if (!Number.isSafeInteger(tab?.id) || tab.id < 0) throw new Error('active tab unavailable');
    const created = await chrome.tabs.sendMessage(tab.id, {
      type: 'vault:census-scroll:create',
      ...(resumeCheckpoint
        ? { checkpoint: resumeCheckpoint }
        : { runId: censusRunId(), observedAt: new Date().toISOString() }),
    });
    if (!isCurrentCensusScroll(generation)) return;
    if (!created || created.status !== 'ready' || !created.checkpoint) {
      stopCensusScrollIfCurrent(
        generation,
        `Census refused: ${created?.reasonCode ?? 'unsupported_census_scroll_surface'}.`,
      );
      return;
    }
    const surfaceBinding = validatedCensusSurfaceBinding(created.surfaceBinding);

    censusScrollStatus.textContent = 'Waiting for reset-to-top cards and scroll metrics to settle…';
    const settled = await waitForCensusScrollSettled({
      generation,
      tabId: tab.id,
      runId: created.checkpoint.runId,
      surfaceBinding,
      requiredTop: 0,
      minWaitMs: 1400,
    });
    if (!settled || !isCurrentCensusScroll(generation)) return;
    censusScrollCheckpoint = created.checkpoint;
    censusScrollTabId = tab.id;
    censusScrollSurfaceBinding = surfaceBinding;
    censusScrollStatus.textContent = resumeCheckpoint
      ? `Resuming run ${resumeCheckpoint.runId} from saved round ${resumeCheckpoint.round}; replay starts at the top.`
      : `Started run ${created.checkpoint.runId}; each viewport is saved before the next round.`;
    censusScrollTimer = setTimeout(advanceCensusScroll, 0);
  } catch {
    stopCensusScrollIfCurrent(
      generation,
      'Census refused or paused before a new durable round was recorded.',
    );
  }
}

function extensionForAsset(asset) {
  if (asset?.assetRole === 'audio_mp3') return 'mp3';
  if (asset?.assetRole === 'audio_wav') return 'wav';
  if (asset?.assetRole === 'artwork') {
    try {
      const match = new URL(asset.transportUrl).pathname.match(/\.([A-Za-z0-9]{2,5})$/);
      const ext = match?.[1]?.toLowerCase();
      if (['avif', 'gif', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ext;
    } catch {
      // Fall through to a non-invented binary extension.
    }
  }
  return 'bin';
}

function renderAdmissionHandoff() {
  const vaultRoot = vaultRootInput?.value?.trim() ?? '';
  if (!completedStaging || !vaultRoot) {
    admitCommand.textContent = 'Complete one staged asset and enter a Vault root to build the admission command.';
    copyAdmitCommand.disabled = true;
    return;
  }

  try {
    const command = formatPowerShellAdmitCommand({
      stagedFile: completedStaging.stagedFile,
      vaultRoot,
      runId: completedStaging.runId,
      providerTrackId: completedStaging.providerTrackId,
      assetRole: completedStaging.assetRole,
      observedAt: completedStaging.observedAt,
      ...(completedStaging.requestDescriptorSha256 === undefined
        ? {}
        : { requestDescriptorSha256: completedStaging.requestDescriptorSha256 }),
    });
    admitCommand.textContent = command;
    copyAdmitCommand.disabled = false;
  } catch {
    admitCommand.textContent = 'Admission handoff refused: local path or witness value is unsafe.';
    copyAdmitCommand.disabled = true;
  }
}

function clearCompletedStaging() {
  completedStaging = null;
  renderAdmissionHandoff();
}

function recordCompletedStaging(completed, stagedFile) {
  completedStaging = Object.freeze({
    stagedFile,
    runId: completed.runId,
    providerTrackId: completed.providerTrackId,
    assetRole: completed.assetRole,
    observedAt: completed.observedAt,
    ...(completed.requestDescriptorSha256 === undefined
      ? {}
      : { requestDescriptorSha256: completed.requestDescriptorSha256 }),
  });
  renderAdmissionHandoff();
}

function armWavButton(track) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'transport-one witness-wav';
  button.textContent = transportEnabled ? 'Witness one WAV' : 'Witness one WAV — enable transport first';
  button.disabled = !transportEnabled || !track.providerTrackId || Boolean(activeDownload) || Boolean(armedWavWitness);
  button.addEventListener('click', () => armWavWitness(track));
  return button;
}

function transportButton(track, asset) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'transport-one';
  button.textContent = transportEnabled ? `Stage this ${asset.assetRole}` : `Stage this ${asset.assetRole} — enable transport first`;
  button.disabled = !transportEnabled || !track.providerTrackId || Boolean(activeDownload) || Boolean(armedWavWitness);
  button.addEventListener('click', () => stageObservedAsset(track, asset));
  return button;
}

function renderObservedAsset(article, track, asset) {
  const box = document.createElement('div');
  box.className = 'observed-asset';
  appendField(box, 'Observed asset', `${asset.assetRole} via ${asset.surface}`);
  appendField(box, 'Exact request preview', asset.requestPreview ?? 'unknown');
  appendField(box, 'Request descriptor SHA-256', asset.requestDescriptorSha256 ?? 'unknown');
  box.append(transportButton(track, asset));
  article.append(box);
}

function renderLiveObservation(observation) {
  latestObservation = observation;
  liveHost.replaceChildren();

  if (!observation || observation.status !== 'ready') {
    const reason = observation?.reasonCode ?? 'wrong_origin';
    liveStatus.textContent = `Witness refused: ${reason}`;
    liveCount.textContent = '0 / 25 observed';
    return;
  }

  const tracks = Array.isArray(observation.tracks) ? observation.tracks.slice(0, 25) : [];
  liveStatus.textContent = observation.warningReasonCode
    ? `Witness ready with bounded warning: ${observation.warningReasonCode}`
    : 'Witness ready. Proposed roles are separated from observed transport surfaces.';
  liveCount.textContent = `${tracks.length} / 25 observed`;

  for (const track of tracks) {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = track.title ?? 'unknown title';
    article.append(heading);
    appendField(article, 'Observed at', observation.observedAt ?? 'unknown');
    appendField(article, 'Provider track ID', track.providerTrackId ?? 'unknown');
    appendField(article, 'Source URL', track.sourceUrl ?? 'unknown');
    appendField(article, 'Proposed assets', Array.isArray(track.proposedAssets) ? track.proposedAssets.join(', ') : 'unknown');

    const observedAssets = Array.isArray(track.observedAssets) ? track.observedAssets : [];
    appendField(article, 'Observed transport surfaces', observedAssets.length ? String(observedAssets.length) : 'none');
    article.append(armWavButton(track));
    for (const asset of observedAssets) renderObservedAsset(article, track, asset);
    liveHost.append(article);
  }
}

async function requestLiveObservation() {
  liveStatus.textContent = 'Observing active Suno page…';
  liveHost.replaceChildren();

  if (!globalThis.chrome?.tabs?.query || !globalThis.chrome?.tabs?.sendMessage) {
    renderLiveObservation({ status: 'refused', reasonCode: 'wrong_origin', tracks: [] });
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      renderLiveObservation({ status: 'refused', reasonCode: 'wrong_origin', tracks: [] });
      return;
    }

    const observation = await chrome.tabs.sendMessage(tab.id, { type: 'vault:observe' });
    renderLiveObservation(observation);
  } catch {
    renderLiveObservation({ status: 'refused', reasonCode: 'wrong_origin', tracks: [] });
  }
}

async function requestTransportPermission() {
  if (!globalThis.chrome?.permissions?.request) {
    transportStatus.textContent = 'Transport unavailable: browser runtime permission capability not present.';
    return;
  }

  try {
    const granted = await chrome.permissions.request({ permissions: ['downloads'] });
    if (!granted) {
      transportEnabled = false;
      transportStatus.textContent = 'Transport refused: transport_permission_denied. Observation remains available.';
      renderLiveObservation(latestObservation);
      return;
    }

    if (
      !globalThis.chrome?.downloads?.download
      || !globalThis.chrome?.downloads?.search
      || !globalThis.chrome?.downloads?.onCreated
      || !globalThis.chrome?.downloads?.onChanged
    ) {
      transportEnabled = false;
      transportStatus.textContent = 'Transport unavailable: downloads permission granted but required browser download capabilities are not present.';
      renderLiveObservation(latestObservation);
      return;
    }

    chrome.downloads.onCreated.addListener(observeCreatedDownload);
    chrome.downloads.onChanged.addListener(observeDownloadChanges);

    transportEnabled = true;
    enableTransport.disabled = true;
    enableTransport.textContent = 'Pilot transport enabled';
    transportStatus.textContent = 'Transport enabled for one-track staging. Choose one observed asset or arm one WAV witness.';
    renderLiveObservation(latestObservation);
  } catch {
    transportEnabled = false;
    transportStatus.textContent = 'Transport refused: transport_permission_denied. Observation remains available.';
  }
}

function armWavWitness(track) {
  if (!transportEnabled) {
    transportStatus.textContent = 'Transport locked. Press Enable pilot transport first.';
    return;
  }
  const observedAt = latestObservation?.observedAt;
  if (!track?.providerTrackId || !observedAt) {
    transportStatus.textContent = 'WAV witness refused: provider track identity and observation timestamp are required.';
    return;
  }
  if (selectedProviderTrackId && selectedProviderTrackId !== track.providerTrackId) {
    transportStatus.textContent = `WAV witness refused: this Phase B2 session is already bound to provider track ${selectedProviderTrackId}.`;
    return;
  }
  if (activeDownload || armedWavWitness) {
    transportStatus.textContent = 'WAV witness refused: another one-track transport is already active.';
    return;
  }

  clearCompletedStaging();
  selectedProviderTrackId = track.providerTrackId;
  armedWavWitness = Object.freeze({
    runId: runId(),
    providerTrackId: track.providerTrackId,
    observedAt,
    armedAtMs: Date.now(),
  });
  transportStatus.textContent = `WAV witness armed for track ${track.providerTrackId}. In Suno, choose Download → WAV now.`;
  renderLiveObservation(latestObservation);
}

function observeCreatedDownload(item) {
  if (!armedWavWitness) return;
  const result = bindCreatedWav({
    arm: armedWavWitness,
    activeDownloadId: activeDownload?.mode === 'user_wav' ? activeDownload.downloadId : null,
    item,
  });

  if (result.status === 'ambiguous') {
    activeDownload = null;
    armedWavWitness = null;
    transportStatus.textContent = 'WAV witness refused: wav_witness_ambiguous. More than one matching WAV began before the one-shot witness resolved.';
    renderLiveObservation(latestObservation);
    return;
  }
  if (result.status !== 'bound') return;

  activeDownload = Object.freeze({
    mode: 'user_wav',
    downloadId: result.downloadId,
    runId: armedWavWitness.runId,
    providerTrackId: armedWavWitness.providerTrackId,
    assetRole: 'audio_wav',
    observedAt: armedWavWitness.observedAt,
    filename: result.filename,
  });
  transportStatus.textContent = `WAV download witnessed for track ${activeDownload.providerTrackId}; Chrome download ${activeDownload.downloadId}. Waiting for completion.`;
  renderLiveObservation(latestObservation);
}

async function stageObservedAsset(track, asset) {
  if (!transportEnabled || !globalThis.chrome?.downloads?.download) {
    transportStatus.textContent = 'Transport locked. Press Enable pilot transport first.';
    return;
  }
  if (!track?.providerTrackId || !asset?.transportUrl || !asset?.requestDescriptorSha256) {
    transportStatus.textContent = 'Transport refused: observed asset lacks exact provider/request evidence.';
    return;
  }
  const observedAt = latestObservation?.observedAt;
  if (!observedAt) {
    transportStatus.textContent = 'Transport refused: live witness has no observation timestamp. Refresh live witness first.';
    return;
  }
  if (selectedProviderTrackId && selectedProviderTrackId !== track.providerTrackId) {
    transportStatus.textContent = `Transport refused: this Phase B2 session is already bound to provider track ${selectedProviderTrackId}.`;
    return;
  }
  if (activeDownload || armedWavWitness) {
    transportStatus.textContent = 'Transport refused: another one-track transport is already active.';
    return;
  }

  clearCompletedStaging();
  selectedProviderTrackId = track.providerTrackId;
  const currentRunId = runId();
  const safeTrackId = safePathSegment(track.providerTrackId, 'unknown-track');
  const safeRole = safePathSegment(asset.assetRole, 'other');
  const filename = `Autodiscography-Vault/${currentRunId}/${safeTrackId}/${safeRole}.${extensionForAsset(asset)}`;

  try {
    const downloadId = await chrome.downloads.download({
      url: asset.transportUrl,
      filename,
      conflictAction: 'uniquify',
      saveAs: false,
    });
    activeDownload = Object.freeze({
      mode: 'observed_asset',
      downloadId,
      runId: currentRunId,
      providerTrackId: track.providerTrackId,
      assetRole: asset.assetRole,
      observedAt,
      requestDescriptorSha256: asset.requestDescriptorSha256,
      filename,
    });
    transportStatus.textContent = `Staging run ${currentRunId}; Observed at ${observedAt}; track ${track.providerTrackId}; role ${asset.assetRole}; request ${asset.requestDescriptorSha256}; Chrome download ${downloadId}.`;
    renderLiveObservation(latestObservation);
  } catch {
    activeDownload = null;
    transportStatus.textContent = 'Transport failed before staging completed. No durable Vault receipt exists.';
    renderLiveObservation(latestObservation);
  }
}

async function completedDownloadItem(downloadId) {
  const [item] = await chrome.downloads.search({ id: downloadId });
  if (!item || typeof item.filename !== 'string' || !item.filename) {
    throw new Error('completed download path unavailable');
  }
  return item;
}

async function observeDownloadChanges(delta) {
  if (!activeDownload || delta?.id !== activeDownload.downloadId || !delta.state?.current) return;

  if (delta.state.current === 'complete') {
    const completed = activeDownload;
    activeDownload = null;
    armedWavWitness = null;

    try {
      const item = await completedDownloadItem(completed.downloadId);
      if (completed.mode === 'user_wav' && !isWavDownloadItem(item)) {
        transportStatus.textContent = 'WAV witness refused: completed download no longer has WAV evidence.';
        renderLiveObservation(latestObservation);
        return;
      }

      recordCompletedStaging(completed, item.filename);
      const requestEvidence = completed.requestDescriptorSha256
        ? `request ${completed.requestDescriptorSha256}`
        : 'request descriptor unavailable by design';
      transportStatus.textContent = `Staged: ${item.filename}. Run ${completed.runId}; Observed at ${completed.observedAt}; track ${completed.providerTrackId}; role ${completed.assetRole}; ${requestEvidence}. Admit these local bytes with pilot:admit.`;
      renderLiveObservation(latestObservation);
    } catch {
      clearCompletedStaging();
      transportStatus.textContent = completed.mode === 'user_wav'
        ? 'WAV witness refused: completed download could not be resolved safely.'
        : 'Transport completed but the local staged path could not be resolved safely.';
      renderLiveObservation(latestObservation);
    }
  } else if (delta.state.current === 'interrupted') {
    activeDownload = null;
    armedWavWitness = null;
    clearCompletedStaging();
    transportStatus.textContent = 'Transport interrupted. No durable Vault receipt exists.';
    renderLiveObservation(latestObservation);
  }
}

async function copyAdmissionCommand() {
  if (copyAdmitCommand.disabled) return;
  try {
    await navigator.clipboard.writeText(admitCommand.textContent);
    transportStatus.textContent = 'Admission command copied. Run it from the Autodiscography Vault repository root.';
  } catch {
    transportStatus.textContent = 'Copy unavailable; command remains visible.';
  }
}

refreshLive.addEventListener('click', requestLiveObservation);
enableTransport.addEventListener('click', requestTransportPermission);
censusScrollStart.addEventListener('click', startCensusScroll);
censusScrollStop.addEventListener('click', () => {
  stopCensusScroll('Census stopped. Resume from the highest completed round file; no incomplete round is claimed.');
});
vaultRootInput.addEventListener('input', renderAdmissionHandoff);
copyAdmitCommand.addEventListener('click', copyAdmissionCommand);
renderAdmissionHandoff();
renderSyntheticProof();
