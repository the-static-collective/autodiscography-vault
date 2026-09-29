# Vault Census v1 — raw-first resumable ingest

## Status

Implementation candidate stacked on the Phase-B2C branch. The one-real-WAV gate has passed. This design now includes a user-triggered ordinary-DOM library-card auto-scroll candidate, immutable round/checkpoint segments, and exact local segment admission. It does not claim provider completeness, authorize full-corpus media transport, or mark detail fields observed without a separate witness.

Tracking: issues #11 and #12.

## Mission

Preserve the Suno population faster than normalization failure, process interruption, or provider drift can erase its evidence.

```text
RAW VAULT OBSERVATION     immutable, content-addressed
  -> CENSUS-V1 NORMALIZATION     reproducible projection
  -> DERIVED INTERPRETATION      deliberately absent
```

No normalized or interpreted value may overwrite its source evidence.

## Input contract

The input is NDJSON with one `autodiscography-vault-observation/v1` envelope per line. The entire pack is preserved byte-for-byte. Each envelope contains:

- `provider: suno`;
- a canonical UTC `observedAt`;
- source kind and locator;
- a durable-safe `payload` containing every safely observable provider field, including unknown fields;
- explicit `evidence` for each required normalized field.

Observed evidence is a JSON pointer into the same raw payload. Missing evidence is a typed state plus a bounded reason code. The normalizer does not guess field aliases.

Required evidence names are:

- `providerTrackId`;
- `providerCreatedAtRaw`;
- `stylePromptRaw`;
- `lyricsTextRaw`;
- `lyricGenerationPromptRaw`;
- `parentProviderTrackId`;
- `audioWav`.

This makes absence mandatory rather than implicit.

## Negative-space vocabulary

Source/value states remain distinct:

- `observed`;
- `known_null`;
- `not_observed`;
- `not_exposed`;
- `unavailable`;
- `refused`;
- `failed_to_fetch`;
- `artifact_known_bytes_unavailable`;
- `historically_observed_now_missing`.

Normalization may additionally emit `derived` or `normalization_failed` for `providerCreatedAtNormalized`.

`parentProviderTrackId: not_observed` never becomes `root ancestor`. A later missing prompt never inherits an earlier prompt. `lyricGenerationPromptRaw` is never reconstructed from `lyricsTextRaw`.

## Raw store

The input pack is hashed, safety-preflighted, copied exactly into:

```text
raw/observations/<raw-source-sha256>.ndjson
```

The content address is the identity. An existing address is accepted only after exact hash and byte-length verification. Provider field additions, removals, or changes create a new raw address. Yesterday's pack remains untouched.

Unknown provider fields remain in the raw pack even when Census v1 has no mapping for them. The normalized record includes the raw pack hash, exact record offset, exact record length, exact record hash, and a top-level unmapped-field pointer list.

Auto-scroll capture first preserves each round byte-for-byte at:

```text
raw/census-scroll-segments/<segment-sha256>.json
```

Each segment binds the ordered raw observations to the exact resume checkpoint returned by that round. Local admission verifies one run ID, unique contiguous rounds from 1, unchanged configuration, monotonic timestamps, cumulative emitted counts, stable IDs derived only from those observations, computed bottom state, exact stability progression, and an honestly reached terminal state before building the deterministic NDJSON observation pack. Repeat observations are not removed from raw history. A valid terminal run with no rendered objects preserves its exact segments and an empty observation projection; it is not converted into a fabricated object or generic failure.

## Reproducible normalization

The projection lives at:

```text
normalized/census-v1/<raw-source-sha256>.ndjson
```

Each normalized line points back to the exact raw record slice. Exact style and lyrics strings retain whitespace, punctuation, ordering, symbols, capitalization, and line breaks. Provider creation time preserves its raw value and may emit a separate deterministic UTC parse. `observedAt` is never used as a substitute.

No STORYSHIP, Acoustic Loci, eCODE, cluster, family, quality, release, or lineage interpretation appears in this layer.

## Resumability law

The checkpoint records:

- raw byte offset;
- normalized output byte length;
- processed record count;
- exact raw source identity;
- normalizer version.

The normalizer fsyncs projection bytes, then atomically commits the checkpoint. A crash may leave extra projection bytes beyond the last checkpoint. Restart truncates only that disposable tail and replays from the raw offset. Raw evidence is never truncated.

Completion atomically promotes the normalized partial, hashes it, writes a receipt, and marks the checkpoint complete. Re-running the same input verifies and skips the existing result.

## Credential membrane

Raw fidelity does not authorize durable authentication capability. The preflight refuses explicit credential/header fields and signed/capability-bearing URLs before raw admission. It does not redact and then mislabel the result byte-exact.

A future capture adapter must omit capability material at its own observation membrane and emit typed `refused` evidence or a safe descriptor hash. Unknown safe metadata remains intact.

## Adversarial witnesses

The automated gates prove:

1. a 20,000-record run can crash at 10,000, receive an uncheckpointed output tail, restart at the durable checkpoint, and finish with 20,000 unique records;
2. rerun produces no duplicate raw history or normalized rows;
3. provider field drift creates new immutable raw history while prior bytes remain exact;
4. parent, prompt, and artifact absence states survive without carry-forward or invented completion;
5. provider creation time, style prompt, lyrics, lyric-generation prompt state, and `observedAt` remain separate;
6. explicit credential material is refused before raw admission.

The auto-scroll gates additionally prove that an uncheckpointed viewport is replayed, a checkpoint cannot skip over lazy cards by jumping directly to the bottom, observation itself cannot scroll, a one-shot run/round/surface-bound action is applied only after exact round persistence completes, a run-wide route/document binding rejects navigation and reload, Stop/Start generations reject stale async completions, reset and post-scroll viewports require repeated bounded stability probes, every rendered node survives before derived stable-ID deduplication, exact segment bytes survive admission, zero-object terminal evidence survives, and forged controller transitions fail before run admission. The route/document binding is ephemeral control state and never enters raw evidence.

## Auto-scroll source boundary and deferred detail adapter

The auto-scroll candidate observes only ordinary signed-in library-card DOM, one explicit round at a time. It has no provider network, request-header, cookie, browser-storage, or hidden-pagination authority. `ui_exhausted` means only that repeated rendered bottom rounds were stable; it is not renamed provider completeness. A real signed-in library specimen must still prove current card identity and exhaustion behavior before this candidate is treated as the observed population path.

The current candidate receipts run/round/candidate sequence but not an attested sort direction or chronological boundary. Oldest-to-newest and newest-to-oldest reconciliation, a shared census-cut identity, and raw provider creation dates are promising closure witnesses only after their actual UI surfaces are observed. Until then they remain proposals, not silently derived capture facts.

Library cards do not establish exact historical detail. Their envelopes therefore mark provider creation time, style prompt, lyrics text, lyric-generation prompt, parent identity, and WAV state as `not_observed`. A separately witnessed detail-surface adapter must preserve exact strings and provider timestamps without trimming, aliasing, carry-forward, or substituting `observedAt`.
