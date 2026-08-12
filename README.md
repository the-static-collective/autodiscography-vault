# Autodiscography Vault

Local-first preservation instrument for the Static Collective's Autodiscography corpus.

**Current state: Phase A — synthetic preservation floor.** Live Suno acquisition is intentionally locked.

The external preservation deadline recorded by the project is **September 3, 2026**. Urgency may accelerate transport work; it does not widen the trust boundary.

> Preserve the body before the window narrows. Speed up transport, not trust.

## What exists now

- Manifest V3 Chromium side-panel shell with no live-origin authority;
- fixture-only `provider/suno` boundary;
- bounded acquisition receipts;
- append-only JSONL acquisition journal with `fsync`;
- exact SHA-256 + byte-length verification;
- synthetic interruption/resume + atomic promotion proof;
- explicit `verified`, `missing`, `partial`, `refused`, and `failed` states;
- bounded Corpus OS handoff projection with raw metadata references kept separate;
- adversarial synthetic tests for corruption, torn journal writes, secret-shaped material, and permission/network creep.

## What does not exist yet

- no live requests to Suno;
- no cookies/session/token extraction;
- no live track enumeration or download behavior;
- no TranchNode, Exact Return, semantic-equivalence, lineage, or universal receipt ontology;
- no real corpus material in Git.

## Verify Phase A

Requires Node.js 22 or newer.

```bash
npm test
npm run synthetic:pilot
```

The synthetic pilot writes only to a temporary local directory and prints its exact-byte receipt summary.

## Operator boundary

Read these before Phase B:

- [`docs/TRUST-BOUNDARY.md`](docs/TRUST-BOUNDARY.md)
- [`docs/NETWORK-BEHAVIOR.md`](docs/NETWORK-BEHAVIOR.md)
- [`docs/PILOT-RUNBOOK.md`](docs/PILOT-RUNBOOK.md)
- [`docs/CORPUS-OS-HANDOFF.md`](docs/CORPUS-OS-HANDOFF.md)
- [`SECURITY.md`](SECURITY.md)

Tracking: [Vault issue #1](https://github.com/the-static-collective/autodiscography-vault/issues/1), downstream preservation program: [Corpus OS #4](https://github.com/the-static-collective/corpus-os/issues/4).
