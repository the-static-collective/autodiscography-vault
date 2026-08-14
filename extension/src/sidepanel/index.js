import { listSyntheticTracks } from '../provider/suno/fixture-adapter.js';

const syntheticHost = document.querySelector('#tracks');
const liveHost = document.querySelector('#live-tracks');
const liveStatus = document.querySelector('#live-status');
const liveCount = document.querySelector('#live-count');
const refreshLive = document.querySelector('#refresh-live');

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

function renderLiveObservation(observation) {
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
    : 'Witness ready. Transport remains disabled.';
  liveCount.textContent = `${tracks.length} / 25 observed`;

  for (const track of tracks) {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = track.title ?? 'unknown title';
    article.append(heading);
    appendField(article, 'Provider track ID', track.providerTrackId ?? 'unknown');
    appendField(article, 'Source URL', track.sourceUrl ?? 'unknown');
    appendField(article, 'Proposed assets', Array.isArray(track.proposedAssets) ? track.proposedAssets.join(', ') : 'unknown');
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

refreshLive.addEventListener('click', requestLiveObservation);
renderSyntheticProof();
