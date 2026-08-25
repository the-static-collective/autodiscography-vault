# Census v1 runbook

## What this command does

`census:ingest` preserves a local NDJSON observation pack as immutable raw evidence, then builds a resumable `census-v1` normalized projection. It does not contact Suno, acquire media, or interpret the corpus.

## Prepare one observation per line

Each line is a complete JSON object. Do not pretty-print an object across several lines.

```json
{"schema":"autodiscography-vault-observation/v1","provider":"suno","observedAt":"2026-08-24T21:30:00.000Z","source":{"kind":"provider_export","locator":"provider-export:page-1"},"payload":{"id":"provider-track-id","created_at":"2024-02-03 04:05:06+00:00","style_prompt":"exact style text","lyrics":"exact lyrics text","future_field":{"meaning":"unknown"}},"evidence":{"providerTrackId":{"state":"observed","pointer":"/id"},"providerCreatedAtRaw":{"state":"observed","pointer":"/created_at"},"stylePromptRaw":{"state":"observed","pointer":"/style_prompt"},"lyricsTextRaw":{"state":"observed","pointer":"/lyrics"},"lyricGenerationPromptRaw":{"state":"not_exposed","reasonCode":"not_exposed_on_surface"},"parentProviderTrackId":{"state":"not_observed","reasonCode":"not_observed_on_surface"},"audioWav":{"state":"artifact_known_bytes_unavailable","reasonCode":"bytes_not_acquired"}}}
```

Point to exact raw values. Do not trim or summarize style/lyrics before capture. If a value is absent, use the actual state; do not invent a pointer or value.

## Run or resume

```bash
npm run census:ingest -- \
  --input <absolute-or-relative-pack.ndjson> \
  --vault-root <absolute-or-relative-vault-root> \
  --checkpoint-every 250
```

The safe default commits every 250 normalized records. Re-run the exact same command after interruption. The raw content hash selects the same checkpoint and output.

## Inspect the result

The command prints JSON with three layers:

- `layers.raw` — exact immutable source-pack path and SHA-256;
- `layers.normalized` — reproducible `census-v1` projection path;
- `layers.derived` — `not_built`.

The Vault root contains:

```text
raw/observations/<sha256>.ndjson
normalized/census-v1/<sha256>.ndjson
state/census-v1/<sha256>.json
receipts/census-v1/<sha256>.json
```

`skippedExisting: true` on a repeat run means the command independently verified the existing normalized receipt before skipping.

## Refusals

Stop and repair the observation source when the command reports:

- invalid or blank NDJSON record;
- missing evidence state;
- observed pointer that does not resolve;
- non-canonical `observedAt`;
- explicit reusable credential field;
- capability-bearing URL;
- raw or normalized identity mismatch.

Do not weaken the membrane to make an unsafe export pass. Convert capability-bearing material at the capture boundary into typed `refused` evidence or a non-capability descriptor.

## Current gate

The local ingest engine is ready for whole-population packs. Automatic signed-in Suno capture is not enabled by this slice. The one-real-WAV gate and a separately witnessed source adapter remain required before full-corpus browser acquisition.
