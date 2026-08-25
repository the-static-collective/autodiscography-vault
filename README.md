# Autodiscography Vault

Local-first preservation instrument for the Static Collective's Autodiscography corpus.

**Current state: Phase B2C one-WAV candidate plus a local-only Census v1 ingest engine. The real signed-in WAV remains the browser acquisition gate; Census v1 can preserve already-captured durable-safe observation packs without opening full-corpus browser authority.**

The external preservation deadline recorded by the project is **September 3, 2026**. Urgency may accelerate transport work; it does not widen the trust boundary.

> Preserve the body before the window narrows. Speed up transport, not trust.

## What exists now

- Manifest V3 Chromium side panel;
- a permanent read-only content script limited to `https://suno.com/*` and `https://www.suno.com/*`;
- live DOM witness aggregation by provider identity before the 25-track observation cap;
- `proposedAssets` kept distinct from actually observed media/link transport surfaces;
- first-class `audio_wav` proposal/classification for honest `.wav` / WAV MIME surfaces;
- Chrome `downloads` declared only as an optional permission and requested only from **Enable pilot transport**;
- direct one-asset staging for an actually observed transport URL;
- a separate one-shot **Witness one WAV** arm for the operator's normal Suno Download → WAV action when no honest DOM WAV URL exists;
- future-only Chrome WAV binding, explicit ambiguity refusal, and completed local filename lookup;
- local `pilot:admit` exact-byte admission through SHA-256/byte-length verification, `.partial` promotion, append-only journal, and handoff manifest;
- bounded RIFF/WAVE or RF64/WAVE sanity before an `audio_wav` verified receipt may be minted;
- optional durable `requestDescriptorSha256`: preserved when an honest request descriptor exists, omitted rather than fabricated when the browser-download witness has none;
- a temporary Windows handoff that builds a copyable `pilot:admit` command from safe local/evidence fields and an operator-selected Vault root;
- an external drive may be the Node-side Vault root without granting the browser direct filesystem authority to that drive;
- content-addressed, immutable raw NDJSON census-pack admission before normalization;
- versioned `census-v1` normalization with exact raw-record byte provenance;
- explicit field evidence for provider creation time, exact style prompt, exact lyrics, original lyric-generation prompt, parent, and WAV availability;
- typed negative space that keeps `known_null`, `not_observed`, `not_exposed`, `unavailable`, `refused`, `failed_to_fetch`, `artifact_known_bytes_unavailable`, and `historically_observed_now_missing` distinct;
- checkpointed normalization that safely truncates uncheckpointed derived tail bytes and resumes without duplicating raw history;
- explicit verified/incomplete/refusal states and adversarial tests for corruption, torn journals, secret-shaped material, permission creep, and WAV mislabeling.

## What remains closed

- **no 25-track transport button**;
- no full-corpus **browser acquisition** or hidden provider endpoint adapter;
- no stems or Studio project export acquisition in B2C;
- no hidden WAV endpoint reconstruction;
- no cookies/session/token extraction;
- no `webRequest`, authorization-header capture, browser-database access, or reusable session material;
- no Native Messaging;
- no telemetry, Vercel/server corpus hop, or third-party corpus upload;
- no real corpus material in Git.

## Verify locally

Requires Node.js 22 or newer.

```bash
npm ci
npm test
npm run synthetic:pilot
```

For a local durable-safe observation pack, Census v1 is:

```bash
npm run census:ingest -- \
  --input <observations.ndjson> \
  --vault-root <local-or-external-drive-vault-root>
```

The command first admits the exact input pack under its content hash, then builds a reproducible normalized projection. A later interpretation layer is deliberately not built. See [`docs/CENSUS-RUNBOOK.md`](docs/CENSUS-RUNBOOK.md).

`pilot:admit` accepts local bytes and non-secret evidence only. It has no provider transport-URL argument. For a direct observed transport, `--request-descriptor-sha256` remains available. For a user-triggered WAV witness with no honest request descriptor, that flag is intentionally omitted.

The extension now generates the Windows command after a completed staging event and a Vault root are supplied. The manual command is **temporary proof ceremony**; a later local companion is intended to remove the PowerShell step while reusing the same admission boundary.

## Phase B2C human WAV witness

Load `extension/` as an unpacked Chromium extension and sign in normally at Suno.

1. Open the page containing the target song and press **Refresh live witness**.
2. Confirm its real provider track ID and the displayed `Observed at` timestamp.
3. Press **Enable pilot transport** and grant only Downloads.
4. On exactly one track, press **Witness one WAV**.
5. In Suno itself, use the normal Download → WAV action.
6. Wait for Vault to report the completed absolute local `.wav` path.
7. Enter the external-drive Vault root you actually want, for example `E:\Autodiscography-Vault` if that is the correct drive on the test machine.
8. Copy the generated one-line PowerShell `pilot:admit` command and run it from the repository root.
9. Confirm the resulting receipt is `assetRole: audio_wav` and `state: verified`.
10. Independently compute the final file SHA-256 and byte length and compare them with the receipt.
11. Inspect `receipts/acquisition.jsonl` and `receipts/handoff.json` and confirm they contain no signed URL/query/fragment, cookie, authorization header, token, session material, or browser storage.

Until this specimen passes, **Acquire 25-track pilot remains disabled**.

## Operator boundary

Read before the human specimen:

- [`docs/TRUST-BOUNDARY.md`](docs/TRUST-BOUNDARY.md)
- [`docs/NETWORK-BEHAVIOR.md`](docs/NETWORK-BEHAVIOR.md)
- [`docs/PILOT-RUNBOOK.md`](docs/PILOT-RUNBOOK.md)
- [`docs/CORPUS-OS-HANDOFF.md`](docs/CORPUS-OS-HANDOFF.md)
- [`docs/CENSUS-RUNBOOK.md`](docs/CENSUS-RUNBOOK.md)
- [`SECURITY.md`](SECURITY.md)

B2C design: [`docs/superpowers/specs/2026-08-15-phase-b2c-wav-preservation-design.md`](docs/superpowers/specs/2026-08-15-phase-b2c-wav-preservation-design.md)

B2C implementation plan: [`docs/superpowers/plans/2026-08-15-phase-b2c-wav-preservation.md`](docs/superpowers/plans/2026-08-15-phase-b2c-wav-preservation.md)

Census v1 design: [`docs/superpowers/specs/2026-08-24-vault-census-v1-design.md`](docs/superpowers/specs/2026-08-24-vault-census-v1-design.md)

Tracking: [Vault issue #8](https://github.com/the-static-collective/autodiscography-vault/issues/8), [Vault issue #11](https://github.com/the-static-collective/autodiscography-vault/issues/11), [Vault issue #12](https://github.com/the-static-collective/autodiscography-vault/issues/12), downstream preservation program: [Corpus OS #4](https://github.com/the-static-collective/corpus-os/issues/4).
