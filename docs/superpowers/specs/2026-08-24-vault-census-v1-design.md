# Vault Census v1 — raw-first resumable ingest

## Status

Implementation candidate stacked on the Phase-B2C branch. This design authorizes a local ingest engine for already-captured durable-safe observation packs. It does not authorize full-corpus browser acquisition while the one-real-WAV gate remains pending.

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

## Deferred source adapter

Census v1 deliberately stops at local pack ingest. The source adapter that obtains the complete Suno population must be witnessed against the real signed-in provider surface and must not reconstruct hidden endpoints, persist auth/session capability, or silently omit population classes. Its output contract is now fixed; its browser authority is not.
