# Corpus OS Handoff

Vault ends at the verified local-export boundary. Corpus OS begins after that boundary.

Phase B2 still does not import Corpus OS code or ontology. It emits a narrow transport manifest containing exact admitted-byte evidence plus a redacted identity of the browser request that produced the staged file.

## Handoff schema

Current schema identifier:

```text
autodiscography-vault-handoff/v0
```

Each record can state:

| Vault field | Meaning |
| --- | --- |
| `provider` | observed provider identifier (`suno`) |
| `providerTrackId` | provider-observed track identity |
| `observedAt` | transport observation timestamp |
| `state` | `verified`, `missing`, `partial`, `refused`, or `failed` |
| `reasonCode` | bounded reason for a non-verified state |
| `requestDescriptorSha256` | SHA-256 of the redacted request preview; never the exact transport URL |
| `asset.role` | `audio_mp3`, `audio_wav`, `artwork`, `raw_metadata`, `lyrics`, or `other` |
| `asset.path` | Vault-relative local path when present |
| `asset.byteLength` | exact admitted byte length when verified |
| `asset.sha256` | exact SHA-256 when verified |
| `rawMetadata.path` | separately addressable raw observation path when available |
| `rawMetadata.sha256` | exact hash of that raw observation when available |

The append-only acquisition journal additionally preserves `runId` and repeated state history for each `runId + providerTrackId + assetRole` key.

## Request identity is not authentication

For Phase B2, the durable request identity is derived from:

```text
GET <origin><pathname>
provider=suno
track=<providerTrackId>
asset=<assetRole>
```

URL query/fragment material is excluded before hashing. The handoff must not contain `transportUrl`, cookies, authorization headers, signed query capabilities, bearer/session tokens, or browser storage.

This lets Corpus OS correlate the admitted bytes with the bounded browser request description without inheriting reusable browser authority.

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

Provider text, timestamps, and request descriptors are observations from transport, not semantic authority.

## Raw evidence

Raw provider observations and derived handoff records remain separately addressable. Corpus OS may later index or admit selected material, but Vault never overwrites raw evidence with that projection.

## Current gate

Automated Phase-B2 tests prove the handoff contract and local admission path. The handoff is not yet evidence of a real signed-in Suno acquisition until the one-track human specimen completes browser staging and local admission without reusable authentication material.

Compatibility means preserving exact facts and uncertainty, not vendoring Corpus OS architecture into Vault.
