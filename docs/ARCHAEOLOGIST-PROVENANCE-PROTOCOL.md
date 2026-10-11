# Archaeologist: selected-record provenance protocol (v1)

**Goal:** an archaeological witness, not a narrator pretending to be a database. This protocol does not amend Suno access rights, the Vault's network boundary, or Phase B2C's audio gates. It applies to read-only, bounded UI inspection and private local metadata review.

## The error class

A browser agent can read the label "Cover of" somewhere on a dynamic page but assign it to the wrong song. A side panel, playlist neighbor, previous selection, or stale UI state is **not** evidence about the intended selected generation.

A song's name, similarity, UI adjacency, or model family does not prove ancestry. Chronology can **contradict** an alleged parent; chronology alone cannot **establish** an ancestor.

## Collect one selected record at a time

1. Navigate to the canonical `https://suno.com/song/<uuid>` of **one** intended generation. Record the exact intended UUID before the page loads.
2. Verify the page's selected-track identity. A visible sidebar or another song's "Similar" section never qualifies as the selected-track detail.
3. Record title and exact creation time **only if that exact timestamp is displayed**. If the UI shows `4mo ago`, record `ageLabel:"4mo ago"`, leave the exact instant unknown.
4. If a "Cover of", "Extend of", or "Remix of" label is **in the selected detail**, record the literal relation label and the exact canonical target song URL. If its target cannot be read, keep the claim unresolved.
5. Open the target song directly (bounded second page). Verify the target's selected UUID and creation timestamp using the same rules. The parent page **need not** list children: absence of an inverse backlink proves nothing.
6. Compare dates: if the purported parent was generated after its alleged child, record `contradicted: parent_newer_than_child`; never say Suno itself is wrong without verified page evidence.
7. If the selected-track panel does not contain the claimed link, record `unverified: no_matching_relation_in_selected_detail`. Preserve earlier contradictory reports separately, without treating absence on a later page as proof that a link never appeared.
8. Persist private observations and the audit result separately. Do not publish private titles, IDs, lyrics, prompts, audio, account exports or provider payloads to the public repository.

## Claim states, not fabricated family trees

| State | Meaning |
| --- | --- |
| `misattributed` | Evidence comes from the wrong panel, ID or page |
| `unverified` | Missing selected-detail link, target confirmation, or exact chronology |
| `contradicted` | Direct-generation chronology or identity contradicts the claim |
| `supported_provider_claim` | Two source-identified, selected-detail observations agree and chronology is consistent; **not yet a cryptographically authenticated source witness** |

All states preserve `promoteToConfirmedEdge:false`. The auditor cannot authenticate an LLM/browser agent's interpretation of a page. Only a separately designed, independently corroborated first-party DOM witness / human-reviewed receipt may elevate a provider relationship to canonical genealogy. Musical similarity and story interpretation are separate, interpretive layers.

## Collection prompt for the agent

> Inspect one canonical Suno song page read-only. Before describing any relationship, repeat the exact selected song UUID and verify it belongs to the **primary selected-track detail panel**, not a sidebar, another track, or previous selection. Report only labels and hrefs physically attributed to that UUID. If the panel has no "Cover of" / "Extend of" / "Remix of" link, report none observed; never infer it from the cover icon or title. Verify any proposed parent on its own exact canonical page. Record exact timestamp only if displayed. Treat a chronologically newer alleged parent as a disputed claim, not a fact. Separate observations from interpretations, include source URLs, and avoid downloads, private text export, provider API reverse engineering, credentials, and bulk crawling.

## Automated checks

`packages/lineage-audit/index.js` accepts a claim plus bounded, source-identified detail observations and emits a classification; `tests/lineage-audit.test.js` exercises wrong panel, swapped IDs, missing selected link, distinct same-title tracks, relative dates, inverse chronology, and a consistent positive report.

`scripts/admit-metadata-observation.js` deliberately refuses any non-null `relation` in v1. The raw oldest-first record is not an authenticated ancestor edge. Keep `relation:null` until an independently verified edge/claim receipt format exists. A rejected import must **not** result in silently dropping evidence: preserve the private raw claim as a separate, clearly disputed observation, not an unreviewed genealogy assertion.

**Law:** `REPORTED LINK ≠ ATTRIBUTED LINK ≠ CHRONOLOGICALLY POSSIBLE LINK ≠ PROVEN ANCESTRY`.
