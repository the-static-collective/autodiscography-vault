# Phase B2C — Full-song WAV preservation gate

## Status

Design only. No implementation authority is granted by this document.

Phase B2C exists to prove one real full-song Suno WAV can cross the already-proven browser/local preservation membrane without widening session authority. The 25-track transport gate and full-corpus preservation remain closed until this one-WAV specimen passes.

## Governing compression

> Preserve the best available full-song source bytes first; keep browser auth ephemeral; admit only verified local bytes.

## Current evidence

The current Vault already has the durable role `audio_wav` in `packages/acquisition-contract/index.js`, but the live Suno observer currently proposes only `audio_mp3` and classifies only MP3 audio surfaces. The durable verifier/journal/handoff path is format-agnostic and already admits arbitrary staged local bytes by hash and byte length.

Suno's current official help documentation states that WAV downloads are available on the web for Pro and Premier subscribers. Its web download flow exposes a per-song Download menu, and its multi-song flow can create a ZIP after the operator chooses the desired file type. That means WAV acquisition should be treated as a first-class preservation target, but the exact browser surface used by Suno must be witnessed rather than assumed.

## Scope

Phase B2C proves exactly one **full-song master WAV**.

In scope:

- one signed-in Suno web session;
- one operator-selected song;
- one explicit operator action that requests WAV from Suno;
- one resulting `.wav` file;
- one `audio_wav` admission receipt;
- one external-drive-capable `vaultRoot` destination;
- exact SHA-256 and byte-length verification;
- bounded container sanity checking before an `audio_wav` receipt is minted;
- preservation of the existing ephemeral-auth / durable-evidence boundary.

Out of scope:

- stems or multitrack exports;
- Studio project exports;
- 25-track WAV batching;
- full-corpus acquisition;
- cookies, authorization headers, session extraction, Native Messaging, browser database access, telemetry, or server-side acquisition;
- background scraping or automatic Suno menu activation;
- inventing a WAV URL when no actual WAV surface is observed.

## Design choice

### Recommended approach — one-shot user-triggered WAV witness

The browser extension gains a narrowly armed **WAV witness mode** after the operator explicitly enables pilot transport.

The operator still initiates Suno's normal Download → WAV action. The Vault does not synthesize that action and does not request a hidden endpoint on its own.

The witness accepts either of two actual browser surfaces:

1. **DOM transport surface** — if Suno exposes a real `.wav` link or `audio/wav` source in the signed-in page, the existing observed-asset pipeline classifies it as `audio_wav` and stages it with the existing Chrome Downloads transport.
2. **Browser download surface** — if Suno generates the WAV through JavaScript or a transient request that never becomes a stable DOM link, the already-optional `downloads` capability observes the single operator-triggered Chrome download. The Vault binds only that one newly created WAV download to the armed track/run, waits for completion, and treats the completed local file as the staged specimen.

This fallback is intentionally one-shot and operator-triggered. It does not scan historical downloads, does not monitor unrelated downloads as corpus evidence, and does not convert the Downloads API into a general browsing-history surface.

### Rejected approach — endpoint reconstruction

Do not infer, reverse-engineer, or persist a reusable WAV endpoint from MP3 URLs, page scripts, cookies, headers, or network traces. Even if such a route appears technically convenient, it would widen the authority model beyond the proven browser-held membrane.

### Deferred approach — Suno multi-song ZIP

Suno documents a multi-song Download All flow that can produce a ZIP for the chosen file type. That may become useful for the bounded 25-track pilot, but it is deliberately deferred until one independent WAV is proven and the ZIP identity/mapping problem can be designed separately.

## Browser witness rules

The observer's proposed asset vocabulary becomes:

- `raw_metadata`
- `lyrics`
- `artwork`
- `audio_mp3`
- `audio_wav`

Classification rules are evidence-based:

- `.wav` path or explicit `audio/wav` MIME → `audio_wav`;
- `.mp3` path or explicit `audio/mpeg` MIME → `audio_mp3`;
- unknown audio remains `other` rather than being guessed.

For a browser-download witness, Phase B2C must bind the download to a fresh one-shot arm created by a user gesture. At most one active WAV witness may exist at a time. Completion or interruption clears the arm.

The durable record may contain only the same bounded evidence already allowed by B2:

- provider track ID;
- asset role;
- observation timestamp;
- run ID;
- safe request descriptor hash when a request descriptor exists;
- final local byte identity after admission.

Exact signed URLs, query strings, fragments, cookies, authorization headers, tokens, session material, and browser storage remain forbidden from durable receipts/manifests.

If a browser-download surface does not provide a safe request descriptor without exposing reusable capability, `requestDescriptorSha256` must not be fabricated. The existing durable contract should be used as-is only where its invariants permit; otherwise the implementation plan must define a bounded evidence representation before code changes begin.

## Local admission and external drive

`pilot:admit` remains the authority boundary for durable bytes.

The operator supplies the completed local WAV path and chooses `--vault-root`. The destination may be an external drive, for example:

```text
E:\Autodiscography-Vault
```

No browser permission to the external drive is required. Chrome only obtains the file; Node admits the exact completed bytes into the selected Vault root.

For `assetRole=audio_wav`, admission must refuse obvious non-WAV payloads before minting a verified `audio_wav` receipt. A bounded container check should accept ordinary RIFF/WAVE and RF64/WAVE headers, then continue to the existing exact SHA-256 and byte-length verification. This is a format sanity gate, not semantic audio analysis.

## Operator UX

Phase B2C should make the Windows path explicit and low-friction:

1. Refresh live witness.
2. Select one track.
3. Enable pilot transport.
4. Arm **Witness one WAV** for that exact track.
5. In Suno, use the normal Download → WAV action.
6. Vault reports either `WAV staged` or an explicit bounded refusal/interruption.
7. Vault displays the exact safe evidence needed for local admission.
8. A copyable PowerShell `pilot:admit` command may be generated from safe fields plus a user-selected local path / vault root; it must never embed a signed URL or secret.

The UI must keep the existing 25-track acquisition control closed.

## Failure behavior

Refuse visibly when:

- no explicit WAV witness is armed;
- more than one candidate download races the one-shot witness;
- the result is not `.wav` / `audio/wav` evidence;
- the download is interrupted;
- the selected provider track identity is missing;
- the observation timestamp is missing;
- a secret-shaped value would have to become durable;
- local admission sees bytes that do not pass WAV container sanity;
- final SHA-256/byte length cannot be independently reverified.

Refusal must not mutate the durable acquisition journal as a verified asset.

## TDD gates for implementation

Implementation should be decomposed into observable RED → GREEN gates:

1. **Vocabulary/classifier gate** — `audio_wav` is proposed and real `.wav` / `audio/wav` surfaces classify correctly while MP3/artwork behavior remains unchanged.
2. **One-shot browser witness gate** — only an explicitly armed, newly created WAV download can bind to the selected track/run; unrelated/historical downloads are ignored.
3. **Completion gate** — completed WAV exposes a bounded staged witness; interruption clears state without a verified receipt.
4. **WAV admission gate** — RIFF/WAVE and RF64/WAVE staged bytes may be admitted as `audio_wav`; obvious non-WAV bytes are refused before journal mutation.
5. **Windows operator gate** — safe PowerShell handoff evidence is copyable without signed URL/session material.
6. **Real human specimen** — one normal signed-in Suno full-song WAV is downloaded, admitted to a local/external-drive Vault root, and independently reverified.

## Human acceptance specimen

The one-WAV gate passes only when a real signed-in Chrome run proves all of the following:

- the chosen Suno song is identified by provider track ID;
- the operator explicitly chooses WAV in Suno;
- Vault witnesses/stages exactly one resulting full-song WAV;
- local admission uses `assetRole=audio_wav`;
- container sanity passes;
- receipt state is `verified`;
- receipt byte length and SHA-256 match an independent final-file verification;
- the final admitted file exists under the chosen Vault root, including an external drive if selected;
- durable outputs contain no exact signed URL/query/fragment, cookie, authorization header, token, session material, or browser storage;
- existing artwork and MP3 observation/admission tests remain green;
- 25-track/full-corpus acquisition remains disabled.

## What opens after this gate

A successful Phase B2C specimen authorizes design of the **bounded 25-track preservation pilot**, with `audio_wav` preferred as the preservation audio asset and MP3 retained as secondary/fallback evidence where WAV is unavailable.

It does not authorize an unbounded corpus run by itself.
