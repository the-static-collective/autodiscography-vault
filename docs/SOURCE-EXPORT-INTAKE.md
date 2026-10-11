# Source-export custody for Suno: full-fidelity local intake

This is **not** a downloader. It accepts files the operator already obtained from a permitted Suno export, a Suno data-access response, or an older local backup, then preserves the exact bytes under a **private local Vault root**.

It makes no network calls, does not inspect the Suno session, does not circumvent download limits, and does not infer song genealogy.

Supported source containers: `.json`, `.jsonl`, `.ndjson`, `.csv`, `.tsv`, `.zip` (ZIP stored opaque, not unpacked). Lyrics, prompts, styles, timestamps, generation parameters and source relationship fields, if present, survive **unchanged in the original file**, even when there is no parser for them yet. This tool does **not** build a chronology, make a completeness claim or authenticate the source.

**Operator safety:** never feed credential bundles, browser cookie exports, saved passwords, session dumps or network HAR files. The importer stores opaque bytes without inspecting the contents: **it cannot certify absence of secrets**. Keep the Vault outside the public Git repo and publicly synced folders, preferably on an encrypted drive. No actual corpus data belongs in Git.

## Usage (Node.js 22+)

```bash
node scripts/admit-source-export.js \
  --input "/path/to/suno-data-export.zip" \
  --vault-root "/path/to/PRIVATE/Autodiscography-Vault" \
  --source-claim claimed-suno-account-export
```

Use `--source-claim operator-supplied` for manual snapshots and older spreadsheets. Even `claimed-suno-account-export` is an **operator claim**, never proof of official origin.

Outputs:

- `source-exports/suno/<sha256>.<ext>`: exact original bytes, content addressed
- `receipts/source-exports.jsonl`: append-only metadata-only receipts

Exact repeat submissions skip only if stored bytes reverify. Changed files become new specimens. Copy preserved originals and receipts to a second private drive and independently verify their hashes.

**Distinct from PR #16:** `scripts/admit-metadata-observation.js` validates narrow oldest-first card observations and explicitly rejects lyrics, prompts and unverified ancestry edges. This source-export importer is a separate raw-custody lane, not a relaxation of the card schema.

## Next derivation stage, not yet implemented

Unpack official data exports privately if needed; inventory schemas; identify source IDs and actual creation times; normalize per-generation records; stable oldest-first sort by exact timestamp when present; preserve provider relationships as claims pending direct evidence. Reconcile the archive against the existing bounded 10-record UI pilot. Do not conflate partial exports with a complete account history.
