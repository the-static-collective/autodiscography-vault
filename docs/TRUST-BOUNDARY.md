# Trust Boundary

## Phase-A authority

Autodiscography Vault is a local preservation instrument. Phase A is synthetic-only and has no authority to contact Suno.

Vault may:

- run after an explicit operator gesture;
- present synthetic provider observations and proposed asset roles;
- write local receipts and derived manifests;
- hash local bytes and record exact byte length;
- preserve explicit missing, partial, refused, failed, and verified states;
- retain provider IDs, source-relative paths, timestamps, and raw observations;
- derive a bounded Corpus OS handoff without altering raw evidence.

Vault must not:

- render or proxy a provider login;
- request or capture passwords;
- call `chrome.cookies` or copy browser databases;
- capture, persist, print, or export authorization headers, bearer tokens, cookies, session identifiers, or other reusable authentication material;
- send corpus material or telemetry to a third party;
- bypass access controls, CAPTCHA, rate limits, entitlement checks, or unavailable downloads;
- infer authorship, ownership, lineage, canon, identity, similarity, semantic equivalence, or meaning;
- replace a raw provider observation with a normalized projection;
- delete or replace an admitted verified original.

## Exact-byte law

A filename is never success.

A verified asset requires both:

1. exact byte length;
2. SHA-256 of the exact admitted bytes.

Writes use a `.partial` path, verification occurs before atomic promotion, and an existing final asset may be skipped only after it independently matches the previously recorded receipt.

## Journal law

The acquisition journal is append-only JSONL keyed logically by:

```text
runId + providerTrackId + assetRole
```

Repeated keys are history, not updates. A missing final newline is treated as a possible torn write and fails closed. Prior entries are never rewritten to make the latest state look cleaner.

## Raw and derived separation

Raw provider observations remain separately addressable. Derived handoff records may reference them by path/hash, but may not overwrite or silently repair them.

Missing, partial, and refused states remain first-class. No inference may manufacture completeness.

## Stop condition for future live work

If a live provider adapter cannot operate using the normal signed-in browser origin without extracting reusable authentication material, stop and emit a `refused` receipt with a bounded reason code such as `reusable_auth_required`.

Do not widen the authority boundary to make acquisition succeed.
