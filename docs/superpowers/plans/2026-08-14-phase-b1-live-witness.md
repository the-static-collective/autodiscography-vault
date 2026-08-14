# Phase B1 Live Witness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent Suno-only read-only content script that produces a sanitized, deterministic <=25-track live observation for the Vault side panel while keeping acquisition disabled.

**Architecture:** Provider-specific DOM interpretation lives in a pure `live-observer.js` module. A thin content script answers explicit extension messages with sanitized observations. The side panel requests and renders those observations, while the existing Phase-A journal/verifier remains untouched.

**Tech Stack:** Manifest V3 Chromium extension, browser JavaScript ES modules where supported, Node.js 22 built-in test runner.

## Global Constraints

- Content-script match scope is only `https://suno.com/*` and `https://www.suno.com/*`.
- Maximum live candidates is exactly 25.
- No `cookies`, `webRequest`, `<all_urls>`, telemetry, server/Vercel corpus transport, reusable auth capture, or browser-database access.
- Phase B1 observes and proposes only; asset transport remains disabled.
- Missing provider IDs remain `null`; they are never synthesized.
- Existing Phase-A tests and synthetic pilot must remain green.

---

### Task 1: Freeze manifest and observer boundary with failing tests

**Files:**
- Modify: `tests/extension-boundary.test.js`
- Create: `tests/live-observer.test.js`
- Create: `tests/phase-b1-ui.test.js`

**Interfaces:**
- Consumes: `extension/manifest.json`, future `observeSunoDocument(input)` and `sanitizeObservation(value)` exports.
- Produces: executable acceptance tests for permission scope, origin refusal, 25-track cap, null IDs, secret rejection, and disabled acquisition UI.

- [ ] Add manifest assertions requiring the two Suno-only content-script matches and forbidding `cookies`, `webRequest`, `<all_urls>`, `declarativeNetRequest`, and broad host permissions.
- [ ] Add `live-observer.test.js` fixtures using simple document-like node adapters; assert wrong-origin refusal, deterministic first-25 truncation, explicit `null` IDs, and secret-shaped evidence refusal without echo.
- [ ] Add `phase-b1-ui.test.js` that reads `index.html` and asserts the live-witness control exists while acquisition remains disabled.
- [ ] Run `npm test`; verify the new tests fail because Phase B1 production code/manifest/UI do not exist yet.

### Task 2: Implement the pure live observer and thin content-script adapter

**Files:**
- Create: `extension/src/provider/suno/live-observer.js`
- Create: `extension/src/provider/suno/content-script.js`
- Modify: `extension/manifest.json`

**Interfaces:**
- Produces: `observeSunoDocument({ origin, candidates, observedAt }) -> LiveObservation`; `sanitizeObservation(value) -> sanitized value | throws BoundedObservationError`.
- Content script listens for `{ type: "vault:observe" }` and returns a `LiveObservation`.

- [ ] Implement allowed-origin validation for exact Suno HTTPS origins.
- [ ] Implement centralized candidate extraction helpers that accept DOM elements in-browser and deterministic test adapters in Node.
- [ ] Implement max-25 truncation and explicit nullable fields.
- [ ] Implement secret-shaped key/value rejection with bounded `reusable_auth_required` error and no sensitive echo.
- [ ] Add the permanent content script to the MV3 manifest with only Suno match patterns.
- [ ] Run focused observer/boundary tests until green, then run full `npm test`.

### Task 3: Turn the side panel into a Phase-B1 proposal surface

**Files:**
- Modify: `extension/src/sidepanel/index.html`
- Modify: `extension/src/sidepanel/index.js`
- Modify: `extension/src/sidepanel/styles.css`

**Interfaces:**
- Consumes: `chrome.tabs.query` for the active tab and `chrome.tabs.sendMessage(tabId, {type:"vault:observe"})` when extension APIs are available.
- Produces: visible live observation/refusal state, `n / 25` count, observed evidence, proposed asset roles, and disabled acquisition control.

- [ ] Add Phase-B1 markup with `Refresh live witness`, status, count, observations list, and a disabled acquisition button.
- [ ] Keep the existing synthetic fixture proposal available as local proof.
- [ ] Implement defensive UI behavior when the side panel is opened outside extension APIs or no matching Suno content script is reachable; show `wrong_origin`/bounded unavailable state instead of throwing.
- [ ] Render `unknown` for absent ID/title/source URL rather than inventing values.
- [ ] Run UI source test and full `npm test`.

### Task 4: Update operator docs and project state

**Files:**
- Modify: `README.md`
- Modify: `docs/TRUST-BOUNDARY.md`
- Modify: `docs/NETWORK-BEHAVIOR.md`
- Modify: `docs/PILOT-RUNBOOK.md`

**Interfaces:**
- Produces: operator-visible authority statement and manual witness steps.

- [ ] Change project state to `Phase B1 — live witness/proposal` and state explicitly that transport is still disabled.
- [ ] Document permanent Suno-only content-script authority and forbidden permissions.
- [ ] Document refusal codes and the <=25 observation cap.
- [ ] Add unpacked-extension manual witness steps: load extension, sign in normally at Suno, open library, refresh witness, confirm <=25 candidates, record structural findings only.
- [ ] State Vercel/server transport is outside the Vault acquisition path.
- [ ] Run full `npm test` and `npm run synthetic:pilot`.

### Task 5: Publish and review

**Files:**
- No new production files expected.

**Interfaces:**
- Produces: draft PR closing Vault issue #3 while leaving `corpus-os#4` open.

- [ ] Compare `agent/phase-b1-live-witness` against `main` and confirm scope contains only Phase-B1 witness/proposal work plus docs/spec/plan.
- [ ] Open a draft PR with `Closes #3`, exact validation evidence, and known limitation that a real signed-in Suno operator witness is still required.
- [ ] Run PR CI and automated review; address only findings within Phase-B1 scope.
- [ ] Do not merge without explicit per-PR landing approval.