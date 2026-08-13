# Pilot Runbook

## Phase A — runnable now

Phase A proves the preservation mechanics with synthetic fixtures only.

### Prerequisites

- Node.js 22 or newer;
- a clean checkout of the Vault repository;
- no real provider data placed inside the repository.

### Run

```bash
npm test
npm run synthetic:pilot
```

### Required Phase-A evidence

The test suite must prove:

- bounded receipt validation;
- secret-shaped fields and values fail closed without echoing the value;
- exact known SHA-256 and byte length;
- one-byte corruption is detected;
- append operations preserve prior journal history;
- a torn/non-newline-terminated journal fails closed;
- missing/partial states remain explicit;
- raw metadata references stay separate from derived asset records;
- the MV3 shell has no live-origin/cookie authority;
- the fixture adapter has no network primitive.

The synthetic pilot must demonstrate:

1. raw metadata admitted by exact bytes;
2. an intentionally interrupted audio state recorded as `partial`;
3. a complete local fixture written to `.partial`;
4. exact verification before atomic promotion;
5. a later `verified` receipt appended for the same logical key;
6. an explicit `missing` asset on a different synthetic track;
7. independent re-verification of the final file;
8. a second pass that skips the already verified final only after matching its receipt.

If any proof fails, Phase B remains locked.

## Phase B — 25-track live pilot, not implemented here

Only after Phase A is green may a separate change propose live provider behavior.

The live pilot must be capped at **25 tracks** and must let the operator inspect exactly what will be requested and written before acquisition begins.

The pilot receipt must prove:

1. login occurs only on the real provider origin;
2. no password, cookie, bearer token, authorization header, browser database, or reusable session material enters destination files, journal, manifest, logs, or extension storage;
3. raw provider metadata is preserved separately from any derived projection;
4. available MP3, artwork, lyrics, and metadata may succeed or fail independently;
5. every verified final file has exact byte length and SHA-256;
6. interruption is deliberate and resume does not rewrite verified originals;
7. missing/partial/refused states are legible and safely rerunnable;
8. duplicate IDs, alternate versions, and same-name/different-byte cases remain distinct;
9. the Corpus OS handoff manifest validates against the bounded handoff contract;
10. a second-device copy verifies from the manifest.

Only after the 25-track receipt passes should full-corpus preservation begin.

## External deadline

The project records **September 3, 2026** as the external preservation deadline. Operational work should complete materially earlier to leave room for verification, reruns, and a second physical copy.
