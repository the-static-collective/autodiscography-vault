# Trust Boundary

## Phase-B2C proven authority

Autodiscography Vault is a local preservation instrument. Phase B2C preserves the proven Phase-B2 browser/local membrane and has now witnessed one real full-song WAV from the operator's normal signed-in Suno workflow.

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
- request Chrome `downloads` only from the explicit **Enable pilot transport** or **Start auto-scroll census** action;
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
- enable 25-track or full-corpus transport without a separate reviewed and witnessed design.

## Bounded pilot observation law

The Suno content script remains a witness, not a downloader. It contains no Chrome downloads authority.

Each bounded live-pilot observation:

- is accepted only from exact Suno HTTPS origins;
- aggregates duplicate provider witnesses before the cap so sparse first observations do not erase richer later evidence;
- is hard-capped at 25 grouped candidates;
- preserves unknown provider IDs rather than synthesizing identity;
- exposes `pilot_cap_reached` when additional raw candidate nodes exist;
- refuses secret-shaped evidence as `reusable_auth_required` without echoing the sensitive value;
- reports `observedAssets` only when a visible media/link surface actually exposes a transport-shaped URL;
- classifies `.wav` / WAV MIME only when that evidence is actually present.

## Auto-scroll census law

The same Suno-matched content script may perform one user-requested census round at a time. It first reads ordinary DOM card evidence without moving the page. Only after the side panel completes that round's local immutable download may a separate message consume the one-shot proposed incremental `scrollTo`, and only on the unchanged run, round, page, scroller, rendered fingerprint, and viewport metrics that produced it. The content script has no network, downloads, cookie, request-header, or browser-storage authority.

Each census run:

- starts or restarts at the top of the current library surface;
- requires repeated stable render/scroll probes at the reset top and after every applied action, with a bounded pause-on-timeout;
- observes every currently rendered candidate node rather than grouping raw census evidence or applying the 25-track pilot cap;
- emits one immutable raw observation per rendered card, including repeated observations across rounds;
- uses only an actually observed stable provider ID for derived checkpoint deduplication;
- keeps unknown identities separate and prevents them from contributing to an exhaustion claim;
- moves by less than one viewport so lazy-rendered cards are not intentionally jumped over;
- saves raw observations and the exact next checkpoint together in one local JSON segment;
- waits for that segment download to complete before adopting its checkpoint, applying its action, or advancing again;
- invalidates stale async continuations on Stop or replacement Start so runs cannot bleed into each other;
- reaches `ui_exhausted` only after repeated bottom rounds have no new IDs, no unknown IDs, and stable scroll height;
- never relabels `ui_exhausted` as provider completeness.

The library-card surface is not an exact-detail witness. Provider creation time, style prompt, lyrics text, lyric-generation prompt, parent identity, and WAV state remain typed `not_observed` with a surface-specific reason. Titles and ephemeral media URLs seen by the older bounded pilot are not promoted into those exact raw fields.

Run/round/candidate locators preserve observed order. They do not attest which provider sort order was active, prove oldest/newest boundaries, or constitute a bidirectional chronological census cut. Those require separate visible evidence and reconciliation; provider dates may corroborate a witnessed traversal later but may not manufacture completeness.

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

## Human gate — passed

The prior artwork specimen proved the general B2 membrane. Automated proof established the B2C WAV machinery; the real signed-in specimen recorded in [PR #9](https://github.com/the-static-collective/autodiscography-vault/pull/9) established that Suno's Download → WAV flow matches the bounded browser behavior.

That human specimen proved:

- real provider identity and observation timestamp;
- explicit optional Downloads grant;
- explicit one-shot WAV arm;
- one completed real WAV from Suno's normal operator action;
- successful `audio_wav` local exact admission to the selected Vault root;
- RIFF/WAVE or RF64/WAVE sanity;
- independent receipt/final byte identity agreement;
- no reusable URL/auth/session material in durable output.

The proof closes the one-WAV prerequisite only. It does not authorize 25-track or full-corpus acquisition. If later acquisition requires extracting reusable authentication material or reconstructing a hidden endpoint, stop. Do not widen authority to make acquisition succeed.

## Census-v1 local ingest authority

Census v1 admits either an operator-supplied durable-safe NDJSON pack or one contiguous directory of completed auto-scroll segments. It keeps the three preservation layers physically and semantically separate:

```text
local exact scroll segments or observation pack
  -> credential/capability preflight
  -> raw/census-scroll-segments/<exact-segment-sha256>.json  immutable
  -> raw/observations/<exact-pack-sha256>.ndjson     immutable
  -> normalized/census-v1/<raw-sha256>.ndjson       reproducible
  -> derived interpretation                         not built
```

Each scroll segment and raw pack is copied byte-for-byte and addressed by its SHA-256. Admission replays the checkpoint-controller law across one run: unique contiguous rounds, monotonic timestamps, exact emitted counts, stable IDs derived only from raw observations, computed bottom state, exact stability increments, and an honestly reached terminal state. A changed provider observation receives a different address; prior raw evidence is never updated in place. Re-observations remain in the pack even when their stable IDs already exist in derived checkpoint state. A validated terminal run may preserve zero observations as an empty-population witness; generic empty packs remain refused by default.

Each observation supplies explicit field evidence. An observed value points into its own raw payload with a JSON pointer. A missing value supplies a typed absence and reason code. Normalization may dereference or deterministically parse that evidence; it may not guess provider field names, substitute `observedAt` for provider creation time, infer a lyric-generation prompt from lyrics, infer a root ancestor from a missing parent, or carry an earlier value forward into a later absence.

The local ingest preflight refuses explicit reusable credential fields and capability-bearing URLs before the pack is admitted. This is an admission membrane: a refused unsafe source remains outside the Vault rather than being silently redacted and mislabeled byte-exact.

Normalization checkpoints raw byte offset, output byte length, and record count. On restart, any normalized bytes beyond the last durable checkpoint are truncated because they are rebuildable projection. Raw bytes are never truncated, rewritten, or repaired by the normalizer.

This layer authorizes no browser storage, endpoint reconstruction, API/header interception, hidden pagination, 25-track media transport, or full-corpus media capture. The auto-scroll source is limited to operator-started ordinary-DOM navigation and still requires a real-library population witness. A separate detail-surface adapter must cross its own witness gate before exact provider creation time, prompts, lyrics, or lineage fields may be marked observed.
