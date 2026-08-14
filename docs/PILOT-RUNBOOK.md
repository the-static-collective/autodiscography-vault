# Pilot Runbook

## Phase A — preservation floor

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
- the fixture adapter has no provider network primitive.

The synthetic pilot must demonstrate:

1. raw metadata admitted by exact bytes;
2. an intentionally interrupted audio state recorded as `partial`;
3. a complete local fixture written to `.partial`;
4. exact verification before atomic promotion;
5. a later `verified` receipt appended for the same logical key;
6. an explicit `missing` asset on a different synthetic track;
7. independent re-verification of the final file;
8. a second pass that skips the already verified final only after matching its receipt.

If any proof fails, live transport remains locked.

## Phase B1 — live Suno witness/proposal

Phase B1 is implemented as a provider-specific, read-only content script. **It does not download provider assets.**

### Load the local extension

1. Obtain the reviewed Phase-B1 branch/merge candidate.
2. In a Chromium browser, open `chrome://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select the repository's `extension/` directory.
5. Confirm the requested site access is limited to Suno HTTPS origins. Do not approve any cookie, all-sites, request-interception, or browser-data authority.

### Run the live witness

1. Sign in normally at the real Suno site. Vault never renders or proxies login.
2. Open the Suno library/page that presents your own tracks.
3. Open the Autodiscography Vault side panel.
4. Press **Refresh live witness**.
5. Confirm the panel reports at most **25** candidates.
6. Inspect several candidates. Record only structural findings:
   - whether provider track IDs are present;
   - which stable source URLs are visible;
   - whether titles are visible;
   - what page shapes/selectors appear stable;
   - whether legitimate asset URLs or provider metadata are visibly available without extracting reusable authentication material.
7. Confirm **Acquire 25-track pilot** remains disabled.

### Required Phase-B1 evidence

The witness passes when:

- the content script operates only on `https://suno.com/*` or `https://www.suno.com/*`;
- at most 25 candidates are returned;
- unknown provider IDs remain `unknown`/`null`, not synthesized;
- additional candidates produce `pilot_cap_reached` rather than silently widening the pilot;
- no cookies, bearer tokens, authorization headers, browser databases, session IDs, or other reusable authentication material appear in the panel, logs, extension storage, or any local output;
- no asset transport occurs;
- the operator can describe the actual provider surface well enough to design Phase B2 from evidence rather than guesses.

If the observed page shape is unsupported, preserve `unsupported_page_shape` as evidence and revise the observer narrowly. If any apparently necessary transport mechanism requires reusable authentication extraction, record `reusable_auth_required` and stop.

## Phase B2 — 25-track transport pilot, not yet admitted

Only after the Phase-B1 live witness may a separate reviewed change propose actual acquisition.

The eventual transport pilot remains capped at **25 tracks** and must let the operator inspect exactly what will be requested and written before acquisition begins.

Its receipt must eventually prove:

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

Only after that 25-track transport receipt passes should full-corpus preservation begin.

## External deadline

The project records **September 3, 2026** as the external preservation deadline. Operational work should complete materially earlier to leave room for verification, reruns, and a second physical copy.
