# Phase B2 One-Track Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove one Suno asset can be observed from the signed-in page, transported by Chrome under an explicitly granted optional permission, and admitted as exact local bytes by Vault's existing verifier/journal.

**Architecture:** Keep provider interpretation pure in `live-observer.js`; keep the content script read-only; let the side panel own the user gesture, runtime permission grant, request preview, and one-file `chrome.downloads` call. The browser stages bytes only. A new Node script composes Phase-A verifier/journal/manifest modules for exact local admission.

**Tech Stack:** Manifest V3, vanilla browser JavaScript, Chrome `permissions` + `downloads` APIs, Node.js >=22, `node:test`, existing SHA-256 verifier/journal/handoff modules.

## Global Constraints

- `downloads` is optional runtime authority, never a required permission.
- No `cookies`, `webRequest`, `<all_urls>`, reusable auth extraction, browser-database access, Native Messaging, telemetry, or server/Vercel transport.
- Exact transport URLs are ephemeral only; query/fragment/auth material never enters logs, storage, filenames, receipts, manifests, or final artifact metadata.
- B2B transports one asset from one provider track per invocation.
- 25-track acquisition stays disabled.
- Existing Phase-A and Phase-B1 behavior remains green.

---

### Task 1: Aggregate live witnesses and expose observed asset descriptors

**Files:**
- Modify: `extension/src/provider/suno/live-observer.js`
- Modify: `tests/live-observer.test.js`

**Interfaces:**
- Produces: `extractSunoCandidates(documentLike)` candidates containing `observedAssets[]`.
- Produces: each observed asset as `{ assetRole, surface, transportUrl, requestPreview, requestDescriptorSha256, evidence }`.
- Preserves: `buildLiveObservation(...)` Phase-B1 refusal/cap contract.

- [ ] **Step 1: Write failing duplicate-enrichment and asset-surface tests**

Add tests that construct a minimal fake document with two nodes for the same `providerTrackId`: the first sparse and the second containing title plus `<audio src="https://cdn.example/track.mp3?sig=secret">` and `<img src="https://img.example/cover.jpg?token=secret">`. Assert one candidate survives, the rich title survives, two observed assets survive, and no request preview includes `?sig=`, `?token=`, or fragment text.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/live-observer.test.js`

Expected: FAIL because extraction is currently first-observation-wins and has no `observedAssets` contract.

- [ ] **Step 3: Implement aggregate-before-cap extraction**

Refactor `extractSunoCandidates()` so it collects all candidate nodes, groups explicit provider IDs/canonical song URLs before capping, merges deterministic title/source evidence, and unions asset descriptors in DOM order.

Use Web Crypto only when available in browser code is not sufficient for synchronous extraction; instead add a small deterministic synchronous SHA-256 implementation dedicated to UTF-8 request preview hashing so `requestDescriptorSha256` is available in the pure observer contract without async DOM traversal.

- [ ] **Step 4: Keep transport URLs ephemeral but previews durable-safe**

Generate previews exactly as:

```text
GET <origin><pathname>
provider=suno
track=<providerTrackId>
asset=<assetRole>
```

Never include URL query or fragment. Exact `transportUrl` remains present only in the in-memory observation object.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests PASS.

Commit: `feat: enrich Phase B2 live asset witness`

---

### Task 2: Gate one-track Chrome transport behind optional permission

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/src/sidepanel/index.html`
- Modify: `extension/src/sidepanel/index.js`
- Modify: `extension/src/sidepanel/styles.css`
- Modify: `tests/extension-boundary.test.js`
- Create: `tests/phase-b2-ui.test.js`

**Interfaces:**
- Consumes: `track.observedAssets[]` from Task 1.
- Produces: one staged Chrome download under `Autodiscography-Vault/<run-id>/<providerTrackId>/<assetRole>.<ext>`.

- [ ] **Step 1: Write failing manifest/UI authority tests**

Assert:

```js
assert.deepEqual(manifest.permissions, ['sidePanel']);
assert.deepEqual(manifest.optional_permissions, ['downloads']);
```

Assert the UI contains `Enable pilot transport`, retains a disabled 25-track acquisition control, and contains no persistence primitive such as `chrome.storage` or `localStorage`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/extension-boundary.test.js tests/phase-b2-ui.test.js`

Expected: FAIL because optional transport/UI does not yet exist.

- [ ] **Step 3: Add optional permission and transport controls**

Update manifest identity to Phase B2 and add only:

```json
"optional_permissions": ["downloads"]
```

Keep required permissions exactly `["sidePanel"]` and all Suno-only content-script matches unchanged.

- [ ] **Step 4: Implement explicit user-gesture grant and single-file download**

From the side panel button handler:

```js
const granted = await chrome.permissions.request({ permissions: ['downloads'] });
```

After grant, allow one observed asset button at a time. Call `chrome.downloads.download()` with the exact ephemeral `transportUrl`, `saveAs: false`, and `conflictAction: 'uniquify'`. Generate run IDs locally from UTC timestamp plus cryptographic random bytes. Render only safe request preview/hash and Chrome download status.

Do not use `chrome.storage`, `fetch`, headers, cookie APIs, or arbitrary user URLs.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all tests PASS.

Commit: `feat: stage one optional browser transport`

---

### Task 3: Extend durable receipt evidence with request descriptor hash

**Files:**
- Modify: `packages/acquisition-contract/index.js`
- Modify: `packages/manifest/index.js`
- Modify: `tests/contract.test.js`
- Modify: `tests/manifest.test.js`

**Interfaces:**
- Produces: optional receipt field `requestDescriptorSha256` validated as lowercase SHA-256.
- Produces: handoff record field `requestDescriptorSha256` or `null`.

- [ ] **Step 1: Write failing schema tests**

Add a verified receipt with `requestDescriptorSha256: 'a'.repeat(64)` and assert it validates. Add malformed hash and secret-shaped URL field cases that must refuse. Assert handoff manifest carries only the hash and never a URL.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/contract.test.js tests/manifest.test.js`

Expected: FAIL because the field is not allowed/carried yet.

- [ ] **Step 3: Add the bounded evidence field**

Add `requestDescriptorSha256` to `ALLOWED_FIELDS`, validate it with the existing `SHA256_HEX`, and surface it in `buildHandoffManifest()` beside provider/track evidence.

- [ ] **Step 4: Run tests and commit**

Run: `npm test`

Expected: all tests PASS.

Commit: `feat: carry redacted request identity`

---

### Task 4: Admit staged bytes through the Phase-A verifier/journal

**Files:**
- Create: `scripts/admit-staged-asset.js`
- Create: `tests/admit-staged-asset.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: exported `admitStagedAsset(options)` for tests.
- Produces CLI: `npm run pilot:admit -- --staged-file ... --vault-root ... --run-id ... --provider-track-id ... --asset-role ... --observed-at ... --request-descriptor-sha256 ...`.

- [ ] **Step 1: Write failing exact-admission test**

Create a temporary staged file and call `admitStagedAsset()`. Assert:

- final bytes equal staged bytes;
- no `.partial` remains;
- receipt is `verified` with exact byte length/SHA-256 and request descriptor hash;
- `handoff.json` contains the same identity;
- a second call returns `skippedExistingVerified: true`;
- changing the final bytes before the second call throws verification mismatch.

- [ ] **Step 2: Write failing refusal tests**

Assert malformed request hash, secret-shaped scalar arguments, invalid asset role, and missing staged file fail before any journal entry is appended.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/admit-staged-asset.test.js`

Expected: FAIL because the script does not exist.

- [ ] **Step 4: Implement minimal local admission**

Compose existing `verifyFile`, `assertMatchesReceipt`, `appendJournalEntry`, `readJournal`, `latestReceiptForKey`, `makeAcquisitionKey`, and `buildHandoffManifest`.

Copy staged bytes to a `0600` `.partial`, verify, rename atomically, append the verified receipt, rebuild handoff from the complete journal, and independently verify the final before returning success. Never copy the staged URL because the Node command never receives one.

- [ ] **Step 5: Add CLI/package script and run tests**

Add:

```json
"pilot:admit": "node scripts/admit-staged-asset.js"
```

Run: `npm test && npm run synthetic:pilot`

Expected: all tests PASS and the existing synthetic pilot still completes.

Commit: `feat: admit staged pilot bytes exactly`

---

### Task 5: Advance operator docs without opening the 25-track gate

**Files:**
- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: `docs/TRUST-BOUNDARY.md`
- Modify: `docs/NETWORK-BEHAVIOR.md`
- Modify: `docs/PILOT-RUNBOOK.md`
- Modify: `docs/CORPUS-OS-HANDOFF.md`

**Interfaces:**
- Documents the exact manual local specimen and refusal boundary.

- [ ] **Step 1: Update project state to Phase B2 one-track pilot**

Document the flow:

```text
observe -> preview -> grant optional downloads -> stage ONE asset -> pilot:admit -> verify receipt/handoff
```

State explicitly that the 25-track/full-corpus transport gate remains closed.

- [ ] **Step 2: Document durable secret exclusions**

List exact URL/query/fragment/cookies/headers/session material as forbidden durable evidence; only `requestDescriptorSha256` crosses into receipts/handoff.

- [ ] **Step 3: Document the human witness checklist**

Require the operator to confirm a real title enrichment, at least one observed asset surface, one completed Chrome staged download, successful local admission, independent hash/length agreement, and grep/manual inspection showing no reusable URL/auth material in durable output.

- [ ] **Step 4: Run full verification and commit**

Run: `npm test && npm run synthetic:pilot`

Expected: PASS.

Commit: `docs: add Phase B2 one-track operator gate`

---

## Final verification

- [ ] Run `npm ci`
- [ ] Run `npm test`
- [ ] Run `npm run synthetic:pilot`
- [ ] Inspect `extension/manifest.json` and confirm only `downloads` was added, and only as optional authority.
- [ ] Inspect branch diff for exact/signed asset URLs or secret-shaped durable fixtures; none may exist.
- [ ] Open PR as draft during RED proof, then update after GREEN proof.
- [ ] Mark review-ready only after CI passes.
- [ ] Do not merge until the one-track human local specimen is recorded; automated CI cannot prove authenticated Suno transport behavior.