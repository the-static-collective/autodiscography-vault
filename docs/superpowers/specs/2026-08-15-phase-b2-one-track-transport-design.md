# Phase B2 One-Track Transport Design

## Goal

Prove one authenticated-browser asset transport can cross into Vault's existing local verifier/journal without giving the extension durable authority over Suno authentication or bypassing the Phase-A admission boundary.

Phase B2 is deliberately two-stage:

1. **B2A — characterize:** enrich the live witness, aggregate duplicate DOM witnesses by provider track ID, and report only asset surfaces actually exposed by visible DOM/media/link elements.
2. **B2B — transport one specimen:** after an explicit user gesture grants the optional `downloads` permission, stage exactly one observed asset under Downloads and require a local Node command to verify, atomically promote, journal, and emit the Corpus OS handoff record.

The 25-track acquisition control remains disabled until this one-track specimen passes locally.

## Authority boundary

The browser-held session remains browser-held.

Vault may:

- observe the already-rendered Suno DOM on `https://suno.com/*` and `https://www.suno.com/*`;
- observe explicit media/link URLs already present in that DOM;
- keep an exact selected transport URL ephemerally in extension memory long enough to execute a user-invoked browser download;
- request Chrome's `downloads` capability only when the operator explicitly enables pilot transport;
- stage one file below `Downloads/Autodiscography-Vault/<run-id>/`;
- pass only local staged bytes plus non-secret request evidence to Node admission.

Vault must not:

- request `cookies`, `webRequest`, `<all_urls>`, browser-database access, password access, header interception, telemetry, or server transport;
- write exact asset URLs, URL query strings, signed capabilities, cookies, headers, bearer material, or session values to logs, extension storage, filenames, receipts, manifests, or final artifact metadata;
- fetch arbitrary URLs supplied by page script or user text;
- treat a proposed asset role as proof that an asset transport exists;
- move more than one track through B2B;
- add Native Messaging in Phase B2.

If successful transport would require extracting reusable authentication material, Phase B2 refuses with `reusable_auth_required`.

## Architecture

```text
signed-in Suno page
  -> live-observer.js
     -> aggregate duplicate track witnesses
     -> observed asset descriptors
     -> ephemeral exact transport URL (memory only)
  -> side panel
     -> redacted exact request preview
     -> explicit "Enable pilot transport"
     -> chrome.permissions.request({ permissions: ['downloads'] })
     -> ONE selected observed asset
  -> chrome.downloads.download(...)
  -> Downloads/Autodiscography-Vault/<run-id>/
  -> node scripts/admit-staged-asset.js
     -> .partial copy
     -> SHA-256 + byte length
     -> atomic rename
     -> append-only acquisition journal
     -> Corpus OS handoff manifest
```

Chrome remains the transport substrate. Node remains the admission authority.

## B2A — aggregate before capping

Phase B1 currently deduplicates candidates on first observation. B2A changes the provider adapter to aggregate all duplicate witnesses before applying the 25-track cap.

Canonical grouping order:

1. explicit `providerTrackId` when present;
2. same-origin canonical `/song/<id>` source URL when no explicit ID exists;
3. otherwise a node-local fallback that is not treated as durable identity.

For a group, non-null evidence is merged conservatively:

- provider ID: first explicit ID;
- title: prefer the longest bounded non-empty title, preserving deterministic first-seen order on ties;
- source URL: prefer canonical Suno `/song/<id>` URL over library/general links;
- asset descriptors: union by `assetRole + transport URL`, preserving DOM order.

The cap is applied only after aggregation. `candidateNodeCount` still reflects raw candidate nodes so `pilot_cap_reached` remains honest.

## Observed asset descriptor

`proposedAssets` remains the bounded theoretical role list from Phase B1. B2 adds `observedAssets`, which means the page actually exposed a transport-shaped surface.

Each observed asset descriptor has:

- `assetRole`: one of the existing acquisition roles;
- `surface`: `audio`, `source`, `image`, or `link`;
- `transportUrl`: exact absolute URL, ephemeral only;
- `requestPreview`: a non-secret canonical descriptor suitable for display and durable hashing;
- `requestDescriptorSha256`: SHA-256 of UTF-8 `requestPreview`;
- `evidence.selectorHint`: bounded structural witness only.

Initial classification is intentionally narrow:

- `<audio src>` or `<source src>` whose MIME/type/path is audio-like -> `audio_mp3` when explicitly MP3, otherwise `other`;
- `<img src>` -> `artwork`;
- visible `<a href>` whose pathname clearly names `.mp3` -> `audio_mp3`;
- visible `<a href>` whose pathname clearly names common image extensions -> `artwork`.

B2 does not infer downloadable lyrics or metadata merely because those roles are proposed.

## Request preview and redaction

The transport URL is parsed in memory. `requestPreview` is exactly:

```text
GET <origin><pathname>
provider=suno
track=<providerTrackId>
asset=<assetRole>
```

The URL query and fragment are excluded. No request headers are accepted from the page. The SHA-256 of this canonical preview is the durable request identity.

This means a signed URL may be used immediately by Chrome but its reusable capability does not become Vault evidence.

## Optional transport permission

`downloads` is declared in `optional_permissions`, not required `permissions`.

The side panel shows transport as locked until the operator presses **Enable pilot transport**. That button performs the runtime permission request from the user gesture. Refusal leaves observation usable and transport disabled.

No optional host permission is added in B2. The download manager receives only a URL already observed from the signed-in page. If Chrome cannot transport that URL in the current browser session, the pilot records a transport refusal/failure instead of widening authority.

## One-track staging contract

Only one provider track may be selected for B2B. Within that track, only one observed asset is transported per invocation.

The extension generates a run ID in the form:

```text
suno-b2-YYYYMMDDTHHMMSSmmmZ-<8 lowercase hex>
```

The staged filename is generated from safe evidence only:

```text
Autodiscography-Vault/<run-id>/<providerTrackId>/<assetRole>.<ext>
```

The filename never contains URL query material. `conflictAction` is `uniquify`; `saveAs` is `false`.

The side panel reports the run ID, provider track ID, role, request descriptor hash, Chrome download ID, and completion/interruption state. It does not persist that state in extension storage.

## Local admission

`scripts/admit-staged-asset.js` is the only B2 bridge into the durable Vault.

Required inputs:

- `--staged-file` absolute or relative local path;
- `--vault-root` destination Vault root;
- `--run-id`;
- `--provider-track-id`;
- `--asset-role`;
- `--observed-at` canonical UTC ISO-8601;
- `--request-descriptor-sha256` lowercase SHA-256.

Admission:

1. validate scalar inputs and acquisition role;
2. reject secret-shaped arguments;
3. read the staged file locally;
4. write bytes to `<vault-root>/assets/<providerTrackId>/<assetRole>.<ext>.partial` with mode `0600`;
5. verify `.partial` SHA-256 and byte length using `packages/verifier`;
6. atomically rename to the final path;
7. append a `verified` receipt using `packages/journal`;
8. write/update `<vault-root>/receipts/handoff.json` from the complete journal using `packages/manifest`;
9. independently re-verify the final file before success is reported.

The acquisition receipt gains one optional field: `requestDescriptorSha256`. The handoff manifest carries it as `requestDescriptorSha256` beside the provider/track evidence. Exact URLs remain absent.

A verified final for the same acquisition key is resumable/idempotent: if the journal already records `verified`, Node verifies the existing final and returns `skippedExistingVerified: true` rather than overwriting it.

## Failure behavior

- duplicate sparse/rich DOM witnesses -> aggregate; richer title/asset evidence survives;
- asset role proposed but no visible transport surface -> no `observedAssets` entry;
- secret-shaped candidate evidence outside the ephemeral transport URL -> `reusable_auth_required`;
- optional permission denied -> `transport_permission_denied` in UI only; no durable receipt because no staged bytes exist;
- Chrome download interrupted -> `transport_interrupted` in UI only; Node admission is not invoked;
- staged file missing -> local command exits non-zero without journal mutation;
- request descriptor hash malformed -> local command exits non-zero without journal mutation;
- existing verified final differs from journal -> verification mismatch; no overwrite;
- final 25-track transport remains unavailable in B2.

## Testing

Use the existing dependency-free Node 22 test style.

Add tests proving:

- duplicate candidates aggregate by provider ID and a later rich witness repairs `unknown title`;
- aggregation happens before the 25-track cap;
- visible audio/image/link surfaces become observed descriptors while proposed-only roles do not;
- request previews exclude query/fragment text and produce deterministic SHA-256 values;
- manifest keeps `downloads` optional and all Phase B1 forbidden permissions absent;
- UI contains explicit permission gating and no 25-track acquisition enablement;
- local staged admission produces exact byte identity, atomic final promotion, append-only receipt, handoff entry, and idempotent second pass;
- secret-shaped command inputs and malformed request hashes fail before journal mutation;
- all Phase-A and Phase-B1 tests remain green.

## Pilot gate

B2 is complete only after both automated proof and one human local specimen:

```text
signed-in Suno page
  -> enriched title present
  -> at least one observed asset descriptor
  -> operator grants downloads permission
  -> one browser download completes
  -> staged file exists under bounded run directory
  -> pilot:admit succeeds
  -> independent SHA-256/length matches receipt
  -> handoff manifest contains provider ID + role + request descriptor hash
  -> no reusable URL/auth material appears in durable output
```

Only after that witness may the same machinery be proposed for the 25-track pilot. Full-corpus acquisition remains a later gate.

## Non-goals

- no 25-track transport button;
- no full corpus traversal;
- no browser cookie/session export;
- no arbitrary authenticated fetch proxy;
- no Native Messaging;
- no provider API reverse engineering;
- no server/Vercel acquisition hop;
- no TranchNode/Exact Return integration beyond the existing handoff contract.