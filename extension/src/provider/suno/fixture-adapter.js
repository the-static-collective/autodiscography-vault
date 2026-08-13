const TRACKS = Object.freeze([
  Object.freeze({
    providerTrackId: 'synthetic-track-alpha',
    title: 'Synthetic Alpha',
    proposedAssets: Object.freeze(['audio_mp3', 'lyrics', 'raw_metadata']),
  }),
  Object.freeze({
    providerTrackId: 'synthetic-track-beta',
    title: 'Synthetic Beta',
    proposedAssets: Object.freeze(['artwork', 'raw_metadata']),
    missingAssets: Object.freeze(['lyrics']),
  }),
]);

export function listSyntheticTracks() {
  return TRACKS.map(track => ({ ...track }));
}
