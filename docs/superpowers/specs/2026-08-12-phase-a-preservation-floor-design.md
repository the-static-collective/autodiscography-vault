# Phase A Preservation Floor — Design

## Purpose

Autodiscography Vault is a separate, local-first acquisition instrument for preserving the user's own Suno corpus before the September 3, 2026 external policy deadline recorded in `the-static-collective/corpus-os#4`.

Phase A deliberately does **not** acquire from Suno. It creates the mechanical floor that must be trustworthy before a 25-track live pilot is allowed.

## Governing law

> Preserve the body before the window narrows. Speed up transport, not trust.

Vault exports useful exact provenance for downstream consumers, but does not absorb Corpus OS, TranchNode, Exact Return, semantic-equivalence logic, lineage inference, or a universal receipt ontology before the 25-track pilot.

## Architecture choice

Use a zero-runtime-dependency JavaScript/ESM repository with Node's built-in test runner for the trusted core and a plain Manifest V3 Chromium extension shell for the operator surface.

This keeps the emergency preservation instrument small:

```text
synthetic provider observation
  -> declared asset proposal
  -> local bytes
  -> SHA-256 + byte length
  -> append-only acquisition receipt
  -> bounded handoff manifest
```

The extension and provider adapter are outside the trusted byte-verification core. Phase A uses synthetic fixtures only.

## Trust boundary

### Vault may

- operate only after an explicit user gesture;
- present synthetic provider observations and proposed asset roles;
- write local acquisition receipts;
- hash local bytes and record exact byte length;
- report verified, missing, partial, refused, and failed states;
- retain provider IDs, source-relative paths, timestamps, and raw observations;
- produce a bounded handoff manifest for Corpus OS.

### Vault must not in Phase A

- perform any live Suno request;
- request host permissions for `suno.com`;
- call `chrome.cookies` or read browser databases;
- capture, persist, print, or export passwords, cookies, bearer tokens, authorization headers, or reusable session material;
- send corpus material or telemetry to a third party;
- bypass access controls, CAPTCHA, rate limits, entitlement checks, or unavailable downloads;
- infer authorship, ownership, lineage, canon, semantic equivalence, identity, similarity, or meaning;
- overwrite raw provider observations with normalized projections;
- delete or replace a verified original.

If future live work requires reusable authentication extraction, the adapter must stop and emit a blocked/refused receipt rather than widening the boundary.

## Core data model

### Asset role

`audio_mp3 | audio_wav | artwork | raw_metadata | lyrics | other`

### Acquisition state

`verified | missing | partial | refused | failed`

### Journal identity

A logical acquisition key is:

```text
runId + providerTrackId + assetRole
```

Journal entries remain individual append-only observations. Repeated keys are allowed and preserve history; callers may derive the latest state without rewriting prior entries.

### Acquisition receipt

Each receipt contains:

- `schemaVersion` — fixed `1`;
- `runId`;
- `provider` — fixed to `suno` for the Phase-A fixture adapter;
- `providerTrackId`;
- `assetRole`;
- `state`;
- `observedAt` — ISO-8601 UTC string;
- `sourceRelativePath`, when a local asset is present;
- `byteLength` and lowercase hex `sha256`, only when bytes were verified;
- `reasonCode`, for missing/partial/refused/failed states;
- no arbitrary diagnostic payload capable of echoing secret material.

## Append-only journal

The trusted journal is newline-delimited JSON (`.jsonl`).

`appendJournalEntry(path, entry)` must:

1. validate the bounded receipt shape;
2. open the file in append mode;
3. write exactly one JSON object plus `\n`;
4. `fsync` before close;
5. never expose an update/truncate API.

`readJournal(path)` parses complete lines and rejects malformed JSON rather than silently repairing history.

`latestReceiptForKey(entries, key)` is a derived view only.

## Byte verifier

`verifyBytes(bytes)` returns exact `byteLength` and SHA-256 of the supplied bytes.

`verifyFile(path)` reads local bytes and returns the same structure.

`assertMatchesReceipt(actual, expected)` succeeds only when both byte length and SHA-256 match. Filename existence is never success.

## Synthetic provider boundary

`extension/src/provider/suno/fixture-adapter.js` is the only Phase-A Suno adapter. It loads bundled synthetic observations and exposes them to the side panel. It contains no network call and the extension manifest contains no host permissions.

The side panel clearly states:

- synthetic fixtures only;
- no live Suno network access;
- no cookies/session capture;
- live pilot remains locked.

## Raw vs derived separation

Synthetic provider observations are stored as raw fixture JSON. Any handoff projection is generated separately and references the raw observation path/hash. A normalized or handoff record never replaces raw evidence.

## Handoff manifest

Phase A emits a narrow manifest compatible with the data needs in `corpus-os#3` without importing Corpus OS code. Each asset record can state:

- provider/provider track ID;
- run ID;
- acquisition timestamp;
- source-relative path;
- media role;
- exact byte length + SHA-256 when verified;
- raw metadata path/hash;
- explicit missing parts;
- admission/acquisition state and refusal reason.

Provider text and timestamps are observations, not semantic authority.

## Error handling

- Secret-shaped receipt fields are rejected before append and their values are never echoed.
- Corrupt or truncated journal lines fail closed with a line number.
- Verification mismatch returns/throws a bounded mismatch describing expected vs actual hash/length only.
- Missing assets remain `missing`; partial assets remain `partial`; neither is silently promoted to verified.
- Same filename with different bytes remains distinguishable by SHA-256.
- Alternate provider track IDs remain separate records.

## Testing

Use only synthetic fixtures and Node's built-in `node:test`.

Required proofs:

1. known fixture hashes produce exact expected SHA-256 and byte length;
2. one-byte corruption fails verification;
3. append operations preserve all prior journal lines;
4. repeated acquisition keys derive the latest state without rewriting history;
5. malformed/truncated journal input fails closed;
6. missing/partial/refused/failed states round-trip explicitly;
7. secret-shaped fields are rejected without echoing the secret;
8. same-name/different-byte assets remain distinct by hash;
9. manifest export preserves raw metadata reference separately from derived fields;
10. extension manifest has no `host_permissions`, `cookies`, or remote code.

## Phase-A acceptance gate

Phase A passes when a synthetic acquisition can be journaled, deliberately interrupted, resumed, and independently verified without rewriting admitted originals; every verified final asset has exact byte length plus SHA-256; incomplete states are explicit; the extension remains network inert; and the handoff projection carries enough exact identity/provenance for Corpus OS without importing downstream architecture.

## Explicitly deferred

- live `suno.com` enumeration or downloads;
- 25-track pilot execution;
- bounded concurrency/backoff against a provider;
- provider-specific auth/session behavior;
- full corpus acquisition;
- TranchNode transport;
- Exact Return/transduction classification;
- semantic or lineage inference.
