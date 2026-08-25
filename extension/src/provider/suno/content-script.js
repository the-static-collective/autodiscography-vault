(() => {
  'use strict';

  const observer = globalThis.AutodiscographyVaultSuno;
  const censusCardObserver = globalThis.AutodiscographyVaultSunoCensusCardObserver;
  const censusScroll = globalThis.AutodiscographyVaultSunoCensusScroll;
  if (!observer || !globalThis.chrome?.runtime?.onMessage) return;
  let pendingCensusScrollAction = null;

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

  function surfaceIdentity() {
    return typeof location.href === 'string'
      ? location.href
      : `${location.origin ?? ''}${location.pathname ?? ''}${location.search ?? ''}${location.hash ?? ''}`;
  }

  function renderSignature(candidates) {
    let hash = 2166136261;
    const add = value => {
      const text = String(value ?? '');
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      hash ^= 0xff;
      hash = Math.imul(hash, 16777619);
    };
    add(candidates.length);
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      add(index);
      add(candidate?.providerTrackId);
      add(candidate?.title);
      add(candidate?.sourceUrl);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function censusSnapshot() {
    const scroller = scrollingElement();
    const scrollMetrics = {
      scrollTop: scroller?.scrollTop,
      viewportHeight: scroller?.clientHeight,
      scrollHeight: scroller?.scrollHeight,
    };
    for (const value of Object.values(scrollMetrics)) {
      if (!Number.isFinite(value) || value < 0) throw new Error('invalid census scroll surface metrics');
    }
    const extracted = observer.extractSunoCensusCandidates(document);
    return {
      scroller,
      scrollMetrics,
      extracted,
      renderSignature: renderSignature(extracted.candidates),
      surfaceIdentity: surfaceIdentity(),
    };
  }

  function probeCensusScroll() {
    if (!censusCardObserver || !censusScroll) {
      return refused('unsupported_census_scroll_surface');
    }
    const snapshot = censusSnapshot();
    return {
      status: 'ready',
      scrollMetrics: snapshot.scrollMetrics,
      candidateNodeCount: snapshot.extracted.candidateNodeCount,
      renderSignature: snapshot.renderSignature,
    };
  }

  function createCensusScroll(message) {
    if (!censusCardObserver || !censusScroll) {
      return refused('unsupported_census_scroll_surface');
    }
    pendingCensusScrollAction = null;
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
    if (pendingCensusScrollAction !== null) {
      return refused('census_scroll_action_pending');
    }
    const snapshot = censusSnapshot();
    const candidates = censusCardObserver.buildCardCandidates({
      runId: message.checkpoint?.runId,
      round: (message.checkpoint?.round ?? 0) + 1,
      observedAt: message.observedAt,
      candidates: snapshot.extracted.candidates,
    });
    const result = censusScroll.advance({
      checkpoint: message.checkpoint,
      observedAt: message.observedAt,
      candidates,
      scrollMetrics: snapshot.scrollMetrics,
    });
    pendingCensusScrollAction = result.action?.kind === 'scroll_to'
      ? {
          runId: result.runId,
          round: result.round,
          scrollTop: result.action.scrollTop,
          scroller: snapshot.scroller,
          scrollMetrics: snapshot.scrollMetrics,
          renderSignature: snapshot.renderSignature,
          surfaceIdentity: snapshot.surfaceIdentity,
        }
      : null;
    return result;
  }

  function applyCensusScroll(message) {
    const action = message?.action;
    if (
      action?.kind !== 'scroll_to'
      || !Number.isFinite(action.scrollTop)
      || action.scrollTop < 0
    ) return refused('invalid_census_scroll_action');
    const pending = pendingCensusScrollAction;
    if (pending === null) return refused('census_scroll_action_not_observed');
    if (
      message.runId !== pending.runId
      || message.round !== pending.round
      || action.scrollTop !== pending.scrollTop
    ) return refused('census_scroll_action_mismatch');

    const current = censusSnapshot();
    const metricsUnchanged = Object.keys(pending.scrollMetrics)
      .every(key => current.scrollMetrics[key] === pending.scrollMetrics[key]);
    if (
      current.scroller !== pending.scroller
      || current.surfaceIdentity !== pending.surfaceIdentity
      || current.renderSignature !== pending.renderSignature
      || !metricsUnchanged
    ) {
      pendingCensusScrollAction = null;
      return refused('census_scroll_surface_changed');
    }
    scrollTo(current.scroller, action.scrollTop);
    pendingCensusScrollAction = null;
    return { status: 'applied' };
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
      if (message?.type === 'vault:census-scroll:probe') {
        sendResponse(probeCensusScroll());
        return false;
      }
      if (message?.type === 'vault:census-scroll:advance') {
        sendResponse(advanceCensusScroll(message));
        return false;
      }
      if (message?.type === 'vault:census-scroll:apply') {
        sendResponse(applyCensusScroll(message));
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
