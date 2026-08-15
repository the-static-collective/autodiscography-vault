# Network Behavior

## Phase B2: page witness plus one browser-held transport

The permanent Manifest V3 content script remains limited to:

- `https://suno.com/*`
- `https://www.suno.com/*`

It reads DOM-visible provider evidence only when the Vault side panel requests observation. It does not call `fetch`, `XMLHttpRequest`, `WebSocket`, cookie APIs, request-header interception APIs, or `chrome.downloads`.

The extension manifest intentionally has:

- required permission: `sidePanel` only;
- optional permission: `downloads` only;
- no `host_permissions` block;
- no `cookies`, `webRequest`, or `declarativeNetRequest` permission;
- no `<all_urls>` match;
- no Native Messaging;
- no externally connectable surface;
- no telemetry or server transport permission.

## Observed transport surfaces

Phase B2A characterizes only URLs already exposed through visible page media/link elements. A theoretical asset role is not treated as proof that a transport exists.

The exact observed transport URL may contain short-lived signed query material. It is retained only in the in-memory observation object for the immediate operator-selected download. The durable request preview strips query and fragment material before SHA-256 identity is computed.

## Optional Downloads capability

The side panel requests:

```js
chrome.permissions.request({ permissions: ['downloads'] })
```

only when the operator presses **Enable pilot transport**. Denial leaves live observation available and transport locked.

After grant, one selected observed asset is passed directly to `chrome.downloads.download()` and staged under a relative Downloads path:

```text
Autodiscography-Vault/<run-id>/<providerTrackId>/<assetRole>.<ext>
```

The request does not add page-supplied headers, export cookies, or proxy through a Vault server. If Chrome cannot complete the download in the current browser session, the transport is treated as failed/interrupted rather than widening authority.

## Durable boundary

Chrome staging is not Vault admission. The local Node `pilot:admit` command begins the durable boundary from the staged file itself. It receives no exact transport URL and performs no provider network request.

Durable records may contain:

- provider and provider track ID;
- asset role;
- observation timestamp;
- redacted `requestDescriptorSha256`;
- local path;
- exact byte length;
- exact SHA-256;
- explicit acquisition state/reason.

They may not contain exact signed URLs, query/fragment capabilities, cookies, headers, bearer/session tokens, or browser storage.

## Telemetry and servers

There is no analytics transport, crash upload, corpus sync, Vercel hop, or third-party logging path. Preservation remains local-first.

## Closed gates

Phase B2 does not enable 25-track or full-corpus transport. Those gates remain closed until the one-track human specimen proves the real signed-in transport path without reusable authentication extraction.
