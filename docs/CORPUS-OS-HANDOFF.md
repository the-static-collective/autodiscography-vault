# Corpus OS Handoff

Vault ends at the verified local-export boundary. Corpus OS begins after that boundary.

Phase A deliberately does not import Corpus OS code or ontology. It emits a narrow transport manifest containing enough exact evidence for a later Corpus OS admission step.

## Handoff schema

Current schema identifier:

```text
autodiscography-vault-handoff/v0
```

Each record can state:

| Vault field | Meaning |
| --- | --- |
| `provider` | observed provider identifier (`suno` in this adapter) |
| `providerTrackId` | provider-observed track identity |
| `observedAt` | transport observation timestamp |
| `state` | `verified`, `missing`, `partial`, `refused`, or `failed` |
| `reasonCode` | bounded reason for a non-verified state |
| `asset.role` | `audio_mp3`, `audio_wav`, `artwork`, `raw_metadata`, `lyrics`, or `other` |
| `asset.path` | source-relative local path when present |
| `asset.byteLength` | exact admitted byte length when verified |
| `asset.sha256` | exact SHA-256 when verified |
| `rawMetadata.path` | separately addressable raw observation path when available |
| `rawMetadata.sha256` | exact hash of that raw observation when available |

The append-only acquisition journal additionally preserves `runId` and repeated state history for each `runId + providerTrackId + assetRole` key.

## Non-authority

The handoff does **not** establish:

- authorship or ownership;
- canon;
- semantic identity or equivalence;
- lineage;
- completeness beyond the observed asset state;
- similarity or motif relationships;
- Project0 recognition/rejection;
- TranchNode transfer semantics;
- Exact Return classification.

Provider text and timestamps are observations from transport, not semantic authority.

## Raw evidence

Raw provider observations and derived handoff records are separately addressable. Corpus OS may later index or admit selected material, but Vault never overwrites raw evidence with that projection.

## Downstream compatibility target

This document tracks the bounded acquisition needs recorded in `the-static-collective/corpus-os#3`: exact hashes/lengths, raw metadata retention, explicit incomplete states, duplicate/alternate preservation, machine-readable receipts, and secret exclusion.

Compatibility means preserving those facts, not vendoring Corpus OS architecture into Vault.
