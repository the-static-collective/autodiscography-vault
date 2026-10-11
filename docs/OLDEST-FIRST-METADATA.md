# Oldest-first Suno metadata: private local admission

**Scope:** a bounded UI observation file, not a full-library acquisition or an audio download. This path leaves the Phase B2C WAV gate, optional Downloads boundary, and browser network policy unchanged.

## Private data stays private

The repository is public. Never commit real titles, track IDs, private prompts, lyrics, session credentials, or provider payloads to Git. Only synthetic examples and the importer belong here.

The imported JSON is preserved verbatim below a private local Vault root:

- `observations/suno/<sha256>.json` — the exact observed bytes, content-addressed.
- `receipts/metadata-observations.jsonl` — an append-only, locally stored metadata receipt.

It is idempotent by exact input hash and verifies the existing bytes before skipping. A modified observation is a **new** specimen, not an overwrite.

## Run (Node 22+)

```bash
node scripts/admit-metadata-observation.js \
  --input "/path/to/oldest-first.json" \
  --vault-root "/path/to/your/private/Autodiscography-Vault"
```

No provider network call, hidden endpoint, cookies, session inspection, or audio transport is used. The importer does not install a browser extension, does not fetch Suno pages, and does not write to GitHub or Vercel.

## Input schema

Top-level required keys:

```json
{
  "schema": "autodiscography-oldest-observation/v1",
  "provider": "suno",
  "source": "authenticated-suno-ui-bounded",
  "observedOn": "2026-10-11",
  "sortOrder": "oldest-ui",
  "partial": true,
  "records": []
}
```

The actual input must contain at least one record. Each record requires: `rank` (strictly increasing observed UI rank), `providerTrackId` (canonical UUID), `sourceUrl` (exact `https://suno.com/song/<ID>`), `title`, `durationSeconds`, `model`, `ageLabel` (relative string or null), `visibility` (`published` / `unpublished` / `unknown`), `kindTag` (`cover` / `extend` / `remix` / null), `relation` (null or explicitly witnessed), and `evidenceSurface` (`card-preview` or `detail-panel`).

A `relation` may be `cover_of`, `extend_of`, or `remix_of`, with `targetProviderTrackId`, `targetSourceUrl`, and `evidenceSurface:"detail-panel"`. Null does not mean "no parent." Repeated titles are distinct tracks when provider IDs differ. Relative ages are **not** converted into invented exact dates. Adjacency and shared duration do **not** establish sibling generations.

## Safety and accuracy

- The UI's "Oldest" control proves *the displayed sort*, not the absolute beginning of the user's entire account or a complete library export.
- A metadata-byte receipt does not claim any audio, artwork, or lyrics were preserved.
- The operator still needs to copy the private Vault root to durable backed-up storage and independently verify its hash.
- Importing metadata does not authorize 25-track transport, full-corpus extraction, or API reverse engineering.
- A future source-supported bulk metadata export may reuse this importer; it must first carry its own provenance and collection scope.

See `README.md`, `SECURITY.md`, and `docs/TRUST-BOUNDARY.md` for the existing preservation law.

## Disputed ancestry and corrected observations

A UI-reported relationship is **a claim, not a verified genealogy edge**. Before projecting it as confirmed, cross-check the selected song's canonical ID, its own direct detail page, the purported parent's canonical ID, and independently observed creation chronology when available. A source displayed in a sidebar, neighboring panel, or stale detail view must not be attributed to the active track. If the direct pages fail to corroborate an earlier relationship report, or timestamps contradict its direction, mark the edge **disputed / not established**, not confirmed.

The preservation layer must **not overwrite** a previous mistaken observation: admit a corrected specimen with a new content hash, preserve the original as an error witness, and create a separate provenance-correction receipt privately linking old/new hashes and describing the disagreement. Do not put private song IDs, titles, lyrics, or account data in this public repo. A `relation: null` means no established link in the current observation, not that no relationship can exist.
