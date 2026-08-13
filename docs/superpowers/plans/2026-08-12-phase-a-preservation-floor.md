# Phase A Preservation Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a synthetic-only, local-first preservation floor with an MV3 operator shell, append-only acquisition journal, exact SHA-256/byte-length verification, bounded receipts, and Corpus OS handoff projection.

**Architecture:** Keep the trusted core in small zero-runtime-dependency ESM modules tested with Node's built-in test runner. Keep the Chromium MV3 shell network-inert and provider-specific behavior behind a fixture-only `provider/suno` adapter. Raw observations remain immutable inputs; derived handoff data is emitted separately.

**Tech Stack:** JavaScript ESM, Node.js >= 22, `node:test`, Node `crypto`/`fs`, Manifest V3 HTML/CSS/JS.

## Global Constraints

- No live Suno requests in Phase A.
- No `host_permissions`, `cookies` permission, captured auth headers/tokens, browser database access, telemetry, or third-party corpus upload.
- Journal identity is `runId + providerTrackId + assetRole`; repeated keys append history rather than rewriting it.
- Verified receipts require both exact byte length and SHA-256.
- Raw provider observations and derived projections remain separately addressable.
- Explicit states are `verified | missing | partial | refused | failed`.
- No TranchNode, Exact Return, semantic-equivalence, lineage inference, or universal receipt ontology before the 25-track pilot.
- Tests use synthetic fixtures only.

---

## File map

- `package.json` — zero-dependency Node scripts and engine floor.
- `packages/acquisition-contract/index.js` — bounded roles/states, receipt validation, secret-shaped-field refusal.
- `packages/verifier/index.js` — byte/file SHA-256 + byte-length verification and mismatch check.
- `packages/journal/index.js` — append-only JSONL journal, strict read, latest-key derivation.
- `packages/manifest/index.js` — bounded Corpus OS handoff projection from receipts.
- `fixtures/synthetic-suno/raw/library.json` — fake provider observations only.
- `fixtures/synthetic-suno/assets/*` — tiny deterministic fake byte fixtures.
- `extension/manifest.json` — network-inert MV3 side-panel shell.
- `extension/src/provider/suno/fixture-adapter.js` — bundled fixture observations only; no fetch.
- `extension/src/sidepanel/index.html` — local operator surface.
- `extension/src/sidepanel/index.js` — renders synthetic proposals and lock status.
- `extension/src/sidepanel/styles.css` — minimal readable layout.
- `tests/contract.test.js` — receipt validation and secret-refusal proofs.
- `tests/verifier.test.js` — hash/length/corruption/same-name-different-byte proofs.
- `tests/journal.test.js` — append-only, resume, malformed-line proofs.
- `tests/manifest.test.js` — raw-vs-derived handoff proof.
- `tests/extension-boundary.test.js` — MV3 permission/network-inert checks.
- `scripts/synthetic-pilot.js` — deterministic Phase-A end-to-end synthetic run.
- `docs/TRUST-BOUNDARY.md` — authority boundary and stop conditions.
- `docs/NETWORK-BEHAVIOR.md` — Phase-A network declaration and future live-pilot rules.
- `docs/PILOT-RUNBOOK.md` — synthetic proof plus 25-track live gate, without live implementation.
- `docs/CORPUS-OS-HANDOFF.md` — exact handoff contract and downstream non-authority.
- `SECURITY.md` — secret/session handling and reporting.

### Task 1: Bounded acquisition contract and deterministic fixtures

**Files:**
- Create: `package.json`
- Create: `packages/acquisition-contract/index.js`
- Create: `fixtures/synthetic-suno/raw/library.json`
- Create: `fixtures/synthetic-suno/assets/track-alpha.mp3`
- Create: `fixtures/synthetic-suno/assets/track-alpha.txt`
- Test: `tests/contract.test.js`

**Interfaces:**
- Produces: `ASSET_ROLES`, `ACQUISITION_STATES`, `makeAcquisitionKey(entry)`, `validateReceipt(entry)`.
- `validateReceipt(entry)` returns a frozen normalized receipt containing only the bounded schema fields or throws a bounded error that never includes secret values.

- [ ] **Step 1: Write the failing contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReceipt, makeAcquisitionKey } from '../packages/acquisition-contract/index.js';

test('verified receipt requires exact hash and byte length', () => {
  assert.throws(() => validateReceipt({
    schemaVersion: 1,
    runId: 'pilot-001', provider: 'suno', providerTrackId: 'track-alpha',
    assetRole: 'audio_mp3', state: 'verified', observedAt: '2026-08-12T00:00:00.000Z'
  }), /verified receipt requires byteLength and sha256/);
});

test('secret-shaped fields fail closed without echoing value', () => {
  const secret = 'Bearer SUPER-SECRET';
  assert.throws(
    () => validateReceipt({
      schemaVersion: 1,
      runId: 'pilot-001', provider: 'suno', providerTrackId: 'track-alpha',
      assetRole: 'raw_metadata', state: 'refused', observedAt: '2026-08-12T00:00:00.000Z',
      authorization: secret
    }),
    error => !String(error.message).includes(secret) && /secret-shaped field refused/.test(error.message)
  );
});

test('acquisition key is run + track + role', () => {
  assert.equal(makeAcquisitionKey({ runId: 'r', providerTrackId: 't', assetRole: 'lyrics' }), 'r\u0000t\u0000lyrics');
});
```

- [ ] **Step 2: Run the contract tests and verify they fail because the module does not exist**

Run: `node --test tests/contract.test.js`
Expected: FAIL with module-not-found for `packages/acquisition-contract/index.js`.

- [ ] **Step 3: Implement the bounded contract**

```js
export const ASSET_ROLES = Object.freeze(['audio_mp3', 'audio_wav', 'artwork', 'raw_metadata', 'lyrics', 'other']);
export const ACQUISITION_STATES = Object.freeze(['verified', 'missing', 'partial', 'refused', 'failed']);
const ALLOWED = new Set(['schemaVersion','runId','provider','providerTrackId','assetRole','state','observedAt','sourceRelativePath','byteLength','sha256','reasonCode','rawMetadataPath','rawMetadataSha256']);
const SECRET_FIELD = /(authorization|cookie|password|token|secret|session)/i;

export function makeAcquisitionKey({ runId, providerTrackId, assetRole }) {
  return `${runId}\u0000${providerTrackId}\u0000${assetRole}`;
}

export function validateReceipt(input) {
  for (const key of Object.keys(input)) {
    if (SECRET_FIELD.test(key)) throw new Error(`secret-shaped field refused: ${key}`);
    if (!ALLOWED.has(key)) throw new Error(`unknown receipt field: ${key}`);
  }
  if (input.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (input.provider !== 'suno') throw new Error('provider must be suno');
  if (!ASSET_ROLES.includes(input.assetRole)) throw new Error('invalid assetRole');
  if (!ACQUISITION_STATES.includes(input.state)) throw new Error('invalid acquisition state');
  for (const key of ['runId','providerTrackId','observedAt']) if (!input[key]) throw new Error(`missing ${key}`);
  if (Number.isNaN(Date.parse(input.observedAt))) throw new Error('observedAt must be ISO-8601');
  if (input.state === 'verified') {
    if (!Number.isInteger(input.byteLength) || input.byteLength < 0 || !/^[a-f0-9]{64}$/.test(input.sha256 ?? '')) {
      throw new Error('verified receipt requires byteLength and sha256');
    }
  } else if (!input.reasonCode) {
    throw new Error('non-verified receipt requires reasonCode');
  }
  return Object.freeze({ ...input });
}
```

Create synthetic provider JSON with two fake tracks and no real account identifiers. Create two tiny deterministic fixture byte files with repository-local placeholder bytes only.

- [ ] **Step 4: Add zero-dependency package metadata and rerun the test**

```json
{
  "name": "autodiscography-vault",
  "version": "0.1.0-phase-a",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test tests/*.test.js",
    "synthetic:pilot": "node scripts/synthetic-pilot.js"
  }
}
```

Run: `node --test tests/contract.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json packages/acquisition-contract fixtures/synthetic-suno tests/contract.test.js
git commit -m "feat: define Phase A acquisition contract"
```

### Task 2: Exact verifier and append-only journal

**Files:**
- Create: `packages/verifier/index.js`
- Create: `packages/journal/index.js`
- Test: `tests/verifier.test.js`
- Test: `tests/journal.test.js`

**Interfaces:**
- Consumes: `validateReceipt`, `makeAcquisitionKey` from Task 1.
- Produces: `verifyBytes(bytes)`, `verifyFile(path)`, `assertMatchesReceipt(actual, expected)`, `appendJournalEntry(path, entry)`, `readJournal(path)`, `latestReceiptForKey(entries, key)`.

- [ ] **Step 1: Write verifier tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyBytes, assertMatchesReceipt } from '../packages/verifier/index.js';

test('hash and length are exact', () => {
  const result = verifyBytes(Buffer.from('alpha\n'));
  assert.equal(result.byteLength, 6);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('one-byte corruption is refused', () => {
  const expected = verifyBytes(Buffer.from('alpha\n'));
  const actual = verifyBytes(Buffer.from('alphb\n'));
  assert.throws(() => assertMatchesReceipt(actual, expected), /verification mismatch/);
});

test('same name is irrelevant when bytes differ', () => {
  assert.notEqual(verifyBytes(Buffer.from('one')).sha256, verifyBytes(Buffer.from('two')).sha256);
});
```

- [ ] **Step 2: Write journal tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendJournalEntry, readJournal, latestReceiptForKey } from '../packages/journal/index.js';
import { makeAcquisitionKey } from '../packages/acquisition-contract/index.js';

const base = state => ({ schemaVersion:1, runId:'r1', provider:'suno', providerTrackId:'t1', assetRole:'audio_mp3', state, observedAt:'2026-08-12T00:00:00.000Z' });

test('append preserves prior history and latest is derived', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-'));
  const path = join(dir, 'journal.jsonl');
  await appendJournalEntry(path, { ...base('partial'), reasonCode:'interrupted' });
  await appendJournalEntry(path, { ...base('verified'), byteLength:3, sha256:'a'.repeat(64) });
  const entries = await readJournal(path);
  assert.equal(entries.length, 2);
  assert.equal(latestReceiptForKey(entries, makeAcquisitionKey(entries[0])).state, 'verified');
  assert.equal((await readFile(path, 'utf8')).trim().split('\n').length, 2);
});

test('malformed journal line fails closed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vault-'));
  const path = join(dir, 'journal.jsonl');
  await writeFile(path, '{"schemaVersion":1}\n{broken\n');
  await assert.rejects(() => readJournal(path), /journal line 2 is invalid JSON/);
});
```

- [ ] **Step 3: Run focused tests and verify failure**

Run: `node --test tests/verifier.test.js tests/journal.test.js`
Expected: FAIL because verifier/journal modules do not exist.

- [ ] **Step 4: Implement verifier**

```js
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export function verifyBytes(bytes) {
  const buffer = Buffer.from(bytes);
  return { byteLength: buffer.byteLength, sha256: createHash('sha256').update(buffer).digest('hex') };
}
export async function verifyFile(path) { return verifyBytes(await readFile(path)); }
export function assertMatchesReceipt(actual, expected) {
  if (actual.byteLength !== expected.byteLength || actual.sha256 !== expected.sha256) {
    throw new Error(`verification mismatch: expected ${expected.byteLength}/${expected.sha256}, actual ${actual.byteLength}/${actual.sha256}`);
  }
  return true;
}
```

- [ ] **Step 5: Implement append-only journal**

```js
import { open, readFile } from 'node:fs/promises';
import { validateReceipt, makeAcquisitionKey } from '../acquisition-contract/index.js';

export async function appendJournalEntry(path, entry) {
  const receipt = validateReceipt(entry);
  const handle = await open(path, 'a', 0o600);
  try {
    await handle.write(`${JSON.stringify(receipt)}\n`);
    await handle.sync();
  } finally { await handle.close(); }
  return receipt;
}

export async function readJournal(path) {
  let text;
  try { text = await readFile(path, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (!text) return [];
  const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
  return lines.map((line, index) => {
    let parsed;
    try { parsed = JSON.parse(line); } catch { throw new Error(`journal line ${index + 1} is invalid JSON`); }
    return validateReceipt(parsed);
  });
}

export function latestReceiptForKey(entries, key) {
  return [...entries].reverse().find(entry => makeAcquisitionKey(entry) === key);
}
```

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/verifier.test.js tests/journal.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/verifier packages/journal tests/verifier.test.js tests/journal.test.js
git commit -m "feat: add append-only journal and exact verifier"
```

### Task 3: Bounded handoff manifest and synthetic end-to-end receipt

**Files:**
- Create: `packages/manifest/index.js`
- Create: `scripts/synthetic-pilot.js`
- Test: `tests/manifest.test.js`

**Interfaces:**
- Consumes: journal receipts and verifier outputs from Task 2.
- Produces: `buildHandoffManifest({ runId, receipts, rawMetadata })` and a synthetic pilot script that writes only into a temporary directory.

- [ ] **Step 1: Write manifest test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHandoffManifest } from '../packages/manifest/index.js';

test('handoff keeps raw metadata reference separate from derived record', () => {
  const manifest = buildHandoffManifest({
    runId:'r1',
    receipts:[{ schemaVersion:1, runId:'r1', provider:'suno', providerTrackId:'t1', assetRole:'audio_mp3', state:'verified', observedAt:'2026-08-12T00:00:00.000Z', sourceRelativePath:'assets/t1.mp3', byteLength:3, sha256:'a'.repeat(64), rawMetadataPath:'raw/library.json', rawMetadataSha256:'b'.repeat(64) }]
  });
  assert.equal(manifest.records[0].rawMetadata.path, 'raw/library.json');
  assert.equal(manifest.records[0].asset.sha256, 'a'.repeat(64));
  assert.equal(manifest.records[0].providerTrackId, 't1');
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `node --test tests/manifest.test.js`
Expected: FAIL because `packages/manifest/index.js` does not exist.

- [ ] **Step 3: Implement bounded manifest projection**

```js
export function buildHandoffManifest({ runId, receipts }) {
  return {
    schema: 'autodiscography-vault-handoff/v0',
    runId,
    records: receipts.map(receipt => ({
      provider: receipt.provider,
      providerTrackId: receipt.providerTrackId,
      observedAt: receipt.observedAt,
      state: receipt.state,
      reasonCode: receipt.reasonCode ?? null,
      asset: {
        role: receipt.assetRole,
        path: receipt.sourceRelativePath ?? null,
        byteLength: receipt.byteLength ?? null,
        sha256: receipt.sha256 ?? null
      },
      rawMetadata: receipt.rawMetadataPath ? {
        path: receipt.rawMetadataPath,
        sha256: receipt.rawMetadataSha256 ?? null
      } : null
    }))
  };
}
```

- [ ] **Step 4: Implement synthetic pilot script**

The script must create a temporary output directory, hash bundled fake assets, append a `partial` receipt, append a later `verified` receipt for the same key, read the journal, build the manifest, independently re-hash the final asset, and print only run ID/counts/paths/hashes. It must not contain network calls.

- [ ] **Step 5: Run synthetic pilot and tests**

Run: `npm run synthetic:pilot`
Expected: exit 0 and print a final summary with `verified: 1`, `historyEntries: 2`, and an independently checked SHA-256.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/manifest scripts/synthetic-pilot.js tests/manifest.test.js
git commit -m "feat: emit bounded preservation handoff"
```

### Task 4: Network-inert MV3 operator shell

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/src/provider/suno/fixture-adapter.js`
- Create: `extension/src/sidepanel/index.html`
- Create: `extension/src/sidepanel/index.js`
- Create: `extension/src/sidepanel/styles.css`
- Test: `tests/extension-boundary.test.js`

**Interfaces:**
- Produces: `listSyntheticTracks()` returning bundled fake observations and a side panel that renders proposals without network access.

- [ ] **Step 1: Write extension-boundary tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
const adapter = await readFile(new URL('../extension/src/provider/suno/fixture-adapter.js', import.meta.url), 'utf8');

test('MV3 shell has no live-origin or cookie authority', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal('host_permissions' in manifest, false);
  assert.equal((manifest.permissions ?? []).includes('cookies'), false);
});

test('fixture adapter contains no network primitive', () => {
  assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(adapter), false);
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `node --test tests/extension-boundary.test.js`
Expected: FAIL because the extension files do not exist.

- [ ] **Step 3: Implement manifest and fixture adapter**

Use MV3 with only `sidePanel` and `storage` permissions, a side panel path of `src/sidepanel/index.html`, and no content scripts, background network worker, host permissions, or externally connectable surface. The adapter must return hard-coded/small bundled synthetic observations only.

- [ ] **Step 4: Implement local side panel**

Render a permanent boundary banner: `SYNTHETIC ONLY — no live Suno network access; no cookies/session capture.` Render the fixture track IDs and proposed asset roles. Render the live-pilot control as disabled with copy `Locked until Phase-A receipt passes`.

- [ ] **Step 5: Run extension boundary and full tests**

Run: `node --test tests/extension-boundary.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add extension tests/extension-boundary.test.js
git commit -m "feat: add network-inert MV3 operator shell"
```

### Task 5: Trust, network, pilot, handoff, and security documentation

**Files:**
- Create: `docs/TRUST-BOUNDARY.md`
- Create: `docs/NETWORK-BEHAVIOR.md`
- Create: `docs/PILOT-RUNBOOK.md`
- Create: `docs/CORPUS-OS-HANDOFF.md`
- Create: `SECURITY.md`
- Modify: `README.md`

**Interfaces:**
- Documents the exact Phase-A behavior and the stop gate before Phase B.

- [ ] **Step 1: Write the trust and network declarations**

`TRUST-BOUNDARY.md` must restate explicit gesture, local-only output, exact-byte verification, raw/derived separation, and fail-closed secret/auth conditions.

`NETWORK-BEHAVIOR.md` must declare Phase A network activity as **none** and list the exact permissions absent from the MV3 manifest. Future live behavior must be described as a separate experimental phase, not current capability.

- [ ] **Step 2: Write pilot and handoff docs**

`PILOT-RUNBOOK.md` must separate the runnable synthetic Phase-A proof from the still-locked 25-track Phase-B procedure. The Phase-B gate must require operator inspection, interruption/resume, exact verification, explicit incomplete states, secret inspection, and a second-device copy before scale-up.

`CORPUS-OS-HANDOFF.md` must map Vault fields to the bounded needs in `corpus-os#3` and state that the handoff creates no semantic authority, lineage, canon, or completeness claim.

- [ ] **Step 3: Write SECURITY.md and update README**

Document forbidden secret/session handling, no live provider implementation, synthetic-only test data, responsible reporting, and September 3, 2026 as the external preservation deadline without claiming legal interpretation of the provider change.

README must show current status: Phase A synthetic floor, Phase B live pilot locked.

- [ ] **Step 4: Run complete validation**

Run: `npm test`
Expected: all tests PASS.

Run: `npm run synthetic:pilot`
Expected: exit 0 with independently verified exact bytes and append history.

Run: `grep -RniE "chrome\.cookies|authorization:|bearer |document\.cookie|host_permissions|https?://.*suno" extension packages scripts fixtures tests --exclude='*.md'`
Expected: no live-auth/network implementation matches; any `host_permissions` occurrence should be limited to the negative test assertion text.

- [ ] **Step 5: Commit**

```bash
git add README.md SECURITY.md docs
git commit -m "docs: define preservation trust and pilot gates"
```

### Task 6: PR evidence and P0 cross-link

**Files:**
- No code changes unless validation reveals a defect.

**Interfaces:**
- Produces a PR closing Vault issue #1 while explicitly leaving `corpus-os#4` open for the 25-track pilot and full preservation run.

- [ ] **Step 1: Re-run repository-wide proof from branch head**

Run: `npm test && npm run synthetic:pilot`
Expected: both exit 0.

- [ ] **Step 2: Review the diff for scope creep**

Confirm there is no live Suno request code, no provider credentials/session extraction, no TranchNode/Exact Return implementation, and no real corpus material.

- [ ] **Step 3: Open PR**

PR title: `Phase A: establish Autodiscography Vault preservation floor`

PR body must include:

```markdown
## Summary
- bootstraps the network-inert MV3/local-first shell
- adds bounded acquisition receipts, append-only journal, and exact SHA-256/byte-length verification
- adds synthetic-only provider fixtures and end-to-end preservation proof
- documents trust, network, pilot, security, and Corpus OS handoff boundaries

## Validation
- `npm test`
- `npm run synthetic:pilot`

## Boundary
No live Suno requests, cookies/session extraction, telemetry, semantic inference, TranchNode, or Exact Return logic are introduced here. Phase B remains locked behind the 25-track pilot gate.

Closes #1

Related: the-static-collective/corpus-os#4
```

- [ ] **Step 4: Link the PR back to Corpus OS #4**

Comment on `corpus-os#4` with the Vault PR URL and state that this is Phase A only; #4 must remain open until the 25-track pilot receipt and subsequent preservation run gates pass.

- [ ] **Step 5: Verify PR/check state before closeout**

Inspect PR metadata and any CI/check results. Report pending/unavailable checks exactly rather than implying they passed.
