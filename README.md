# Autodiscography Vault

Local-first preservation instrument for the Static Collective's Autodiscography corpus.

**Current state: Phase B2 — one-track browser transport into exact local admission. Automated proof is green; the signed-in human specimen is still pending.**

The external preservation deadline recorded by the project is **September 3, 2026**. Urgency may accelerate transport work; it does not widen the trust boundary.

> Preserve the body before the window narrows. Speed up transport, not trust.

## What exists now

- Manifest V3 Chromium side panel;
- a permanent, read-only content script limited to `https://suno.com/*` and `https://www.suno.com/*`;
- live DOM witness aggregation by provider identity, repairing sparse first-observation titles when richer duplicate evidence exists;
- at most **25** proposed track candidates per observation;
- `proposedAssets` kept distinct from actually observed media/link transport surfaces;
- exact request preview whose durable identity excludes URL query/fragment material;
- Chrome `downloads` declared only as an optional permission and requested only from **Enable pilot transport**;
- one-track, one-asset staging below `Downloads/Autodiscography-Vault/<run-id>/`;
- local `pilot:admit` bridge through existing SHA-256/byte-length verification, `.partial` promotion, append-only journal, and handoff manifest;
- durable `requestDescriptorSha256` evidence without durable exact transport URLs;
- explicit `wrong_origin`, `no_tracks_observed`, `unsupported_page_shape`, `pilot_cap_reached`, and `reusable_auth_required` witness states/warnings;
- explicit `verified`, `missing`, `partial`, `refused`, and `failed` acquisition states;
- adversarial tests for corruption, torn journal writes, secret-shaped material, and permission/network creep.

## What remains closed

- **no 25-track transport button**;
- no full-corpus acquisition;
- no cookies/session/token extraction;
- no `webRequest`, authorization-header capture, browser-database access, or reusable session material;
- no Native Messaging;
- no telemetry, Vercel/server corpus hop, or third-party corpus upload;
- no TranchNode, Exact Return, semantic-equivalence, lineage, or universal receipt ontology;
- no real corpus material in Git.

## Verify locally

Requires Node.js 22 or newer.

```bash
npm ci
npm test
npm run synthetic:pilot
```

For a Chrome-staged specimen, local admission is:

```bash
npm run pilot:admit -- \
  --staged-file <local-staged-file> \
  --vault-root <local-vault-root> \
  --run-id <run-id-shown-by-extension> \
  --provider-track-id <provider-track-id> \
  --asset-role <asset-role> \
  --observed-at <canonical-UTC-ISO-time> \
  --request-descriptor-sha256 <hash-shown-by-extension>
```

The command accepts local bytes and non-secret evidence only. It has no transport-URL argument.

## Phase B2 human witness

Load `extension/` as an unpacked Chromium extension, sign in normally at the real Suno origin, open the library/page containing your tracks, and press **Refresh live witness**.

The required one-track specimen is:

1. confirm a real title is enriched where duplicate DOM witnesses permit it;
2. confirm at least one `observedAssets` surface exists;
3. inspect the redacted request preview and SHA-256;
4. press **Enable pilot transport** and grant only the optional Downloads capability;
5. stage exactly one observed asset;
6. run `pilot:admit` against that staged local file;
7. independently confirm the final byte length/SHA-256 equals the receipt;
8. inspect journal/handoff output and confirm no exact signed URL, query/fragment, cookie, header, token, or reusable session material appears.

Until that specimen passes, **Acquire 25-track pilot remains disabled**.

## Operator boundary

Read before the human specimen:

- [`docs/TRUST-BOUNDARY.md`](docs/TRUST-BOUNDARY.md)
- [`docs/NETWORK-BEHAVIOR.md`](docs/NETWORK-BEHAVIOR.md)
- [`docs/PILOT-RUNBOOK.md`](docs/PILOT-RUNBOOK.md)
- [`docs/CORPUS-OS-HANDOFF.md`](docs/CORPUS-OS-HANDOFF.md)
- [`SECURITY.md`](SECURITY.md)

Design: [`docs/superpowers/specs/2026-08-15-phase-b2-one-track-transport-design.md`](docs/superpowers/specs/2026-08-15-phase-b2-one-track-transport-design.md)

Implementation plan: [`docs/superpowers/plans/2026-08-15-phase-b2-one-track-transport.md`](docs/superpowers/plans/2026-08-15-phase-b2-one-track-transport.md)

Tracking: [Vault issue #3](https://github.com/the-static-collective/autodiscography-vault/issues/3), downstream preservation program: [Corpus OS #4](https://github.com/the-static-collective/corpus-os/issues/4).
