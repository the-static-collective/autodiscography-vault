(() => {
  'use strict';

  const observer = globalThis.AutodiscographyVaultSuno;
  const censusCardObserver = globalThis.AutodiscographyVaultSunoCensusCardObserver;
  const censusScroll = globalThis.AutodiscographyVaultSunoCensusScroll;
  if (!observer || !globalThis.chrome?.runtime?.onMessage) return;
  let pendingCensusScrollAction = null;
  let activeCensusScrollSurface = null;

  function randomNonce() {
    if (typeof globalThis.crypto?.getRandomValues !== 'function') {
      throw new Error('secure census surface identity is unavailable');
    }
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  const censusDocumentNonce = randomNonce();

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

  function safeRouteIdentity(identity) {
    const parsed = new URL(identity);
    if (
      parsed.protocol !== 'https:'
      || !['suno.com', 'www.suno.com'].includes(parsed.hostname)
      || parsed.username
      || parsed.password
    ) throw new Error('unsupported census route identity');
    return `${parsed.origin}${parsed.pathname}`;
  }

  function publicSurfaceBinding(surface) {
    return Object.freeze({
      documentNonce: surface.documentNonce,
      routeIdentity: surface.routeIdentity,
    });
  }

  function sameSurfaceBinding(candidate, surface) {
    return candidate?.documentNonce === surface?.documentNonce
      && candidate?.routeIdentity === surface?.routeIdentity;
  }

  function validateCensusRunSurface(message, snapshot) {
    const active = activeCensusScrollSurface;
    if (active === null) return refused('census_scroll_run_not_created');
    if (
      message?.runId !== active.runId
      || !sameSurfaceBinding(message?.surfaceBinding, active)
    ) return refused('census_scroll_run_surface_mismatch');
    if (
      active.documentNonce !== censusDocumentNonce
      || active.exactIdentity !== snapshot.surfaceIdentity
    ) {
      pendingCensusScrollAction = null;
      activeCensusScrollSurface = null;
      return refused('census_scroll_surface_changed');
    }
    return null;
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

  function probeCensusScroll(message) {
    if (!censusCardObserver || !censusScroll) {
      return refused('unsupported_census_scroll_surface');
    }
    const snapshot = censusSnapshot();
    const invalidSurface = validateCensusRunSurface(message, snapshot);
    if (invalidSurface) return invalidSurface;
    return {
      status: 'ready',
      scrollMetrics: snapshot.scrollMetrics,
      candidateNodeCount: snapshot.extracted.candidateNodeCount,
      renderSignature: snapshot.renderSignature,
      surfaceBinding: publicSurfaceBinding(activeCensusScrollSurface),
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
    const exactIdentity = surfaceIdentity();
    activeCensusScrollSurface = Object.freeze({
      runId: checkpoint.runId,
      documentNonce: censusDocumentNonce,
      routeIdentity: safeRouteIdentity(exactIdentity),
      exactIdentity,
    });
    return {
      status: 'ready',
      checkpoint,
      surfaceBinding: publicSurfaceBinding(activeCensusScrollSurface),
    };
  }

  function advanceCensusScroll(message) {
    if (!censusCardObserver || !censusScroll) {
      return refused('unsupported_census_scroll_surface');
    }
    if (pendingCensusScrollAction !== null) {
      return refused('census_scroll_action_pending');
    }
    const snapshot = censusSnapshot();
    const invalidSurface = validateCensusRunSurface({
      ...message,
      runId: message.checkpoint?.runId,
    }, snapshot);
    if (invalidSurface) return invalidSurface;
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
          surfaceBinding: publicSurfaceBinding(activeCensusScrollSurface),
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
      || !sameSurfaceBinding(message.surfaceBinding, pending.surfaceBinding)
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
        sendResponse(probeCensusScroll(message));
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
