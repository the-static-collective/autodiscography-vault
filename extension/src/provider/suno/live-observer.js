(() => {
  'use strict';

  const MAX_TRACKS = 25;
  const ALLOWED_ORIGINS = new Set(['https://suno.com', 'https://www.suno.com']);
  const PROPOSED_ASSETS = Object.freeze(['raw_metadata', 'lyrics', 'artwork', 'audio_mp3', 'audio_wav']);
  const SECRET_KEY = /(authorization|cookie|token|session|password|passwd|secret|credential|api[_-]?key)/i;
  const SECRET_VALUE = /(\bbearer\s+[A-Za-z0-9._~+/=-]+|[?&](?:token|session|auth|authorization|key)=[^&\s]+)/i;
  const CANDIDATE_SELECTORS = Object.freeze([
    '[data-song-id]',
    '[data-track-id]',
    '[data-clip-id]',
    'a[href*="/song/"]',
  ]);
  const IMAGE_PATH = /\.(?:avif|gif|jpe?g|png|webp)$/i;
  const MP3_PATH = /\.mp3$/i;
  const WAV_PATH = /\.wav$/i;
  const SHA256_K = Object.freeze([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
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
      if (key === 'transportUrl') continue;
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

  function safeTransportUrl(value) {
    const raw = boundedString(value, 8192);
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      if (url.username || url.password) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function utf8Bytes(value) {
    const bytes = [];
    for (let index = 0; index < value.length; index += 1) {
      let codePoint = value.codePointAt(index);
      if (codePoint > 0xffff) index += 1;
      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
      } else if (codePoint <= 0xffff) {
        bytes.push(
          0xe0 | (codePoint >>> 12),
          0x80 | ((codePoint >>> 6) & 0x3f),
          0x80 | (codePoint & 0x3f),
        );
      } else {
        bytes.push(
          0xf0 | (codePoint >>> 18),
          0x80 | ((codePoint >>> 12) & 0x3f),
          0x80 | ((codePoint >>> 6) & 0x3f),
          0x80 | (codePoint & 0x3f),
        );
      }
    }
    return Uint8Array.from(bytes);
  }

  function rotateRight(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
  }

  function sha256Hex(value) {
    const input = utf8Bytes(value);
    const bitLength = input.length * 8;
    const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
    const bytes = new Uint8Array(paddedLength);
    bytes.set(input);
    bytes[input.length] = 0x80;
    const view = new DataView(bytes.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const words = new Uint32Array(64);

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) {
        words[index] = view.getUint32(offset + (index * 4), false);
      }
      for (let index = 16; index < 64; index += 1) {
        const x = words[index - 15];
        const y = words[index - 2];
        const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
        const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let index = 0; index < 64; index += 1) {
        const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ ((~e) & g);
        const temp1 = (h + s1 + choice + SHA256_K[index] + words[index]) >>> 0;
        const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + majority) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map(part => part.toString(16).padStart(8, '0'))
      .join('');
  }

  function canonicalRequestPreview({ transportUrl, providerTrackId, assetRole }) {
    const url = new URL(transportUrl);
    return `GET ${url.origin}${url.pathname}\nprovider=suno\ntrack=${providerTrackId ?? 'unknown'}\nasset=${assetRole}`;
  }

  function normalizeObservedAsset(asset, providerTrackId) {
    const transportUrl = safeTransportUrl(asset?.transportUrl);
    const assetRole = PROPOSED_ASSETS.includes(asset?.assetRole) || asset?.assetRole === 'other'
      ? asset.assetRole
      : null;
    if (!transportUrl || !assetRole) return null;
    const requestPreview = canonicalRequestPreview({ transportUrl, providerTrackId, assetRole });
    return Object.freeze({
      assetRole,
      surface: boundedString(asset?.surface, 32) ?? 'link',
      transportUrl,
      requestPreview,
      requestDescriptorSha256: sha256Hex(requestPreview),
      evidence: Object.freeze({ selectorHint: boundedString(asset?.evidence?.selectorHint, 160) }),
    });
  }

  function normalizeTrack(candidate, origin) {
    const providerTrackId = boundedString(candidate?.providerTrackId, 256);
    const observedAssets = Array.isArray(candidate?.observedAssets)
      ? candidate.observedAssets.map(asset => normalizeObservedAsset(asset, providerTrackId)).filter(Boolean)
      : [];
    return Object.freeze({
      providerTrackId,
      title: boundedString(candidate?.title, 512),
      sourceUrl: safeSameOriginUrl(candidate?.sourceUrl, origin),
      proposedAssets: PROPOSED_ASSETS,
      observedAssets: Object.freeze(observedAssets),
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
    if (!ALLOWED_ORIGINS.has(origin)) return refused(origin, observedAt, 'wrong_origin');
    if (containsSecretShape(candidates)) return refused(origin, observedAt, 'reusable_auth_required');

    const input = Array.isArray(candidates) ? candidates : [];
    const nodeCount = Number.isInteger(candidateNodeCount) ? candidateNodeCount : input.length;
    if (nodeCount === 0) return refused(origin, observedAt, 'no_tracks_observed');

    const normalized = input.map(candidate => normalizeTrack(candidate, origin));
    const supported = normalized.filter(track => track.providerTrackId || track.title || track.sourceUrl);
    if (supported.length === 0) return refused(origin, observedAt, 'unsupported_page_shape');

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

  function classifyObservedAsset(node, providerTrackId, index) {
    const tagName = boundedString(node?.tagName, 16)?.toUpperCase();
    const rawUrl = tagName === 'A' ? (node?.href ?? node?.getAttribute?.('href')) : (node?.src ?? node?.getAttribute?.('src'));
    const transportUrl = safeTransportUrl(rawUrl);
    if (!tagName || !transportUrl) return null;

    let parsed;
    try {
      parsed = new URL(transportUrl);
    } catch {
      return null;
    }
    const pathname = parsed.pathname.toLowerCase();
    const type = boundedString(node?.getAttribute?.('type'), 128)?.toLowerCase() ?? '';
    let assetRole = null;
    let surface = null;

    if (tagName === 'IMG') {
      assetRole = 'artwork';
      surface = 'image';
    } else if (tagName === 'AUDIO' || tagName === 'SOURCE') {
      if (type === 'audio/wav' || WAV_PATH.test(pathname)) assetRole = 'audio_wav';
      else if (type === 'audio/mpeg' || MP3_PATH.test(pathname)) assetRole = 'audio_mp3';
      else assetRole = 'other';
      surface = tagName === 'AUDIO' ? 'audio' : 'source';
    } else if (tagName === 'A' && WAV_PATH.test(pathname)) {
      assetRole = 'audio_wav';
      surface = 'link';
    } else if (tagName === 'A' && MP3_PATH.test(pathname)) {
      assetRole = 'audio_mp3';
      surface = 'link';
    } else if (tagName === 'A' && IMAGE_PATH.test(pathname)) {
      assetRole = 'artwork';
      surface = 'link';
    }

    if (!assetRole) return null;
    const requestPreview = canonicalRequestPreview({ transportUrl, providerTrackId, assetRole });
    return {
      assetRole,
      surface,
      transportUrl,
      requestPreview,
      requestDescriptorSha256: sha256Hex(requestPreview),
      evidence: { selectorHint: `asset-${index + 1}` },
    };
  }

  function observedAssetsFromNode(node, providerTrackId) {
    const nodes = [];
    if (['AUDIO', 'SOURCE', 'IMG'].includes(boundedString(node?.tagName, 16)?.toUpperCase()) || node?.matches?.('a[href]')) nodes.push(node);
    try {
      if (node?.querySelectorAll) nodes.push(...Array.from(node.querySelectorAll('audio[src], source[src], img[src], a[href]')));
    } catch {
      // Unsupported nested shape contributes no transport witness.
    }

    const seen = new Set();
    const assets = [];
    for (let index = 0; index < nodes.length; index += 1) {
      const asset = classifyObservedAsset(nodes[index], providerTrackId, index);
      if (!asset) continue;
      const key = `${asset.assetRole}\u0000${asset.transportUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      assets.push(asset);
    }
    return assets;
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
      observedAssets: observedAssetsFromNode(node, providerTrackId),
      evidence: { source: 'dom', selectorHint: `candidate-${index + 1}` },
    };
  }

  function isCanonicalSongUrl(value) {
    try {
      const url = new URL(value);
      return ALLOWED_ORIGINS.has(url.origin) && /^\/song\/[^/?#]+/.test(url.pathname);
    } catch {
      return false;
    }
  }

  function richerTitle(current, candidate) {
    const left = boundedString(current, 512);
    const right = boundedString(candidate, 512);
    if (!left) return right;
    if (!right) return left;
    return right.length > left.length ? right : left;
  }

  function mergeCandidate(into, candidate) {
    into.providerTrackId ??= candidate.providerTrackId;
    into.title = richerTitle(into.title, candidate.title);
    if (!into.sourceUrl || (!isCanonicalSongUrl(into.sourceUrl) && isCanonicalSongUrl(candidate.sourceUrl))) {
      into.sourceUrl = candidate.sourceUrl ?? into.sourceUrl;
    }

    const seenAssets = new Set(into.observedAssets.map(asset => `${asset.assetRole}\u0000${asset.transportUrl}`));
    for (const asset of candidate.observedAssets ?? []) {
      const key = `${asset.assetRole}\u0000${asset.transportUrl}`;
      if (seenAssets.has(key)) continue;
      seenAssets.add(key);
      into.observedAssets.push(asset);
    }
    return into;
  }

  function candidateGroupKey(candidate, index) {
    if (candidate.providerTrackId) return `id:${candidate.providerTrackId}`;
    if (candidate.sourceUrl && isCanonicalSongUrl(candidate.sourceUrl)) return `song:${candidate.sourceUrl}`;
    return `node:${index}`;
  }

  function extractSunoCandidates(documentLike) {
    if (!documentLike?.querySelectorAll) return { candidateNodeCount: 0, candidates: [] };

    const nodes = Array.from(documentLike.querySelectorAll(CANDIDATE_SELECTORS.join(',')));
    const grouped = new Map();

    for (let index = 0; index < nodes.length; index += 1) {
      const candidate = candidateFromNode(nodes[index], index);
      const key = candidateGroupKey(candidate, index);
      if (!grouped.has(key)) {
        grouped.set(key, { ...candidate, observedAssets: [...(candidate.observedAssets ?? [])] });
      } else {
        mergeCandidate(grouped.get(key), candidate);
      }
    }

    return { candidateNodeCount: nodes.length, candidates: Array.from(grouped.values()).slice(0, MAX_TRACKS) };
  }

  globalThis.AutodiscographyVaultSuno = Object.freeze({ MAX_TRACKS, buildLiveObservation, extractSunoCandidates });
})();