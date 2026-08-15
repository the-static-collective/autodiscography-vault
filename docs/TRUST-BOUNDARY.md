# Trust Boundary

## Phase-B2 authority

Autodiscography Vault is a local preservation instrument. Phase B2 preserves the Phase-B1 read-only Suno witness and adds one explicitly granted browser transport capability whose only job is to stage one already-observed asset for local admission.

```text
signed-in Suno page
  -> read-only witness
  -> observed asset descriptor
  -> explicit optional Downloads grant
  -> one Chrome-staged file
  -> local pilot:admit
  -> .partial + SHA-256/length verification
  -> atomic final + append-only journal + handoff
```

Authentication stays in the browser. Verified bytes leave it.

Vault may:

- observe DOM-visible Suno track/library evidence from the normal signed-in page;
- aggregate duplicate witnesses by provider identity before applying the 25-track observation cap;
- retain provider IDs, canonical Suno source URLs, titles, timestamps, and explicit unknown fields;
- distinguish proposed asset roles from actually visible media/link transport surfaces;
- hold an exact observed asset URL ephemerally in extension memory for the immediate user-invoked Chrome download;
- request Chrome `downloads` only from the explicit **Enable pilot transport** action;
- stage one asset from one provider track below `Downloads/Autodiscography-Vault/<run-id>/`;
- durably retain only the redacted request descriptor hash, provider/role evidence, and exact admitted byte identity;
- write local verified receipts and derived manifests through `pilot:admit`;
- preserve explicit missing, partial, refused, failed, and verified states.

Vault must not:

- render or proxy provider login;
- request or capture passwords;
- call `chrome.cookies` or copy browser databases;
- use `webRequest` or capture authorization headers;
- persist, print, journal, manifest, log, filename-encode, or export signed query strings, bearer tokens, cookies, session identifiers, API keys, or reusable authentication material;
- add `<all_urls>`, Native Messaging, telemetry, server transport, or third-party corpus upload to make the pilot work;
- bypass access controls, CAPTCHA, rate limits, entitlement checks, or unavailable downloads;
- infer authorship, ownership, lineage, canon, identity, similarity, semantic equivalence, or meaning;
- delete or overwrite a verified final whose bytes differ from its receipt;
- enable 25-track or full-corpus transport in Phase B2.

## Observation law

The Suno content script remains a witness, not a downloader. It contains no Chrome downloads authority.

Each observation:

- is accepted only from exact Suno HTTPS origins;
- aggregates duplicate provider witnesses before the cap so sparse first observations do not erase richer later evidence;
- is hard-capped at 25 grouped candidates;
- preserves unknown provider IDs rather than synthesizing identity;
- exposes `pilot_cap_reached` when additional raw candidate nodes exist;
- refuses secret-shaped evidence as `reusable_auth_required` without echoing the sensitive value;
- reports `observedAssets` only when a visible media/link surface actually exposes a transport-shaped URL.

## Ephemeral transport law

`transportUrl` is in-memory capability, not durable evidence.

For a selected asset the durable request description is:

```text
GET <origin><pathname>
provider=suno
track=<providerTrackId>
asset=<assetRole>
```

Query and fragment material are excluded before hashing. The receipt/handoff may carry `requestDescriptorSha256`; they may not carry the exact transport URL.

## Exact-byte law

A filename is never success. A verified asset requires both exact byte length and SHA-256.

`pilot:admit` copies staged bytes to a `0600` `.partial`, verifies them, atomically promotes the file, appends the verified receipt, writes the handoff projection, and independently re-verifies the final. An existing verified final may be skipped only after it matches the existing receipt.

## Journal law

The acquisition journal is append-only JSONL keyed logically by:

```text
runId + providerTrackId + assetRole
```

Repeated keys are history, not updates. Prior entries are never rewritten. Torn/non-newline-terminated journal content fails closed.

## Human gate

Automated proof can establish the membrane but cannot establish that a real signed-in Suno asset transport succeeds. The Phase-B2 branch therefore remains below the 25-track gate until one human specimen proves:

- enriched live witness;
- at least one genuinely observed asset surface;
- explicit optional permission grant;
- one completed staged Chrome download;
- successful local exact admission;
- receipt/final byte identity agreement;
- no reusable URL/auth material in durable output.

If real transport requires extracting reusable authentication material, stop with `reusable_auth_required`. Do not widen authority to make acquisition succeed.
