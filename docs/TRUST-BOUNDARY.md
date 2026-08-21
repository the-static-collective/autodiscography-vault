# Trust Boundary

## Phase-B2C authority

Autodiscography Vault is a local preservation instrument. Phase B2C preserves the proven Phase-B2 browser/local membrane and adds only enough behavior to witness one real full-song WAV from the operator's normal signed-in Suno workflow.

```text
signed-in Suno page
  -> read-only track witness
  -> explicit optional Downloads grant
  -> either honest DOM WAV surface
     OR one-shot future Chrome WAV witness
  -> completed local file
  -> local pilot:admit
  -> WAV container sanity when role=audio_wav
  -> .partial + SHA-256/length verification
  -> atomic final + append-only journal + handoff
```

Authentication stays in the browser. Verified bytes leave it.

Vault may:

- observe DOM-visible Suno track/library evidence from the normal signed-in page;
- aggregate duplicate witnesses by provider identity before applying the 25-track observation cap;
- retain provider IDs, canonical Suno source URLs, titles, timestamps, and explicit unknown fields;
- distinguish proposed asset roles from actually visible media/link transport surfaces;
- classify an actually exposed `.wav` / WAV MIME surface as `audio_wav`;
- hold an exact observed asset URL ephemerally in extension memory for an immediate direct Chrome download;
- request Chrome `downloads` only from the explicit **Enable pilot transport** action;
- arm one future-only WAV witness for one selected track and inspect the resulting `DownloadItem` only enough to determine time, WAV evidence, optional Suno-compatible referrer, ID, and completed local filename;
- fail closed if more than one matching WAV races the one-shot witness;
- use the completed local filename to build a temporary safe local-admission command;
- durably retain a redacted request descriptor hash only when an honest descriptor exists;
- omit `requestDescriptorSha256` rather than fabricate one for a browser-download witness with no honest descriptor;
- write local verified receipts and derived manifests through `pilot:admit`;
- target an operator-selected external-drive Vault root on the Node side;
- preserve explicit missing, partial, refused, failed, and verified states.

Vault must not:

- render or proxy provider login;
- request or capture passwords;
- call `chrome.cookies` or copy browser databases;
- use `webRequest` or capture authorization headers;
- persist, print, journal, manifest, filename-encode, or export signed query strings, bearer tokens, cookies, session identifiers, API keys, referrers, final transport URLs, or reusable authentication material;
- add `<all_urls>`, Native Messaging, clipboard extension permission, telemetry, server transport, or third-party corpus upload to make the pilot work;
- reconstruct or infer a hidden WAV endpoint from MP3 URLs, provider scripts, headers, cookies, or network traces;
- bypass access controls, CAPTCHA, rate limits, entitlement checks, or unavailable downloads;
- infer authorship, ownership, lineage, canon, identity, similarity, semantic equivalence, or meaning;
- mint `audio_wav` merely because a file is named `.wav`;
- delete or overwrite a verified final whose bytes differ from its receipt;
- enable 25-track or full-corpus transport in Phase B2C.

## Observation law

The Suno content script remains a witness, not a downloader. It contains no Chrome downloads authority.

Each observation:

- is accepted only from exact Suno HTTPS origins;
- aggregates duplicate provider witnesses before the cap so sparse first observations do not erase richer later evidence;
- is hard-capped at 25 grouped candidates;
- preserves unknown provider IDs rather than synthesizing identity;
- exposes `pilot_cap_reached` when additional raw candidate nodes exist;
- refuses secret-shaped evidence as `reusable_auth_required` without echoing the sensitive value;
- reports `observedAssets` only when a visible media/link surface actually exposes a transport-shaped URL;
- classifies `.wav` / WAV MIME only when that evidence is actually present.

## Two transport evidence laws

### Honest DOM transport

`transportUrl` is in-memory capability, not durable evidence. When an actual media/link surface exists, its durable request description remains:

```text
GET <origin><pathname>
provider=suno
track=<providerTrackId>
asset=<assetRole>
```

Query and fragment material are excluded before hashing. The receipt/handoff may carry `requestDescriptorSha256`; they may not carry the exact transport URL.

### User-triggered WAV download

When the operator arms **Witness one WAV** and then uses Suno's normal Download → WAV action, Chrome may create a download without exposing a stable DOM WAV URL. The one-shot binder may inspect a `DownloadItem` transiently but returns only the download ID, local filename, and MIME evidence. It does not return URL, final URL, or referrer.

The arm remains active through the first bound WAV's terminal state so a second matching WAV before resolution becomes `wav_witness_ambiguous` rather than silently entering the specimen.

If no honest safe request descriptor exists for this path, no descriptor hash is invented.

## Exact-byte and WAV law

A filename is never success. A verified asset requires both exact byte length and SHA-256.

For `assetRole=audio_wav`, local admission also requires the staged bytes to identify as RIFF/WAVE or RF64/WAVE before durable journal mutation. This is a bounded container sanity check, not semantic audio analysis or transcoding.

`pilot:admit` then copies staged bytes to a restricted `.partial`, verifies them, atomically promotes the file, appends the verified receipt, writes the handoff projection, and independently re-verifies the final. An existing verified final may be skipped only after it matches the existing receipt.

## Journal law

The acquisition journal is append-only JSONL keyed logically by:

```text
runId + providerTrackId + assetRole
```

Repeated keys are history, not updates. Prior entries are never rewritten. Torn/non-newline-terminated journal content fails closed.

## Human gate

The prior artwork specimen proved the general B2 membrane. Automated proof can establish the B2C WAV machinery but cannot establish that Suno's real signed-in Download → WAV flow matches the observed browser behavior.

Phase B2C therefore remains below the 25-track gate until one human full-song WAV specimen proves:

- real provider identity and observation timestamp;
- explicit optional Downloads grant;
- explicit one-shot WAV arm;
- one completed real WAV from Suno's normal operator action;
- successful `audio_wav` local exact admission to the selected Vault root;
- RIFF/WAVE or RF64/WAVE sanity;
- independent receipt/final byte identity agreement;
- no reusable URL/auth/session material in durable output.

If real WAV acquisition requires extracting reusable authentication material or reconstructing a hidden endpoint, stop. Do not widen authority to make acquisition succeed.
