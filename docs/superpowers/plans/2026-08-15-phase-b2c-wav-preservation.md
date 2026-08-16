# Phase B2C Full-song WAV Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove one real full-song Suno WAV can be witnessed from the normal signed-in web download flow, staged as local bytes, admitted as `audio_wav`, and verified under an operator-selected Vault root without exporting browser/session authority.

**Architecture:** Extend the existing Phase B2 browser membrane rather than replacing it. The live observer learns to identify honest WAV DOM surfaces, while the side panel adds a one-shot `chrome.downloads.onCreated` witness for the normal Suno Download → WAV flow when no DOM WAV URL exists. Local Node admission remains the durable authority boundary and gains a minimal WAV container sanity check plus parity with the contract's already-optional `requestDescriptorSha256`.

**Tech Stack:** Manifest V3 Chrome extension, browser ES modules, Node.js 22+, `node:test`, existing acquisition contract/journal/verifier/manifest packages, GitHub Actions.

## Global Constraints

- Full-song master WAV only; stems and Studio exports remain out of scope.
- The operator initiates Suno's normal Download → WAV action; the extension must not synthesize a hidden provider endpoint.
- Exact signed URLs, query strings, fragments, cookies, authorization headers, tokens, session material, and browser storage must never enter durable receipts/manifests.
- `downloads` remains optional runtime authority; do not add `cookies`, `webRequest`, `<all_urls>`, Native Messaging, telemetry, or server-side acquisition.
- At most one WAV witness may be armed at a time; a second matching download before resolution fails closed as ambiguous.
- Browser-download WAV evidence may omit `requestDescriptorSha256`; never fabricate a descriptor hash.
- `audio_wav` admission must pass RIFF/WAVE or RF64/WAVE header sanity before a verified receipt is written.
- The operator may point `--vault-root` at an external drive; the browser receives no direct filesystem authority to that drive.
- The 25-track/full-corpus acquisition control stays disabled throughout B2C.
- Manual `pilot:admit` remains acceptable only for this proof gate. No B2C design choice may make command-line admission a permanent requirement; later local-companion automation must be able to reuse the same admission contract.

---

### Task 1: Recognize WAV as an honest observed asset

**Files:**
- Modify: `extension/src/provider/suno/live-observer.js`
- Test: `tests/live-observer.test.js`

**Interfaces:**
- Consumes: current `buildLiveObservation(...)`, `extractSunoCandidates(...)`, and observed-asset shape.
- Produces: `audio_wav` in `proposedAssets`; `.wav` and explicit WAV MIME surfaces normalize to observed assets with the existing safe request preview/hash behavior.

- [ ] **Step 1: Write failing WAV classifier tests**

Add tests that require `audio_wav` in proposed roles and verify DOM classification without changing existing MP3/artwork behavior:

```js
test('WAV is proposed and real WAV surfaces classify as audio_wav', () => {
  const observer = loadObserver();
  const songUrl = 'https://suno.com/song/track-wav';
  const wavUrl = 'https://cdn.example.test/track-wav.wav?sig=ephemeral#download';
  const node = element({
    tagName: 'DIV',
    attributes: { 'data-song-id': 'track-wav', 'data-title': 'WAV Track' },
    children: [
      element({ tagName: 'A', attributes: { href: songUrl } }),
      element({ tagName: 'SOURCE', attributes: { src: wavUrl, type: 'audio/wav' } }),
    ],
  });

  const extracted = observer.extractSunoCandidates({ querySelectorAll: () => [node] });
  const observation = observer.buildLiveObservation({
    origin: 'https://suno.com',
    candidates: extracted.candidates,
    candidateNodeCount: extracted.candidateNodeCount,
    observedAt: '2026-08-15T21:00:00.000Z',
  });

  assert.equal(observation.tracks[0].proposedAssets.includes('audio_wav'), true);
  const wav = observation.tracks[0].observedAssets.find(asset => asset.assetRole === 'audio_wav');
  assert.ok(wav);
  assert.equal(wav.transportUrl, wavUrl);
  assert.equal(wav.requestPreview.includes('ephemeral'), false);
  assert.match(wav.requestPreview, /asset=audio_wav$/);
});
```

Also cover an `<a href="...wav">` surface and confirm an unknown audio type remains `other`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/live-observer.test.js
```

Expected: the new WAV assertions fail because `PROPOSED_ASSETS` and the classifier do not yet recognize `audio_wav`.

- [ ] **Step 3: Implement minimal WAV classification**

In `live-observer.js`, extend the role vocabulary and classifier:

```js
const PROPOSED_ASSETS = Object.freeze(['raw_metadata', 'lyrics', 'artwork', 'audio_mp3', 'audio_wav']);
const WAV_PATH = /\.wav$/i;

// AUDIO/SOURCE
if (type === 'audio/wav' || WAV_PATH.test(pathname)) {
  assetRole = 'audio_wav';
} else if (type === 'audio/mpeg' || MP3_PATH.test(pathname)) {
  assetRole = 'audio_mp3';
} else {
  assetRole = 'other';
}

// A
if (tagName === 'A' && WAV_PATH.test(pathname)) {
  assetRole = 'audio_wav';
  surface = 'link';
}
```

Do not add endpoint inference, host assumptions, or network interception.

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
node --test tests/live-observer.test.js
```

Expected: PASS, including all pre-existing MP3/artwork tests.

- [ ] **Step 5: Commit**

```bash
git add extension/src/provider/suno/live-observer.js tests/live-observer.test.js
git commit -m "feat: witness honest Suno WAV surfaces"
```

### Task 2: Add a pure one-shot WAV download binder

**Files:**
- Create: `extension/src/sidepanel/wav-witness.js`
- Create: `tests/wav-witness.test.js`

**Interfaces:**
- Consumes: a fresh arm `{ runId, providerTrackId, observedAt, armedAtMs }` and Chrome `DownloadItem` metadata.
- Produces: `bindCreatedWav({ arm, activeDownloadId, item }) -> { status: 'ignored' | 'bound' | 'ambiguous', ... }` with no URL/referrer copied into the bound result.

- [ ] **Step 1: Write failing pure-state tests**

Create `tests/wav-witness.test.js` covering: unarmed download ignored; pre-arm historical item ignored; MP3 ignored; `.wav` filename accepted; `audio/wav` MIME accepted; explicitly non-Suno referrer ignored; absent referrer allowed; second matching WAV while one is bound returns `ambiguous`; returned bound evidence contains no `url`, `finalUrl`, or `referrer`.

Use a representative arm:

```js
const arm = Object.freeze({
  runId: 'suno-b2c-test',
  providerTrackId: 'track-alpha',
  observedAt: '2026-08-15T21:00:00.000Z',
  armedAtMs: Date.parse('2026-08-15T21:00:01.000Z'),
});
```

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
node --test tests/wav-witness.test.js
```

Expected: FAIL because `wav-witness.js` does not exist.

- [ ] **Step 3: Implement the bounded binder**

Create the module with this public surface:

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
  try {
    return SUNO_ORIGINS.has(new URL(referrer).origin);
  } catch {
    return false;
  }
}

export function bindCreatedWav({ arm, activeDownloadId = null, item } = {}) {
  if (!arm || !isWavDownloadItem(item)) return Object.freeze({ status: 'ignored' });
  const startedAtMs = Date.parse(item?.startTime ?? '');
  if (!Number.isFinite(startedAtMs) || startedAtMs < arm.armedAtMs) return Object.freeze({ status: 'ignored' });
  if (!referrerIsCompatible(item?.referrer)) return Object.freeze({ status: 'ignored' });
  if (!Number.isInteger(item?.id) || typeof item?.filename !== 'string' || !item.filename) {
    return Object.freeze({ status: 'ignored' });
  }
  if (activeDownloadId !== null) return Object.freeze({ status: 'ambiguous' });
  return Object.freeze({
    status: 'bound',
    downloadId: item.id,
    filename: item.filename,
    mime: typeof item.mime === 'string' ? item.mime : '',
  });
}
```

The helper may inspect `referrer` transiently but must never return it.

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
node --test tests/wav-witness.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/wav-witness.js tests/wav-witness.test.js
git commit -m "feat: add one-shot WAV download binder"
```

### Task 3: Integrate the one-shot WAV witness into the side panel

**Files:**
- Modify: `extension/src/sidepanel/index.html`
- Modify: `extension/src/sidepanel/index.js`
- Modify: `tests/phase-b2-ui.test.js`

**Interfaces:**
- Consumes: `bindCreatedWav(...)`, `isWavDownloadItem(...)`, existing optional `downloads` permission, live track identity and observation time.
- Produces: one per-track **Witness one WAV** user gesture; a future-only `onCreated` binding; completion/interruption status containing only safe local/evidence fields.

- [ ] **Step 1: Add failing UI/source-contract tests**

Extend `tests/phase-b2-ui.test.js` to require:

```js
assert.match(html, /Witness one WAV/i);
assert.match(js, /chrome\.downloads\.onCreated\.addListener/);
assert.match(js, /bindCreatedWav/);
assert.match(js, /chrome\.downloads\.search\s*\(\s*\{\s*id:/);
assert.match(js, /audio_wav/);
```

Also assert the 25-track acquisition button remains disabled and the source still contains none of the existing forbidden browser authorities.

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
node --test tests/phase-b2-ui.test.js
```

Expected: FAIL only on the new WAV-witness requirements.

- [ ] **Step 3: Add the per-track arm gesture**

Import the binder:

```js
import { bindCreatedWav, isWavDownloadItem } from './wav-witness.js';
```

Add state:

```js
let armedWavWitness = null;
```

Render a per-track button that is disabled unless pilot transport is enabled, the track has a provider ID, and no download/witness is active. On click, call `armWavWitness(track)`.

`armWavWitness(track)` must:

```js
const observedAt = latestObservation?.observedAt;
const currentRunId = runId();
armedWavWitness = Object.freeze({
  runId: currentRunId,
  providerTrackId: track.providerTrackId,
  observedAt,
  armedAtMs: Date.now(),
});
selectedProviderTrackId = track.providerTrackId;
transportStatus.textContent = `WAV witness armed for track ${track.providerTrackId}. In Suno, choose Download → WAV now.`;
```

Refuse if transport is disabled, identity/timestamp is absent, another track is already bound for the B2 session, or any download/witness is already active.

- [ ] **Step 4: Bind only future Chrome WAV downloads**

After optional Downloads permission is granted, register both listeners:

```js
chrome.downloads.onCreated.addListener(observeCreatedDownload);
chrome.downloads.onChanged.addListener(observeDownloadChanges);
```

`observeCreatedDownload(item)` calls `bindCreatedWav(...)`. On `bound`, create an `activeDownload` with:

```js
activeDownload = Object.freeze({
  mode: 'user_wav',
  downloadId: bound.downloadId,
  runId: armedWavWitness.runId,
  providerTrackId: armedWavWitness.providerTrackId,
  assetRole: 'audio_wav',
  observedAt: armedWavWitness.observedAt,
  requestDescriptorSha256: undefined,
  filename: bound.filename,
});
armedWavWitness = null;
```

On `ambiguous`, clear the arm/active witness and report `wav_witness_ambiguous`; do not emit a staged result.

Never copy `item.url`, `item.finalUrl`, or `item.referrer` into `activeDownload`, status text, storage, or messages.

- [ ] **Step 5: Resolve the final local filename at completion**

Make `observeDownloadChanges` async. For `mode === 'user_wav'` and `state.current === 'complete'`, query only the bound ID:

```js
const [item] = await chrome.downloads.search({ id: completed.downloadId });
if (!item || !isWavDownloadItem(item)) {
  transportStatus.textContent = 'WAV witness refused: completed download no longer has WAV evidence.';
  return;
}
```

Use only `item.filename` from the search result. The staged status must say `role audio_wav` and explicitly say `request descriptor unavailable by design` rather than inventing a hash.

On `interrupted`, clear both active and armed state and keep the journal untouched.

- [ ] **Step 6: Re-run focused UI tests**

Run:

```bash
node --test tests/phase-b2-ui.test.js tests/wav-witness.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add extension/src/sidepanel/index.html extension/src/sidepanel/index.js tests/phase-b2-ui.test.js
git commit -m "feat: witness one user-triggered Suno WAV"
```

### Task 4: Make local admission honest for WAV and optional request descriptors

**Files:**
- Create: `packages/wav/index.js`
- Modify: `scripts/admit-staged-asset.js`
- Modify: `tests/admit-staged-asset.test.js`
- Create: `tests/wav.test.js`

**Interfaces:**
- Consumes: staged local path and existing `admitStagedAsset(options)`.
- Produces: `assertWavContainer(path)`; `pilot:admit` accepts omitted `requestDescriptorSha256` when the acquisition contract permits it; verified `audio_wav` is minted only for RIFF/WAVE or RF64/WAVE bytes.

- [ ] **Step 1: Write failing WAV-container tests**

Create `tests/wav.test.js` with minimal headers:

```js
const riff = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]);
const rf64 = Buffer.concat([Buffer.from('RF64'), Buffer.alloc(4), Buffer.from('WAVE')]);
```

Require both to pass and `Buffer.from('not-wave-data')` to reject with `invalid WAV container`.

- [ ] **Step 2: Write failing admission-parity tests**

Extend `tests/admit-staged-asset.test.js` with an `audio_wav` fixture that omits `requestDescriptorSha256`. Require:

```js
assert.equal(result.receipt.assetRole, 'audio_wav');
assert.equal('requestDescriptorSha256' in result.receipt, false);
assert.equal(handoff.records[0].requestDescriptorSha256, null);
```

Also assert a fake `.wav` containing non-WAV bytes is rejected before `receipts/acquisition.jsonl` exists, and a supplied malformed request descriptor still refuses.

- [ ] **Step 3: Run and confirm RED**

Run:

```bash
node --test tests/wav.test.js tests/admit-staged-asset.test.js
```

Expected: FAIL because the WAV checker does not exist and `pilot:admit` currently requires the descriptor hash.

- [ ] **Step 4: Implement the 12-byte container sanity gate**

Create `packages/wav/index.js`:

```js
import { open } from 'node:fs/promises';

export async function assertWavContainer(path) {
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    const container = header.toString('ascii', 0, 4);
    const wave = header.toString('ascii', 8, 12);
    if (bytesRead < 12 || !['RIFF', 'RF64'].includes(container) || wave !== 'WAVE') {
      throw new Error('invalid WAV container');
    }
  } finally {
    await handle.close();
  }
}
```

This is only a container sanity check; do not parse audio semantics or transcode.

- [ ] **Step 5: Relax only the request-descriptor requirement**

In `validateInputs(options)`:

```js
const requestDescriptorSha256 = options?.requestDescriptorSha256 === undefined
  ? undefined
  : requireString(options.requestDescriptorSha256, 'requestDescriptorSha256');
if (requestDescriptorSha256 !== undefined && !SHA256_HEX.test(requestDescriptorSha256)) {
  throw new Error('requestDescriptorSha256 must be lowercase SHA-256');
}
```

When constructing the validation probe and final receipt, include the field conditionally:

```js
...(requestDescriptorSha256 === undefined ? {} : { requestDescriptorSha256 }),
```

All other required admission fields remain required.

- [ ] **Step 6: Enforce WAV sanity before durable mutation**

After `assertStagedFile(input.stagedFile)` and before journal/final promotion:

```js
if (input.assetRole === 'audio_wav') {
  await assertWavContainer(input.stagedFile);
}
```

Do not apply the WAV parser to `audio_mp3`, artwork, or other existing roles.

- [ ] **Step 7: Re-run focused admission tests**

Run:

```bash
node --test tests/wav.test.js tests/admit-staged-asset.test.js tests/contract.test.js tests/manifest.test.js
```

Expected: PASS, including existing supplied-hash behavior.

- [ ] **Step 8: Commit**

```bash
git add packages/wav/index.js scripts/admit-staged-asset.js tests/wav.test.js tests/admit-staged-asset.test.js
git commit -m "feat: admit verified WAV bytes without fabricated request evidence"
```

### Task 5: Make the Windows/external-drive handoff copyable but explicitly temporary

**Files:**
- Create: `extension/src/sidepanel/powershell-handoff.js`
- Create: `tests/powershell-handoff.test.js`
- Modify: `extension/src/sidepanel/index.html`
- Modify: `extension/src/sidepanel/index.js`
- Modify: `extension/src/sidepanel/styles.css`

**Interfaces:**
- Consumes: completed staged filename, operator-entered Vault root, run/track/role/time, optional request descriptor.
- Produces: a visible/copyable `npm run pilot:admit -- ...` PowerShell command containing only safe local/evidence fields.

- [ ] **Step 1: Write failing command-format tests**

Create `tests/powershell-handoff.test.js` requiring a formatter:

```js
const command = formatPowerShellAdmitCommand({
  stagedFile: `C:\\Users\\Example User\\Downloads\\Song's master.wav`,
  vaultRoot: 'E:\\Autodiscography-Vault',
  runId: 'suno-b2c-test',
  providerTrackId: 'track-alpha',
  assetRole: 'audio_wav',
  observedAt: '2026-08-15T21:00:00.000Z',
});
```

Require PowerShell-safe single-quote escaping (`'` becomes `''`), all required flags, omission of `--request-descriptor-sha256` when absent, inclusion when a valid hash is supplied, and rejection if any supplied field contains secret-shaped authorization/cookie/token/session material.

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
node --test tests/powershell-handoff.test.js
```

Expected: FAIL because the formatter does not exist.

- [ ] **Step 3: Implement the pure formatter**

Create `powershell-handoff.js` with:

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
  if (input.requestDescriptorSha256 !== undefined) {
    parts.push(`--request-descriptor-sha256 ${ps(input.requestDescriptorSha256)}`);
  }
  return parts.join(' ');
}
```

- [ ] **Step 4: Add the temporary operator handoff UI**

Add a text input with label `Vault root for local admission` and placeholder `E:\Autodiscography-Vault`, a `<code>`/`<pre>` area for the command, and **Copy pilot:admit command**. Keep the copy button disabled until a completed staged witness and non-empty Vault root both exist.

Use `navigator.clipboard.writeText(command)` only from the explicit copy-button gesture; do not add a clipboard manifest permission. If clipboard writing fails, leave the visible command in place and report `Copy unavailable; command remains visible.`

- [ ] **Step 5: Re-run handoff and UI tests**

Run:

```bash
node --test tests/powershell-handoff.test.js tests/phase-b2-ui.test.js
```

Expected: PASS and no new forbidden authority in the side-panel source.

- [ ] **Step 6: Commit**

```bash
git add extension/src/sidepanel/powershell-handoff.js extension/src/sidepanel/index.html extension/src/sidepanel/index.js extension/src/sidepanel/styles.css tests/powershell-handoff.test.js tests/phase-b2-ui.test.js
git commit -m "feat: expose safe Windows WAV admission handoff"
```

### Task 6: Document the human WAV gate and prove the full regression surface

**Files:**
- Modify: `README.md`
- Modify: `docs/PILOT-RUNBOOK.md`
- Modify: `docs/TRUST-BOUNDARY.md`
- Modify: `docs/NETWORK-BEHAVIOR.md`
- Modify: `tests/extension-boundary.test.js`

**Interfaces:**
- Consumes: all B2C behavior from Tasks 1–5.
- Produces: operator instructions and executable boundary assertions that keep B2C one-WAV-only and preserve the BEE membrane.

- [ ] **Step 1: Add/extend boundary assertions before doc edits**

Update `tests/extension-boundary.test.js` to assert the manifest still has required permission exactly `sidePanel`, optional `downloads`, Suno-only content-script matches, and no `cookies`, `webRequest`, `<all_urls>`, `nativeMessaging`, or new host permissions.

Add a source scan that refuses durable/browser storage APIs in the WAV witness path and confirms the 25-track acquisition control remains disabled.

- [ ] **Step 2: Run the boundary test**

Run:

```bash
node --test tests/extension-boundary.test.js
```

Expected: PASS if Tasks 1–5 did not widen authority. If it fails, repair the implementation rather than weakening the assertion.

- [ ] **Step 3: Update operator/runbook documentation**

Document this exact B2C specimen:

```text
1. Reload the unpacked B2C extension in Chrome.
2. Open a normal signed-in Suno Library/Workspace page and Refresh live witness.
3. Enable pilot transport.
4. On exactly one track, click Witness one WAV.
5. In Suno, use its normal ... → Download → WAV action.
6. Wait for Vault to report the WAV staged local path.
7. Enter the external-drive Vault root, e.g. E:\Autodiscography-Vault.
8. Copy/run the generated pilot:admit command from the repository root.
9. Independently hash the final admitted WAV and compare byte length + SHA-256 with the receipt.
10. Inspect acquisition.jsonl and handoff.json for exact URL/query/fragment/cookie/auth/token/session leakage.
```

State explicitly that steps 7–8 are temporary B2C proof ceremony and are targeted for elimination by the later local-companion automation slice.

- [ ] **Step 4: Run the complete automated suite**

Run:

```bash
npm test
npm run synthetic:pilot
```

Expected: every test passes and the synthetic pilot still proves interruption/resume/idempotent verification.

- [ ] **Step 5: Perform a secret/capability regression scan**

Run:

```bash
grep -RniE "chrome\.storage|document\.cookie|localStorage|sessionStorage|webRequest|nativeMessaging|<all_urls>|authorization[[:space:]]*:|cookie[[:space:]]*:" extension packages scripts docs --exclude-dir=node_modules
```

Expected: no newly introduced runtime authority or durable secret capture. Documentation may mention forbidden terms only as explicit non-goals/boundaries.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/PILOT-RUNBOOK.md docs/TRUST-BOUNDARY.md docs/NETWORK-BEHAVIOR.md tests/extension-boundary.test.js
git commit -m "docs: define the one-WAV human preservation gate"
```

### Task 7: Human full-song WAV specimen and PR/GitBook reconciliation

**Files:**
- Modify after the specimen: `docs/PILOT-RUNBOOK.md` only if a real browser behavior correction is discovered.
- GitBook: update CR #51 only with observed evidence; do not present unrun behavior as proof.
- GitHub: update issue #8 / PR #9 with exact human evidence.

**Interfaces:**
- Consumes: B2C candidate build at an exact commit SHA.
- Produces: one verified `audio_wav` receipt and evidence sufficient to decide whether the 25-track WAV design gate may open.

- [ ] **Step 1: Keep PR #9 draft until automated verification is green**

Record exact head SHA and the green GitHub Actions run. Do not mark the PR ready merely because code exists.

- [ ] **Step 2: Run one real signed-in Chrome WAV specimen**

The specimen passes only if:

```text
provider track ID present
operator explicitly chooses WAV in Suno
exactly one future WAV is bound
completed local path ends in WAV evidence
pilot:admit uses assetRole=audio_wav
RIFF/WAVE or RF64/WAVE sanity passes
receipt state=verified
final byteLength and SHA-256 independently agree
final admitted file exists under the selected Vault root/external drive
no signed URL/query/fragment/cookie/auth/token/session/browser-storage material is durable
25-track/full-corpus control remains disabled
```

- [ ] **Step 3: Independently verify final bytes on Windows**

From PowerShell, compute the final hash without relying on the Vault receipt:

```powershell
Get-FileHash -Algorithm SHA256 'E:\Autodiscography-Vault\assets\<provider-track-id>\audio_wav.wav'
(Get-Item 'E:\Autodiscography-Vault\assets\<provider-track-id>\audio_wav.wav').Length
```

Compare both values with the receipt output.

- [ ] **Step 4: Reconcile GitHub and GitBook truth state**

Update PR #9 / issue #8 with the exact tested head, automated run, human track ID, byte length, SHA-256, and external-drive final path pattern. Update GitBook CR #51 from proposal language to human-witnessed proof only after the specimen passes.

- [ ] **Step 5: Stop at the next authority gate**

After the specimen passes, the next authorized work is a separate design for bounded multi-song WAV preservation. Do not silently enable the existing 25-track acquisition button or a full-corpus run in B2C.
