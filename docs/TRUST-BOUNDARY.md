# Trust Boundary

## Phase-B1 authority

Autodiscography Vault is a local preservation instrument. Phase B1 adds a permanent, read-only content script limited to `https://suno.com/*` and `https://www.suno.com/*` so the operator can inspect a bounded live preservation proposal before any provider asset transport exists.

Vault may:

- run after an explicit operator gesture in the Vault side panel;
- observe DOM-visible Suno track/library evidence from the normal signed-in provider page;
- return at most 25 candidates per observation;
- retain provider IDs, source URLs, titles, timestamps, raw structural observations, and explicit unknown fields;
- present proposed asset roles (`raw_metadata`, `lyrics`, `artwork`, `audio_mp3`) without claiming those assets are yet acquirable;
- write local receipts and derived manifests only through separately admitted acquisition paths;
- hash local bytes and record exact byte length;
- preserve explicit missing, partial, refused, failed, and verified states;
- derive a bounded Corpus OS handoff without altering raw evidence.

Vault must not:

- render or proxy a provider login;
- request or capture passwords;
- call `chrome.cookies` or copy browser databases;
- use `webRequest` or capture authorization headers;
- capture, persist, print, or export bearer tokens, cookies, session identifiers, API keys, or other reusable authentication material;
- send corpus material or telemetry to Vercel, another server, or any third party;
- bypass access controls, CAPTCHA, rate limits, entitlement checks, or unavailable downloads;
- infer authorship, ownership, lineage, canon, identity, similarity, semantic equivalence, or meaning;
- replace a raw provider observation with a normalized projection;
- delete or replace an admitted verified original.

## Phase-B1 observation law

The permanent Suno content script is a witness, not a downloader.

Each observation:

- is accepted only from exact Suno HTTPS origins;
- is hard-capped at 25 candidates in code;
- preserves missing provider IDs as `null` rather than synthesizing identity;
- exposes `pilot_cap_reached` when additional candidates exist;
- refuses secret-shaped evidence as `reusable_auth_required` without echoing the sensitive value;
- stops before MP3, artwork, lyrics, or raw-metadata transport.

The side panel's `Acquire 25-track pilot` control remains disabled until a separate Phase-B2 review admits a transport mechanism.

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

## Stop condition for live transport

If a live provider transport cannot operate using the normal signed-in browser origin without extracting reusable authentication material, stop and emit a `refused` receipt with reason code `reusable_auth_required`.

Do not widen the authority boundary to make acquisition succeed.
