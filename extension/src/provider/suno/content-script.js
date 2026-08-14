(() => {
  'use strict';

  const observer = globalThis.AutodiscographyVaultSuno;
  if (!observer || !globalThis.chrome?.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'vault:observe') return false;

    try {
      const extracted = observer.extractSunoCandidates(document);
      const observation = observer.buildLiveObservation({
        origin: location.origin,
        candidates: extracted.candidates,
        candidateNodeCount: extracted.candidateNodeCount,
        observedAt: new Date().toISOString(),
      });
      sendResponse(observation);
    } catch {
      sendResponse({
        provider: 'suno',
        origin: location.origin,
        observedAt: new Date().toISOString(),
        status: 'refused',
        reasonCode: 'unsupported_page_shape',
        truncated: false,
        warningReasonCode: null,
        tracks: [],
      });
    }

    return false;
  });
})();
