# Autodiscography Vault

Local-first preservation instrument for the Static Collective's Autodiscography corpus.

**Current state: Phase B1 — live Suno witness/proposal. Asset transport is still disabled.**

The external preservation deadline recorded by the project is **September 3, 2026**. Urgency may accelerate transport work; it does not widen the trust boundary.

> Preserve the body before the window narrows. Speed up transport, not trust.

## What exists now

- Manifest V3 Chromium side panel;
- a permanent, read-only content script limited to `https://suno.com/*` and `https://www.suno.com/*`;
- a live DOM witness that returns at most **25** track candidates per observation;
- explicit `wrong_origin`, `no_tracks_observed`, `unsupported_page_shape`, `pilot_cap_reached`, and `reusable_auth_required` states/warnings;
- fixture-only Phase-A `provider/suno` proof retained alongside the live witness;
- bounded acquisition receipts;
- append-only JSONL acquisition journal with `fsync`;
- exact SHA-256 + byte-length verification;
- synthetic interruption/resume + atomic promotion proof;
- explicit `verified`, `missing`, `partial`, `refused`, and `failed` states;
- bounded Corpus OS handoff projection with raw metadata references kept separate;
- adversarial tests for corruption, torn journal writes, secret-shaped material, and permission/network creep.

## What does not exist yet

- no live MP3, artwork, lyrics, or raw-metadata transport;
- no cookies/session/token extraction;
- no `webRequest`, authorization-header capture, browser-database access, or reusable session material;
- no full-corpus acquisition;
- no telemetry, Vercel/server corpus hop, or third-party corpus upload;
- no TranchNode, Exact Return, semantic-equivalence, lineage, or universal receipt ontology;
- no real corpus material in Git.

## Verify locally

Requires Node.js 22 or newer.

```bash
npm test
npm run synthetic:pilot
```

The synthetic pilot writes only to a temporary local directory and prints its exact-byte receipt summary.

## Phase B1 operator witness

After PR #4 is review-ready, load `extension/` as an unpacked Chromium extension, sign in normally at the real Suno origin, open the library page, open the Vault side panel, and press **Refresh live witness**. The panel must show no more than 25 candidates and keeps **Acquire 25-track pilot** disabled.

The purpose of that witness is structural: learn which provider IDs, links, titles, and asset surfaces are legitimately visible to the signed-in page. Do not extract cookies, tokens, authorization headers, or browser databases. If a later transport path requires reusable authentication material, the correct result is `reusable_auth_required`, not wider authority.

## Operator boundary

Read these before any Phase B2 proposal:

- [`docs/TRUST-BOUNDARY.md`](docs/TRUST-BOUNDARY.md)
- [`docs/NETWORK-BEHAVIOR.md`](docs/NETWORK-BEHAVIOR.md)
- [`docs/PILOT-RUNBOOK.md`](docs/PILOT-RUNBOOK.md)
- [`docs/CORPUS-OS-HANDOFF.md`](docs/CORPUS-OS-HANDOFF.md)
- [`SECURITY.md`](SECURITY.md)

Tracking: [Vault issue #3](https://github.com/the-static-collective/autodiscography-vault/issues/3), downstream preservation program: [Corpus OS #4](https://github.com/the-static-collective/corpus-os/issues/4).
