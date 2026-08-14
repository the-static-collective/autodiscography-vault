# Phase B1 Live Witness Design

## Goal

Make the first live Suno crossing observable and bounded without yet granting Vault authority to acquire provider assets. Phase B1 turns the landed Phase-A shell into a live witness/proposal instrument for at most 25 tracks.

## Authority boundary

Vault may install a permanent MV3 content script on `https://suno.com/*` and `https://www.suno.com/*` because the extension exists solely for Suno corpus preservation. That script is read-only and provider-specific.

Vault must not request `cookies`, `webRequest`, `<all_urls>`, browser-database access, password access, header interception, telemetry, or any third-party/server transport. Vercel is explicitly outside the acquisition path.

If later transport requires reusable authentication material, Phase B stops with `reusable_auth_required`; authority is not widened to make transport succeed.

## Architecture

```text
suno.com DOM
  -> content-script.js
  -> live-observer.js
  -> bounded/sanitized LiveObservation (<=25)
  -> chrome.runtime message
  -> side-panel proposal
  -> STOP: acquisition disabled
```

`live-observer.js` contains all provider-specific DOM interpretation and is written as a pure module so it can be unit tested without Chrome. `content-script.js` is a thin browser adapter that invokes the observer and answers explicit `vault:observe` messages. The side panel requests an observation, renders exactly what was observed, and does not fabricate IDs or completeness.

## Observation contract

A live observation has:

- `provider: "suno"`;
- `origin`;
- `observedAt`;
- `status`: `ready` or `refused`;
- `reasonCode` when refused;
- `truncated`: whether more than 25 candidate nodes were present;
- `tracks[]`, maximum length 25.

Each track may contain:

- `providerTrackId: string | null`;
- `title: string | null`;
- `sourceUrl: string | null`;
- `proposedAssets`: the bounded proposal roles `raw_metadata`, `lyrics`, `artwork`, `audio_mp3`;
- `evidence`: only non-secret structural observations needed to explain where the values came from.

No provider ID is synthesized from title, DOM order, hashes, or URL fragments that do not unambiguously represent a provider ID.

## DOM strategy

The observer searches centralized candidate selectors and then inspects anchors/attributes within each candidate. It prefers explicit UUID-like IDs in Suno song URLs/attributes. Titles come only from explicit text-bearing title/name elements or anchor labels. Unsupported page shapes yield `unsupported_page_shape` rather than guessed data.

Because Suno markup may change, selector fallbacks are data, not scattered UI logic.

## Secret handling

Observation sanitization rejects keys whose normalized names are secret-shaped (`authorization`, `cookie`, `token`, `session`, `password`, `secret`, and close variants). Values that look like bearer credentials are also rejected. Refusal does not echo the sensitive value.

The side panel receives only the sanitized observation contract.

## UI

Phase A's synthetic proposal remains visible as historical/local proof. A new Phase B1 section shows:

- `LIVE WITNESS — transport disabled`;
- Refresh observation button;
- status/refusal code;
- count and hard cap `n / 25`;
- observed title/ID/source URL;
- proposed asset roles;
- explicit `unknown` where evidence is absent;
- disabled `Acquire 25-track pilot` control with copy stating that transport requires a separate reviewed Phase-B2 gate.

## Failure behavior

- non-Suno origin -> `wrong_origin`;
- no plausible candidate nodes -> `no_tracks_observed`;
- candidate nodes exist but no supported evidence can be extracted -> `unsupported_page_shape`;
- >25 candidates -> return first 25 deterministically and set `truncated: true`; UI displays `pilot_cap_reached` as a bounded warning, not an error;
- secret-shaped observation -> `reusable_auth_required` and no sensitive echo.

## Testing

Add pure unit tests for origin gating, deterministic 25-track truncation, explicit null IDs, secret rejection, and proposal transport being disabled. Extend manifest boundary tests to prove the content-script match scope is Suno-only and forbidden permissions remain absent. Existing Phase-A tests and synthetic pilot remain unchanged and green.

## Documentation and next gate

README, trust boundary, network behavior, and pilot runbook move the project state to `Phase B1 — live witness/proposal`. They must state that no asset transport exists yet.

After the PR is review-ready, the operator loads the unpacked extension in Chromium against a normal signed-in Suno library page. That witness determines Phase B2: whether legitimate asset URLs/metadata can be acquired from the page/browser origin without reusable auth extraction. `corpus-os#4` stays open throughout.