# Network Behavior

## Phase B2C: page witness plus one optional browser-held transport capability

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
- no clipboard extension permission;
- no externally connectable surface;
- no telemetry or server transport permission.

## DOM-observed transport surfaces

The live observer characterizes only URLs already exposed through visible page media/link elements. A theoretical asset role is not treated as proof that a transport exists.

An actually exposed `.wav` path or WAV MIME may be classified as `audio_wav`. The exact observed transport URL may contain short-lived signed query material. It remains in the in-memory observation object only for the immediate direct Chrome download. The durable request preview strips query and fragment material before SHA-256 identity is computed.

## Optional Downloads capability

The side panel requests:

```js
chrome.permissions.request({ permissions: ['downloads'] })
```

only when the operator presses **Enable pilot transport**. Denial leaves live observation available and transport locked.

The extension does not require permission-gated Downloads APIs before that grant. After grant, the current one-track pilot may use `chrome.downloads.download`, `chrome.downloads.onCreated`, `chrome.downloads.onChanged`, and a specific `chrome.downloads.search({ id })` lookup.

### Direct observed-asset path

When a real DOM asset transport surface exists, one selected asset may be passed directly to `chrome.downloads.download()` and staged under a relative Downloads path:

```text
Autodiscography-Vault/<run-id>/<providerTrackId>/<assetRole>.<ext>
```

At completion, the side panel resolves that exact download ID to the browser's absolute completed local filename before building any local-admission handoff.

### User-triggered WAV path

If Suno's normal Download → WAV action creates a browser download without an honest stable DOM WAV URL, the operator may arm **Witness one WAV** for exactly one selected track.

The extension then watches future `downloads.onCreated` events. A candidate must:

- begin at or after the arm time;
- carry `.wav` filename evidence or a recognized WAV MIME;
- have either no referrer or an exact Suno-origin referrer;
- have a valid Chrome download ID and local filename.

A second matching WAV before the first bound WAV reaches a terminal state fails closed as `wav_witness_ambiguous`.

The binder may inspect the browser's `DownloadItem` transiently, but bound state does not retain `url`, `finalUrl`, or `referrer`. Completion performs only a lookup of the already-bound download ID and uses the completed local filename. When this path has no honest safe HTTP request descriptor, `requestDescriptorSha256` is omitted rather than fabricated.

The extension does not add page-supplied headers, export cookies, or proxy through a Vault server. If Chrome cannot complete the download in the current signed-in browser session, transport is failed/interrupted rather than widened.

## Local durable boundary

Chrome staging is not Vault admission. The local Node `pilot:admit` command begins the durable boundary from the completed staged file itself and performs no provider network request.

The side panel may build a temporary one-line PowerShell command from the completed local filename, operator-entered Vault root, and bounded witness evidence. Copying uses `navigator.clipboard.writeText()` only from the explicit copy-button gesture; the extension requests no clipboard permission and does not store the command in browser storage.

Durable records may contain:

- provider and provider track ID;
- asset role;
- observation timestamp;
- redacted `requestDescriptorSha256` when an honest descriptor exists;
- local relative path;
- exact byte length;
- exact SHA-256;
- explicit acquisition state/reason.

They may not contain exact signed URLs, query/fragment capabilities, referrers, cookies, headers, bearer/session tokens, or browser storage.

For `audio_wav`, local admission refuses obvious non-WAV bytes before a verified receipt is written by checking RIFF/WAVE or RF64/WAVE container identity.

The Node-side `--vault-root` may be an external drive. This does not grant the browser direct filesystem authority to that drive.

## Telemetry and servers

There is no analytics transport, crash upload, corpus sync, Vercel hop, or third-party logging path. Preservation remains local-first.

## Closed gates

Phase B2C does not enable 25-track or full-corpus transport, stems, Studio exports, or hidden endpoint reconstruction. Those gates remain closed until the one-real-WAV human specimen proves the signed-in flow without reusable authentication extraction.
