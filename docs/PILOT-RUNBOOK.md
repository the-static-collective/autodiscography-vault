# Pilot Runbook

## Automated preservation floor

Requires Node.js 22 or newer and a clean checkout with no real provider corpus material committed to Git.

```bash
npm ci
npm test
npm run synthetic:pilot
```

The automated suite must prove receipt validation, secret refusal, exact SHA-256/byte length, corruption detection, append-only/torn-journal behavior, explicit incomplete states, read-only provider observation, duplicate-witness enrichment, optional-only browser transport authority, request redaction, staged-byte admission, idempotent resume, and the existing synthetic interruption/promotion proof.

Any failure keeps live transport below the pilot gate.

## Phase B1 — live witness floor

1. Load `extension/` unpacked in a Chromium browser.
2. Sign in normally at the real Suno origin.
3. Open the page/library presenting your tracks.
4. Open the Vault side panel and press **Refresh live witness**.
5. Confirm no more than 25 grouped candidates are shown.
6. Confirm sparse duplicate witnesses are enriched where richer title/source evidence exists.
7. Confirm proposed roles are separate from `observedAssets`.
8. Confirm no cookie, token, header, session, browser database, or other reusable authentication material is displayed or persisted.

If the page shape is unsupported, preserve `unsupported_page_shape`. If the apparently necessary transport path requires reusable authentication extraction, preserve `reusable_auth_required` and stop.

## Phase B2 — one-track browser transport specimen

**This is the current human gate. Do not use the disabled 25-track acquisition control.**

### 1. Select real observed evidence

After refreshing the live witness, choose one track with:

- a real provider track ID;
- an enriched/credible title where available;
- at least one `observedAssets` entry;
- a displayed redacted request preview and 64-hex request descriptor hash.

The preview must contain origin + pathname, provider, track, and asset role. It must not show URL query/fragment material.

### 2. Grant transport explicitly

Press **Enable pilot transport**. Grant only Chrome's Downloads permission.

Do not approve cookie, all-sites, request-interception, browser-database, or Native Messaging authority.

### 3. Stage exactly one asset

Press the stage button for exactly one observed asset. Record the safe values shown by the panel:

- run ID;
- provider track ID;
- asset role;
- request descriptor SHA-256;
- Chrome download ID/state;
- resulting staged relative path.

Expected root:

```text
Downloads/Autodiscography-Vault/<run-id>/
```

If the download is interrupted, stop. No durable acquisition receipt exists yet.

### 4. Admit the local bytes

Run:

```bash
npm run pilot:admit -- \
  --staged-file <path-to-staged-file> \
  --vault-root <path-to-local-vault> \
  --run-id <run-id> \
  --provider-track-id <provider-track-id> \
  --asset-role <asset-role> \
  --observed-at <YYYY-MM-DDTHH:MM:SS.sssZ> \
  --request-descriptor-sha256 <64-hex-hash>
```

`pilot:admit` must:

1. validate all bounded inputs before journal mutation;
2. verify the staged file;
3. write a `0600` `.partial` final candidate;
4. verify `.partial` before atomic promotion;
5. append one `verified` receipt;
6. write `receipts/handoff.json`;
7. independently re-verify the final;
8. skip a second identical admission only after the existing final matches its receipt.

### 5. Inspect the witness

The specimen passes only when:

- final byte length and SHA-256 match the receipt;
- handoff contains provider ID, asset role, local path, exact byte identity, and `requestDescriptorSha256`;
- journal/handoff contain no `transportUrl` field;
- no exact signed URL, query/fragment, cookie, authorization header, bearer/session token, or browser-storage content appears in durable output;
- a corrupted final is refused rather than overwritten.

## Gate after the specimen

Only after the one-track signed-in witness passes may the same mechanism be proposed for a bounded **25-track transport pilot**. The 25-track pilot must still prove independent asset outcomes, interruption/resume, duplicate/alternate preservation, bounded handoff validation, and second-copy verification before full-corpus preservation is opened.

## External deadline

The project records **September 3, 2026** as the external preservation deadline. Operational work should complete materially earlier to leave room for verification, reruns, and a second physical copy.
