(() => {
  'use strict';

  const MAX_TRACKS = 25;
  const ALLOWED_ORIGINS = new Set(['https://suno.com', 'https://www.suno.com']);
  const PROPOSED_ASSETS = Object.freeze(['raw_metadata', 'lyrics', 'artwork', 'audio_mp3']);
  const SECRET_KEY = /(authorization|cookie|token|session|password|passwd|secret|credential|api[_-]?key)/i;
  const SECRET_VALUE = /(\bbearer\s+[A-Za-z0-9._~+/=-]+|[?&](?:token|session|auth|authorization|key)=[^&\s]+)/i;
  const CANDIDATE_SELECTORS = Object.freeze([
    '[data-song-id]',
    '[data-track-id]',
    '[data-clip-id]',
    'a[href*="/song/"]',
  ]);

  function boundedString(value, maxLength) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
  }

  function containsSecretShape(value, seen = new Set()) {
    if (value == null) return false;
    if (typeof value === 'string') return SECRET_VALUE.test(value);
    if (typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);

    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) return true;
      if (containsSecretShape(nested, seen)) return true;
    }
    return false;
  }

  function safeSameOriginUrl(value, origin) {
    const raw = boundedString(value, 2048);
    if (!raw) return null;
    try {
      const url = new URL(raw, origin);
      if (!ALLOWED_ORIGINS.has(url.origin)) return null;
      if (SECRET_VALUE.test(url.href)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function normalizeTrack(candidate, origin) {
    return Object.freeze({
      providerTrackId: boundedString(candidate?.providerTrackId, 256),
      title: boundedString(candidate?.title, 512),
      sourceUrl: safeSameOriginUrl(candidate?.sourceUrl, origin),
      proposedAssets: PROPOSED_ASSETS,
      evidence: Object.freeze({
        source: boundedString(candidate?.evidence?.source, 64) ?? 'dom',
        selectorHint: boundedString(candidate?.evidence?.selectorHint, 160),
      }),
    });
  }

  function refused(origin, observedAt, reasonCode) {
    return Object.freeze({
      provider: 'suno',
      origin: boundedString(origin, 256),
      observedAt: boundedString(observedAt, 64),
      status: 'refused',
      reasonCode,
      truncated: false,
      warningReasonCode: null,
      tracks: Object.freeze([]),
    });
  }

  function buildLiveObservation({ origin, candidates = [], candidateNodeCount, observedAt } = {}) {
    if (!ALLOWED_ORIGINS.has(origin)) {
      return refused(origin, observedAt, 'wrong_origin');
    }

    if (containsSecretShape(candidates)) {
      return refused(origin, observedAt, 'reusable_auth_required');
    }

    const input = Array.isArray(candidates) ? candidates : [];
    const nodeCount = Number.isInteger(candidateNodeCount) ? candidateNodeCount : input.length;
    if (nodeCount === 0) {
      return refused(origin, observedAt, 'no_tracks_observed');
    }

    const normalized = input.map(candidate => normalizeTrack(candidate, origin));
    const supported = normalized.filter(track => track.providerTrackId || track.title || track.sourceUrl);
    if (supported.length === 0) {
      return refused(origin, observedAt, 'unsupported_page_shape');
    }

    const truncated = nodeCount > MAX_TRACKS || supported.length > MAX_TRACKS;
    return Object.freeze({
      provider: 'suno',
      origin,
      observedAt: boundedString(observedAt, 64),
      status: 'ready',
      reasonCode: null,
      truncated,
      warningReasonCode: truncated ? 'pilot_cap_reached' : null,
      tracks: Object.freeze(supported.slice(0, MAX_TRACKS)),
    });
  }

  function textFrom(node, selector) {
    try {
      const target = selector ? node.querySelector(selector) : node;
      return boundedString(target?.textContent ?? target?.getAttribute?.('aria-label'), 512);
    } catch {
      return null;
    }
  }

  function explicitTrackId(node, sourceUrl) {
    const attributes = ['data-song-id', 'data-track-id', 'data-clip-id'];
    for (const name of attributes) {
      const value = boundedString(node?.getAttribute?.(name), 256);
      if (value) return value;
    }

    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl);
        const match = url.pathname.match(/^\/song\/([^/?#]+)/);
        if (match?.[1]) return decodeURIComponent(match[1]).slice(0, 256);
      } catch {
        // Leave identity unknown when the URL is not parseable.
      }
    }
    return null;
  }

  function candidateFromNode(node, index) {
    const anchor = node?.matches?.('a[href]') ? node : node?.querySelector?.('a[href]');
    const sourceUrl = boundedString(anchor?.href ?? anchor?.getAttribute?.('href'), 2048);
    const providerTrackId = explicitTrackId(node, sourceUrl);
    const title = boundedString(node?.getAttribute?.('data-title'), 512)
      ?? textFrom(node, '[data-testid*="title" i]')
      ?? textFrom(node, '[class*="title" i]')
      ?? boundedString(anchor?.getAttribute?.('aria-label'), 512)
      ?? boundedString(anchor?.textContent, 512);

    return {
      providerTrackId,
      title,
      sourceUrl,
      evidence: {
        source: 'dom',
        selectorHint: `candidate-${index + 1}`,
      },
    };
  }

  function extractSunoCandidates(documentLike) {
    if (!documentLike?.querySelectorAll) {
      return { candidateNodeCount: 0, candidates: [] };
    }

    const nodes = Array.from(documentLike.querySelectorAll(CANDIDATE_SELECTORS.join(',')));
    const seen = new Set();
    const candidates = [];

    for (let index = 0; index < nodes.length; index += 1) {
      const candidate = candidateFromNode(nodes[index], index);
      const dedupeKey = candidate.providerTrackId ?? candidate.sourceUrl ?? `${candidate.title ?? 'unknown'}:${index}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      candidates.push(candidate);
      if (candidates.length >= MAX_TRACKS) break;
    }

    return {
      candidateNodeCount: nodes.length,
      candidates,
    };
  }

  globalThis.AutodiscographyVaultSuno = Object.freeze({
    MAX_TRACKS,
    buildLiveObservation,
    extractSunoCandidates,
  });
})();
