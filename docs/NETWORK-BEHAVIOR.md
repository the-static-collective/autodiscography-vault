# Network Behavior

## Phase B1: provider-page witness, no asset transport

Phase B1 installs a permanent Manifest V3 content script only on:

- `https://suno.com/*`
- `https://www.suno.com/*`

The content script reads DOM-visible provider evidence when the Vault side panel explicitly asks for a live observation. It does not initiate provider requests and does not acquire MP3, artwork, lyrics, or raw metadata.

The extension manifest intentionally has:

- no `host_permissions` block;
- no `cookies` permission;
- no `webRequest` or `declarativeNetRequest` permission;
- no `<all_urls>` match;
- no externally connectable surface;
- no download permission;
- no telemetry or server transport permission.

The Phase-B1 content script and observer contain no `fetch`, `XMLHttpRequest`, `WebSocket`, cookie API, or request-header interception path. The browser's normal Suno page remains responsible for its own signed-in traffic; Vault observes only the rendered provider surface.

## Bounded messaging

The side panel sends only `{ type: "vault:observe" }` to the active tab. A Suno content script responds with a sanitized live observation capped at 25 candidates. If no Suno content script is reachable, the panel reports a bounded refusal rather than trying another origin.

Secret-shaped evidence causes `reusable_auth_required`; the sensitive value is not returned to the panel.

## Telemetry and servers

There is no telemetry endpoint, analytics transport, crash upload, corpus sync, Vercel hop, or third-party logging path in Phase B1.

Vercel is intentionally outside the Vault acquisition architecture. It may serve other Static Collective projects, but Vault preservation remains local-first.

## Phase B2 is a separate authority decision

A later change may propose actual provider asset transport only after the operator's live Phase-B1 witness establishes which asset surfaces are legitimately available to the normal signed-in page.

That review must specify exact requests, permissions, rate behavior, retry ceiling, stop conditions, and secret handling. If transport requires reusable authentication extraction, it is refused rather than implemented.
