import { listSyntheticTracks } from '../provider/suno/fixture-adapter.js';
import { bindCreatedWav, isWavDownloadItem } from './wav-witness.js';

const syntheticHost = document.querySelector('#tracks');
const liveHost = document.querySelector('#live-tracks');
const liveStatus = document.querySelector('#live-status');
const liveCount = document.querySelector('#live-count');
const refreshLive = document.querySelector('#refresh-live');
const enableTransport = document.querySelector('#enable-transport');
const transportStatus = document.querySelector('#transport-status');

let latestObservation = null;
let transportEnabled = false;
let selectedProviderTrackId = null;
let activeDownload = null;
let armedWavWitness = null;

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

async function observeDownloadChanges(delta) {
  if (!activeDownload || delta?.id !== activeDownload.downloadId || !delta.state?.current) return;

  if (delta.state.current === 'complete') {
    const completed = activeDownload;
    activeDownload = null;

    if (completed.mode === 'user_wav') {
      try {
        const [item] = await chrome.downloads.search({ id: completed.downloadId });
        if (!item || !isWavDownloadItem(item) || typeof item.filename !== 'string' || !item.filename) {
          armedWavWitness = null;
          transportStatus.textContent = 'WAV witness refused: completed download no longer has WAV evidence.';
          renderLiveObservation(latestObservation);
          return;
        }
        armedWavWitness = null;
        transportStatus.textContent = `Staged: ${item.filename}. Run ${completed.runId}; Observed at ${completed.observedAt}; track ${completed.providerTrackId}; role audio_wav; request descriptor unavailable by design. Admit these local bytes with pilot:admit.`;
        renderLiveObservation(latestObservation);
        return;
      } catch {
        armedWavWitness = null;
        transportStatus.textContent = 'WAV witness refused: completed download could not be resolved safely.';
        renderLiveObservation(latestObservation);
        return;
      }
    }

    transportStatus.textContent = `Staged: ${completed.filename}. Run ${completed.runId}; Observed at ${completed.observedAt}; track ${completed.providerTrackId}; role ${completed.assetRole}; request ${completed.requestDescriptorSha256}. Admit these local bytes with pilot:admit.`;
    renderLiveObservation(latestObservation);
  } else if (delta.state.current === 'interrupted') {
    activeDownload = null;
    armedWavWitness = null;
    transportStatus.textContent = 'Transport interrupted. No durable Vault receipt exists.';
    renderLiveObservation(latestObservation);
  }
}

refreshLive.addEventListener('click', requestLiveObservation);
enableTransport.addEventListener('click', requestTransportPermission);
renderSyntheticProof();
