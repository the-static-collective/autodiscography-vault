# Network Behavior

## Phase A: none

Phase A performs **no provider network activity**.

The Chromium extension manifest intentionally has:

- no `host_permissions`;
- no `cookies` permission;
- no content scripts;
- no background network worker;
- no externally connectable surface.

The fixture adapter contains no `fetch`, `XMLHttpRequest`, or `WebSocket` behavior. The synthetic pilot reads only repository-local fixtures and writes only local temporary files.

## Telemetry

There is no telemetry endpoint, analytics transport, crash upload, corpus sync, or third-party logging path in Phase A.

## Phase B is a separate authority decision

The planned 25-track pilot may later introduce a narrow live `provider/suno` adapter, but only behind an explicit experimental gate and only after this Phase-A receipt passes.

A Phase-B implementation must remain bounded to a normal user-selected, signed-in `suno.com` tab. It must not export reusable session material or bypass provider controls. Its exact network calls, permissions, rate behavior, retry ceiling, and stop conditions must be reviewed as a separate change before use.

The existence of this document is not permission to implement or run Phase B.
