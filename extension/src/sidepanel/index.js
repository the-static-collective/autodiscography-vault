import { listSyntheticTracks } from '../provider/suno/fixture-adapter.js';

const host = document.querySelector('#tracks');

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
  host.append(article);
}
