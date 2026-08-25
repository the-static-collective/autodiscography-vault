# Phase B2C Full-song WAV Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove one real full-song Suno WAV can be witnessed from the normal signed-in web download flow, staged as local bytes, admitted as `audio_wav`, and verified under an operator-selected Vault root without exporting browser/session authority.

**Architecture:** Extend the proven Phase B2 membrane. The live observer recognizes honest WAV DOM surfaces; when Suno's normal Download → WAV action produces only a browser download, a one-shot `chrome.downloads.onCreated` witness binds that future download to one selected track. Node remains the durable authority boundary and adds a minimal WAV container check plus parity with the contract's already-optional `requestDescriptorSha256`.

**Tech Stack:** Manifest V3 Chrome extension, browser ES modules, Node.js 22+, `node:test`, existing acquisition contract/journal/verifier/manifest packages, GitHub Actions.

## Global Constraints

- Full-song master WAV only; stems and Studio exports are out of scope.
- The operator initiates Suno's normal Download → WAV action; do not reconstruct hidden endpoints.
- Exact URLs, query strings, fragments, cookies, authorization headers, tokens, session material, and browser storage never become durable evidence.
- `downloads` remains optional runtime authority; do not add `cookies`, `webRequest`, `<all_urls>`, Native Messaging, telemetry, or server acquisition.
- Exactly one WAV witness may be armed. If a second matching WAV begins before the first bound WAV resolves, fail closed as `wav_witness_ambiguous`.
- Browser-download WAV evidence may omit `requestDescriptorSha256`; never fabricate it.
- `audio_wav` must pass RIFF/WAVE or RF64/WAVE header sanity before a verified receipt is written.
- `--vault-root` may target an external drive; the browser gets no direct authority over that drive.
- The 25-track/full-corpus control stays disabled throughout B2C.
- Manual `pilot:admit` is temporary proof ceremony only. Later local-companion automation must reuse this same admission boundary rather than weakening it.

---

### Task 1: Recognize WAV as observed evidence

**Files:**
- Modify: `extension/src/provider/suno/live-observer.js`
- Test: `tests/live-observer.test.js`

**Interfaces:**
- Produces: `audio_wav` in `proposedAssets`; `.wav` and explicit WAV MIME surfaces classify as `audio_wav`.

- [ ] **Step 1: Write the failing tests**

Add a test using a `<source type="audio/wav" src="https://cdn.example.test/song.wav?sig=ephemeral">` and an `<a href="https://cdn.example.test/song.wav?...">`. Require `audio_wav`, a query/fragment-free request preview, and unchanged MP3/artwork behavior.

- [ ] **Step 2: Run RED**

```bash
node --test tests/live-observer.test.js
```

Expected: the new WAV assertions fail.

- [ ] **Step 3: Implement minimal classification**

```js
const PROPOSED_ASSETS = Object.freeze(['raw_metadata', 'lyrics', 'artwork', 'audio_mp3', 'audio_wav']);
const WAV_PATH = /\.wav$/i;

// For AUDIO/SOURCE:
if (type === 'audio/wav' || WAV_PATH.test(pathname)) assetRole = 'audio_wav';
else if (type === 'audio/mpeg' || MP3_PATH.test(pathname)) assetRole = 'audio_mp3';
else assetRole = 'other';

// For A:
if (tagName === 'A' && WAV_PATH.test(pathname)) {
  assetRole = 'audio_wav';
  surface = 'link';
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/live-observer.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/provider/suno/live-observer.js tests/live-observer.test.js
git commit -m "feat: witness honest Suno WAV surfaces"
```

### Task 2: Add a pure future-only WAV binder

**Files:**
- Create: `extension/src/sidepanel/wav-witness.js`
- Create: `tests/wav-witness.test.js`

**Interfaces:**
- Consumes: arm `{ runId, providerTrackId, observedAt, armedAtMs }`, current bound download ID, Chrome `DownloadItem`.
- Produces: `bindCreatedWav(...) -> ignored | bound | ambiguous`; bound evidence never contains URL/referrer fields.

- [ ] **Step 1: Write failing tests**

Cover: no arm → ignored; pre-arm item → ignored; MP3 → ignored; `.wav` filename → bound; WAV MIME → bound; explicit non-Suno referrer → ignored; absent referrer → allowed; second matching WAV with an active ID → `ambiguous`; returned bound object has no `url`, `finalUrl`, or `referrer`.

- [ ] **Step 2: Run RED**

```bash
node --test tests/wav-witness.test.js
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement**

```js
const SUNO_ORIGINS = new Set(['https://suno.com', 'https://www.suno.com']);
const WAV_MIMES = new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']);

export function isWavDownloadItem(item) {
  const filename = typeof item?.filename === 'string' ? item.filename.toLowerCase() : '';
  const mime = typeof item?.mime === 'string' ? item.mime.toLowerCase() : '';
  return filename.endsWith('.wav') || WAV_MIMES.has(mime);
}

function referrerIsCompatible(referrer) {
  if (!referrer) return true;
  try { return SUNO_ORIGINS.has(new URL(referrer).origin); }
  catch { return false; }
}

export function bindCreatedWav({ arm, activeDownloadId = null, item } = {}) {
  if (!arm || !isWavDownloadItem(item)) return Object.freeze({ status: 'ignored' });
  const startedAtMs = Date.parse(item?.startTime ?? '');
  if (!Number.isFinite(startedAtMs) || startedAtMs < arm.armedAtMs) return Object.freeze({ status: 'ignored' });
  if (!referrerIsCompatible(item?.referrer)) return Object.freeze({ status: 'ignored' });
  if (!Number.isInteger(item?.id) || typeof item?.filename !== 'string' || !item.filename) return Object.freeze({ status: 'ignored' });
  if (activeDownloadId !== null) return Object.freeze({ status: 'ambiguous' });
  return Object.freeze({ status: 'bound', downloadId: item.id, filename: item.filename, mime: item.mime ?? '' });
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/wav-witness.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/wav-witness.js tests/wav-witness.test.js
git commit -m "feat: add one-shot WAV download binder"
```

### Task 3: Wire the one-shot witness into the side panel

**Files:**
- Modify: `extension/src/sidepanel/index.html`
- Modify: `extension/src/sidepanel/index.js`
- Modify: `tests/phase-b2-ui.test.js`

**Interfaces:**
- Consumes: Task 2 binder and existing optional Downloads permission.
- Produces: per-track **Witness one WAV**, future-only `onCreated` binding, safe completion/interruption status.

- [ ] **Step 1: Write failing UI/source tests**

Require the UI/source to contain `Witness one WAV`, `chrome.downloads.onCreated.addListener`, `bindCreatedWav`, `chrome.downloads.search({ id: ... })`, and `audio_wav`. Keep the existing forbidden-authority assertions and disabled 25-track control.

- [ ] **Step 2: Run RED**

```bash
node --test tests/phase-b2-ui.test.js
```

Expected: FAIL on only the new requirements.

- [ ] **Step 3: Arm one selected track**

Import Task 2 helpers and add:

```js
let armedWavWitness = null;
```

A per-track arm button must refuse unless transport is enabled, provider ID and `latestObservation.observedAt` exist, and no arm/download is active. It creates:

```js
armedWavWitness = Object.freeze({
  runId: runId(),
  providerTrackId: track.providerTrackId,
  observedAt: latestObservation.observedAt,
  armedAtMs: Date.now(),
});
selectedProviderTrackId = track.providerTrackId;
```

Disable ordinary staging buttons while the WAV arm exists.

- [ ] **Step 4: Register Downloads listeners only after permission grant**

Post-grant, require `downloads.download`, `downloads.search`, `downloads.onCreated`, and `downloads.onChanged`. Then register:

```js
chrome.downloads.onCreated.addListener(observeCreatedDownload);
chrome.downloads.onChanged.addListener(observeDownloadChanges);
```

Do not require these permission-gated APIs before `chrome.permissions.request({ permissions: ['downloads'] })`.

- [ ] **Step 5: Bind a future WAV without losing the ambiguity guard**

`observeCreatedDownload(item)` calls:

```js
const bound = bindCreatedWav({
  arm: armedWavWitness,
  activeDownloadId: activeDownload?.mode === 'user_wav' ? activeDownload.downloadId : null,
  item,
});
```

On `bound`, set:

```js
activeDownload = Object.freeze({
  mode: 'user_wav',
  downloadId: bound.downloadId,
  runId: armedWavWitness.runId,
  providerTrackId: armedWavWitness.providerTrackId,
  assetRole: 'audio_wav',
  observedAt: armedWavWitness.observedAt,
  filename: bound.filename,
});
```

**Do not clear `armedWavWitness` yet.** It must remain until completion/interruption so a second matching WAV races through the binder and returns `ambiguous`. On `ambiguous`, clear both arm and active witness and report `wav_witness_ambiguous`.

Never copy `item.url`, `item.finalUrl`, or `item.referrer` into state/status/storage.

- [ ] **Step 6: Resolve the final filename on completion**

For `mode === 'user_wav'` and `state.current === 'complete'`:

```js
const [item] = await chrome.downloads.search({ id: completed.downloadId });
if (!item || !isWavDownloadItem(item)) {
  transportStatus.textContent = 'WAV witness refused: completed download no longer has WAV evidence.';
  armedWavWitness = null;
  return;
}
```

Use only `item.filename` as the staged local path. Report `role audio_wav` and `request descriptor unavailable by design`. On completion or interruption, clear both `activeDownload` and `armedWavWitness`.

- [ ] **Step 7: Run GREEN**

```bash
node --test tests/phase-b2-ui.test.js tests/wav-witness.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add extension/src/sidepanel/index.html extension/src/sidepanel/index.js tests/phase-b2-ui.test.js
git commit -m "feat: witness one user-triggered Suno WAV"
```

### Task 4: Admit only sane WAV bytes and allow absent request descriptors

**Files:**
- Create: `packages/wav/index.js`
- Create: `tests/wav.test.js`
- Modify: `scripts/admit-staged-asset.js`
- Modify: `tests/admit-staged-asset.test.js`

**Interfaces:**
- Produces: `assertWavContainer(path)` and `pilot:admit` parity with the optional durable request descriptor.

- [ ] **Step 1: Write failing WAV tests**

Use minimal 12-byte headers:

```js
const riff = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]);
const rf64 = Buffer.concat([Buffer.from('RF64'), Buffer.alloc(4), Buffer.from('WAVE')]);
```

Require RIFF and RF64 to pass, `not-wave-data` to reject, an `audio_wav` admission without `requestDescriptorSha256` to verify, and fake `.wav` bytes to refuse before the journal exists.

- [ ] **Step 2: Run RED**

```bash
node --test tests/wav.test.js tests/admit-staged-asset.test.js
```

Expected: FAIL because the checker does not exist and the CLI currently requires the descriptor.

- [ ] **Step 3: Implement the WAV sanity helper**

```js
import { open } from 'node:fs/promises';

export async function assertWavContainer(path) {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    const container = header.toString('ascii', 0, 4);
    const wave = header.toString('ascii', 8, 12);
    if (bytesRead < 12 || !['RIFF', 'RF64'].includes(container) || wave !== 'WAVE') throw new Error('invalid WAV container');
  } finally {
    await handle.close();
  }
}
```

- [ ] **Step 4: Relax only `requestDescriptorSha256`**

```js
const requestDescriptorSha256 = options?.requestDescriptorSha256 === undefined
  ? undefined
  : requireString(options.requestDescriptorSha256, 'requestDescriptorSha256');
if (requestDescriptorSha256 !== undefined && !SHA256_HEX.test(requestDescriptorSha256)) {
  throw new Error('requestDescriptorSha256 must be lowercase SHA-256');
}
```

Include it in validation/final receipt only with:

```js
...(requestDescriptorSha256 === undefined ? {} : { requestDescriptorSha256 }),
```

All other admission fields remain mandatory.

- [ ] **Step 5: Enforce sanity before journal mutation**

Immediately after `assertStagedFile(input.stagedFile)`:

```js
if (input.assetRole === 'audio_wav') await assertWavContainer(input.stagedFile);
```

- [ ] **Step 6: Run GREEN**

```bash
node --test tests/wav.test.js tests/admit-staged-asset.test.js tests/contract.test.js tests/manifest.test.js
```

Expected: PASS; existing supplied-hash behavior remains intact.

- [ ] **Step 7: Commit**

```bash
git add packages/wav/index.js scripts/admit-staged-asset.js tests/wav.test.js tests/admit-staged-asset.test.js
git commit -m "feat: admit verified WAV bytes without fabricated request evidence"
```

### Task 5: Add a safe, temporary Windows admission handoff

**Files:**
- Create: `extension/src/sidepanel/powershell-handoff.js`
- Create: `tests/powershell-handoff.test.js`
- Modify: `extension/src/sidepanel/index.html`
- Modify: `extension/src/sidepanel/index.js`
- Modify: `extension/src/sidepanel/styles.css`

**Interfaces:**
- Produces: visible/copyable `pilot:admit` command using local path, chosen Vault root, run/track/role/time, and optional descriptor only.

- [ ] **Step 1: Write RED formatter tests**

Require PowerShell single-quote escaping, required flags, omission of `--request-descriptor-sha256` when absent, inclusion when supplied, and refusal of secret-shaped values.

- [ ] **Step 2: Run RED**

```bash
node --test tests/powershell-handoff.test.js
```

Expected: FAIL because the formatter does not exist.

- [ ] **Step 3: Implement formatter**

```js
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:authorization|cookie|session|token|password|secret)\s*[:=])/i;
function ps(value) {
  if (typeof value !== 'string' || !value || SECRET_VALUE.test(value)) throw new Error('unsafe handoff value');
  return `'${value.replaceAll("'", "''")}'`;
}
export function formatPowerShellAdmitCommand(input) {
  const parts = [
    'npm run pilot:admit --',
    `--staged-file ${ps(input.stagedFile)}`,
    `--vault-root ${ps(input.vaultRoot)}`,
    `--run-id ${ps(input.runId)}`,
    `--provider-track-id ${ps(input.providerTrackId)}`,
    `--asset-role ${ps(input.assetRole)}`,
    `--observed-at ${ps(input.observedAt)}`,
  ];
  if (input.requestDescriptorSha256 !== undefined) parts.push(`--request-descriptor-sha256 ${ps(input.requestDescriptorSha256)}`);
  return parts.join(' ');
}
```

- [ ] **Step 4: Add operator UI**

Add `Vault root for local admission`, placeholder `E:\Autodiscography-Vault`, a visible command area, and **Copy pilot:admit command**. Enable only after a completed witness and a non-empty Vault root. Copy via `navigator.clipboard.writeText(...)` only from that button gesture; add no clipboard permission. On copy failure, keep the command visible.

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/powershell-handoff.test.js tests/phase-b2-ui.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add extension/src/sidepanel/powershell-handoff.js extension/src/sidepanel/index.html extension/src/sidepanel/index.js extension/src/sidepanel/styles.css tests/powershell-handoff.test.js tests/phase-b2-ui.test.js
git commit -m "feat: expose safe Windows WAV admission handoff"
```

### Task 6: Lock the boundary and document the human specimen

**Files:**
- Modify: `README.md`
- Modify: `docs/PILOT-RUNBOOK.md`
- Modify: `docs/TRUST-BOUNDARY.md`
- Modify: `docs/NETWORK-BEHAVIOR.md`
- Modify: `tests/extension-boundary.test.js`

- [ ] **Step 1: Strengthen boundary assertions**

Require required extension permission `sidePanel`, optional `downloads`, Suno-only content-script matches, no `cookies`, `webRequest`, `<all_urls>`, Native Messaging, new host permissions, or browser storage, and the disabled 25-track control.

- [ ] **Step 2: Run boundary proof**

```bash
node --test tests/extension-boundary.test.js
```

Expected: PASS. Repair implementation if it fails; do not weaken the boundary.

- [ ] **Step 3: Document exact B2C operator flow**

Document:

```text
Refresh live witness → Enable pilot transport → Witness one WAV on one track →
use Suno's normal ... → Download → WAV → wait for completed local path →
enter external-drive Vault root → copy/run pilot:admit → independently hash final WAV.
```

State that the command step is temporary proof ceremony targeted for elimination by the later local companion.

- [ ] **Step 4: Run the complete suite**

```bash
npm test
npm run synthetic:pilot
```

Expected: all tests pass and the synthetic interruption/resume/idempotence proof remains green.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/PILOT-RUNBOOK.md docs/TRUST-BOUNDARY.md docs/NETWORK-BEHAVIOR.md tests/extension-boundary.test.js
git commit -m "docs: define the one-WAV human preservation gate"
```

### Task 7: Run the real full-song WAV gate and reconcile truth state

**Files/records:**
- GitHub: issue #8 and PR #9.
- GitBook: CR #51.
- Local/external Vault: one verified `audio_wav` specimen.

- [ ] **Step 1: Keep PR #9 draft until exact-head automated verification is green**

Record the exact head SHA and green Actions run before field testing.

- [ ] **Step 2: Run one real signed-in Chrome specimen**

Pass criteria:

```text
provider track ID present
operator explicitly chooses WAV in Suno
exactly one future WAV bound
no ambiguity/refusal
completed local WAV path captured
pilot:admit uses assetRole=audio_wav
RIFF/WAVE or RF64/WAVE sanity passes
receipt state=verified
final file exists under selected external-drive Vault root
no signed URL/query/fragment/cookie/auth/token/session/browser-storage material is durable
25-track/full-corpus control remains disabled
```

- [ ] **Step 3: Independently verify Windows bytes**

```powershell
Get-FileHash -Algorithm SHA256 'E:\Autodiscography-Vault\assets\<provider-track-id>\audio_wav.wav'
(Get-Item 'E:\Autodiscography-Vault\assets\<provider-track-id>\audio_wav.wav').Length
```

Compare SHA-256 and byte length with the receipt.

- [ ] **Step 4: Reconcile GitHub and GitBook**

Update issue #8 / PR #9 with tested head, Actions run, provider track ID, byte length, SHA-256, and safe final-path pattern. Update GitBook CR #51 from proposal to human-witnessed proof only after the specimen passes.

- [ ] **Step 5: Stop at the next authority gate**

A successful B2C specimen authorizes a separate design for bounded multi-song WAV preservation. It does not enable 25-track or full-corpus acquisition by itself.
