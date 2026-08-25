(() => {
  'use strict';

  const ALLOWED_ORIGINS = new Set(['https://suno.com', 'https://www.suno.com']);
  const CANONICAL_UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const REUSABLE_SECRET_VALUE = /\bbearer\s+[A-Za-z0-9._~+/=-]+/i;
  const UNINSPECTED = Object.freeze({
    state: 'not_observed',
    reasonCode: 'field_not_inspected_on_library_card',
  });

  function canonicalUtc(value) {
    if (
      typeof value !== 'string'
      || !CANONICAL_UTC_ISO.test(value)
      || new Date(value).toISOString() !== value
    ) throw new Error('observedAt must be canonical UTC ISO-8601');
    return value;
  }

  function runId(value) {
    if (typeof value !== 'string' || !SAFE_RUN_ID.test(value)) {
      throw new Error('invalid census scroll run ID');
    }
    return value;
  }

  function roundNumber(value) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('invalid census scroll round');
    return value;
  }

  function providerTrackId(value) {
    if (value === null || value === undefined) return null;
    if (
      typeof value !== 'string'
      || value.length < 1
      || value.length > 512
      || value.trim() !== value
      || /[\u0000-\u001f\u007f]/.test(value)
      || REUSABLE_SECRET_VALUE.test(value)
      || /^https?:\/\//i.test(value)
    ) throw new Error('unsafe provider track identity');
    return value;
  }

  function safeSourcePath(value) {
    if (typeof value !== 'string' || value.length > 4096) return null;
    try {
      const parsed = new URL(value);
      if (!ALLOWED_ORIGINS.has(parsed.origin)) return null;
      if (parsed.pathname.length > 2048 || /[\u0000-\u001f\u007f]/.test(parsed.pathname)) return null;
      return parsed.pathname;
    } catch {
      return null;
    }
  }

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const nested of Object.values(value)) deepFreeze(nested);
    }
    return value;
  }

  function buildEvidence(stableId) {
    return {
      providerTrackId: stableId === null
        ? {
            state: 'not_observed',
            reasonCode: 'stable_id_not_observed_on_library_card',
          }
        : { state: 'observed', pointer: '/providerTrackId' },
      providerCreatedAtRaw: { ...UNINSPECTED },
      stylePromptRaw: { ...UNINSPECTED },
      lyricsTextRaw: { ...UNINSPECTED },
      lyricGenerationPromptRaw: { ...UNINSPECTED },
      parentProviderTrackId: { ...UNINSPECTED },
      audioWav: { ...UNINSPECTED },
    };
  }

  function buildCardCandidates({ runId: rawRunId, round, observedAt, candidates = [] } = {}) {
    const safeRunId = runId(rawRunId);
    const safeRound = roundNumber(round);
    const safeObservedAt = canonicalUtc(observedAt);
    if (!Array.isArray(candidates)) throw new Error('candidates must be an array');

    return Object.freeze(candidates.map((candidate, index) => {
      const stableId = providerTrackId(candidate?.providerTrackId);
      const sourcePath = safeSourcePath(candidate?.sourceUrl);
      const payload = {
        ...(stableId === null ? {} : { providerTrackId: stableId }),
        ...(sourcePath === null ? {} : { sourcePath }),
      };
      return deepFreeze({
        stableProviderId: stableId,
        observation: {
          schema: 'autodiscography-vault-observation/v1',
          provider: 'suno',
          observedAt: safeObservedAt,
          source: {
            kind: 'ordinary_signed_in_dom',
            locator: `suno-library-scroll:${safeRunId}:round:${safeRound}:candidate:${index + 1}`,
            adapter: 'suno-library-auto-scroll/v1',
            surface: 'library_card',
          },
          payload,
          evidence: buildEvidence(stableId),
        },
      });
    }));
  }

  globalThis.AutodiscographyVaultSunoCensusCardObserver = Object.freeze({ buildCardCandidates });
})();
