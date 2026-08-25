(() => {
  'use strict';

  const observer = globalThis.AutodiscographyVaultSuno;
  const censusCardObserver = globalThis.AutodiscographyVaultSunoCensusCardObserver;
  const censusScroll = globalThis.AutodiscographyVaultSunoCensusScroll;
  if (!observer || !globalThis.chrome?.runtime?.onMessage) return;

  function refused(reasonCode) {
    return {
      status: 'refused',
      reasonCode,
    };
  }

  function scrollingElement() {
    return document.scrollingElement ?? document.documentElement;
  }

  function scrollTo(scroller, top) {
    if (typeof scroller?.scrollTo !== 'function') {
      throw new Error('scroll surface is unavailable');
    }
    scroller.scrollTo({ top, behavior: 'auto' });
  }

  function createCensusScroll(message) {
    if (!censusCardObserver || !censusScroll) {
      return refused('unsupported_census_scroll_surface');
    }
    const scroller = scrollingElement();
    scrollTo(scroller, 0);
    const checkpoint = message.checkpoint ?? censusScroll.createCheckpoint({
      runId: message.runId,
      observedAt: message.observedAt,
      ...(message.stableRoundsRequired === undefined
        ? {}
        : { stableRoundsRequired: message.stableRoundsRequired }),
      ...(message.bottomTolerance === undefined
        ? {}
        : { bottomTolerance: message.bottomTolerance }),
    });
    return { status: 'ready', checkpoint };
  }

  function advanceCensusScroll(message) {
    if (!censusCardObserver || !censusScroll) {
      return refused('unsupported_census_scroll_surface');
    }
    const scroller = scrollingElement();
    const extracted = observer.extractSunoCensusCandidates(document);
    const candidates = censusCardObserver.buildCardCandidates({
      runId: message.checkpoint?.runId,
      round: (message.checkpoint?.round ?? 0) + 1,
      observedAt: message.observedAt,
      candidates: extracted.candidates,
    });
    const result = censusScroll.advance({
      checkpoint: message.checkpoint,
      observedAt: message.observedAt,
      candidates,
      scrollMetrics: {
        scrollTop: scroller.scrollTop,
        viewportHeight: scroller.clientHeight,
        scrollHeight: scroller.scrollHeight,
      },
    });
    if (result.action.kind === 'scroll_to') scrollTo(scroller, result.action.scrollTop);
    return result;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message?.type === 'vault:observe') {
        const extracted = observer.extractSunoCandidates(document);
        const observation = observer.buildLiveObservation({
          origin: location.origin,
          candidates: extracted.candidates,
          candidateNodeCount: extracted.candidateNodeCount,
          observedAt: new Date().toISOString(),
        });
        sendResponse(observation);
        return false;
      }
      if (message?.type === 'vault:census-scroll:create') {
        sendResponse(createCensusScroll(message));
        return false;
      }
      if (message?.type === 'vault:census-scroll:advance') {
        sendResponse(advanceCensusScroll(message));
        return false;
      }
    } catch {
      if (message?.type === 'vault:observe') {
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
      } else if (message?.type?.startsWith('vault:census-scroll:')) {
        sendResponse(refused('unsupported_census_scroll_surface'));
      }
      return false;
    }

    return false;
  });
})();
