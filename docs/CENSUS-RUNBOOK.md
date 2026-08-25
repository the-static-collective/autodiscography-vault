# Census v1 runbook

## Preservation layers

The census path preserves three separate layers:

```text
Suno ordinary signed-in UI
  -> exact immutable auto-scroll round segments
  -> exact immutable observation pack
  -> reproducible census-v1 normalization
  -> derived interpretation: not built
```

It does not acquire media, infer lineage, classify history, build STORYSHIP, or draw eCODE conclusions.

## Operator authorization gate

The adapter is technically bounded to the ordinary signed-in DOM, but that does not itself establish provider permission. Before running it, confirm that you are authorized and that the provider's current terms permit the operation. If permission is absent or uncertain, stop and use an authorized provider export instead. Do not use the adapter to bypass access controls, CAPTCHA, rate limits, or entitlement checks.

## Capture the rendered library

1. Load `extension/` as an unpacked Chromium extension.
2. Sign in to Suno normally and open the library surface you intend to preserve.
3. Open the Vault side panel and press **Start auto-scroll census**.
4. Grant the optional Downloads permission so Vault can complete each local JSON round file before advancing.
5. Keep that Suno tab open until the panel reports `ui_exhausted`, or press **Stop after last saved round** at any time.

The side panel starts from the top and advances by less than one viewport. Each completed file contains that round's raw card observations and the exact checkpoint needed for restart:

```text
Downloads/Autodiscography-Vault/<run-id>/census/round-000001.json
Downloads/Autodiscography-Vault/<run-id>/census/round-000002.json
...
```

If the panel, tab, browser, or machine stops, select the highest completed round file in **Optional completed round file to resume**, then start again. The page replays from the top. Stable IDs suppress duplication only in checkpoint state; replayed card observations remain raw history.

`ui_exhausted` means repeated bottom-of-rendered-UI rounds produced no new or unidentified cards and the scroll height stayed stable. It is a terminal UI witness, not a claim that the provider exposed every historical object or population class.

The library-card adapter preserves stable provider identity and a safe same-origin source path when observed. It deliberately records `providerCreatedAtRaw`, `stylePromptRaw`, `lyricsTextRaw`, `lyricGenerationPromptRaw`, parent identity, and WAV state as typed `not_observed` on this surface. A separate real detail-surface witness is required before any of those fields may become `observed`.

## Admit an auto-scroll run

Point the local command at the directory containing every completed round for one run:

```bash
npm run census:ingest-scroll -- \
  --segments <path-to-run/census> \
  --vault-root <absolute-or-relative-vault-root> \
  --checkpoint-every 250
```

The command first validates one contiguous run lineage. It then preserves every exact segment byte-for-byte, creates a deterministic observation pack without deduplicating re-observations, and invokes the resumable Census v1 normalizer. Re-run the same command after interruption.

The Vault root contains:

```text
raw/census-scroll-segments/<segment-sha256>.json
raw/observations/<pack-sha256>.ndjson
normalized/census-v1/<pack-sha256>.ndjson
state/census-v1/<pack-sha256>.json
receipts/census-v1/<pack-sha256>.json
receipts/census-scroll-runs/<run-receipt-sha256>.json
```

`skippedExisting: true` on a repeat means the command independently verified the existing normalized receipt before skipping. A missing round, duplicate round, changed run ID/configuration, decreasing timestamp, rewritten stable-ID history, unsafe capability, or checkpoint-count mismatch fails closed.

## Admit another durable-safe observation pack

`census:ingest` remains available for an authorized provider export or another witnessed source. Prepare one complete JSON object per NDJSON line; do not pretty-print one object across lines.

```json
{"schema":"autodiscography-vault-observation/v1","provider":"suno","observedAt":"2026-08-24T21:30:00.000Z","source":{"kind":"provider_export","locator":"provider-export:page-1","adapter":"authorized-provider-export/v1","surface":"provider_export"},"payload":{"id":"provider-track-id","created_at":"2024-02-03T04:05:06+00:00","style_prompt":"exact style text","lyrics":"exact lyrics text","future_field":{"meaning":"unknown"}},"evidence":{"providerTrackId":{"state":"observed","pointer":"/id"},"providerCreatedAtRaw":{"state":"observed","pointer":"/created_at"},"stylePromptRaw":{"state":"observed","pointer":"/style_prompt"},"lyricsTextRaw":{"state":"observed","pointer":"/lyrics"},"lyricGenerationPromptRaw":{"state":"not_exposed","reasonCode":"not_exposed_on_surface"},"parentProviderTrackId":{"state":"not_observed","reasonCode":"not_observed_on_surface"},"audioWav":{"state":"artifact_known_bytes_unavailable","reasonCode":"bytes_not_acquired"}}}
```

Point evidence to exact raw values. Do not trim or summarize prompts or lyrics before capture. Use `known_null` only for an explicitly observed null. If a field was not inspected, not exposed, unavailable, refused, failed, or historically disappeared, preserve that actual state instead of inventing a pointer or value. `observedAt` never substitutes for provider creation time.

```bash
npm run census:ingest -- \
  --input <absolute-or-relative-pack.ndjson> \
  --vault-root <absolute-or-relative-vault-root> \
  --checkpoint-every 250
```

The raw content hash selects the same checkpoint and normalized output on restart.

## Refusals

Stop and repair the observation source when either command reports:

- invalid, blank, non-UTF-8, or noncontiguous input;
- missing or aliased evidence state;
- an observed pointer that does not resolve;
- ambiguous or non-canonical time data;
- an explicit reusable credential field or bearer value;
- a capability-bearing URL;
- raw, checkpoint, lineage, or normalized identity mismatch.

Do not weaken the membrane to make an unsafe source pass. Convert capability-bearing material at the capture boundary into typed `refused` evidence or a non-capability descriptor.

## Remaining witness gate

The one-real-WAV prerequisite passed. The auto-scroll implementation and local segment admission are automated candidates, not yet a real-library population witness. Before treating a run as the observed library population, record a real signed-in specimen that proves the current Suno library DOM yields stable identities across incremental scrolling and honestly reaches `ui_exhausted`. Exact creation time, style prompt, lyrics, lyric-generation prompt, and historical lineage remain a separate detail-surface witness.
