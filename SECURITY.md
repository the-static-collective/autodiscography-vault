# Security

## Current security posture

Autodiscography Vault Phase B2C has proved a bounded one-track WAV specimen without exporting browser authentication. Census v1 admits durable-safe observation packs and exact auto-scroll round segments. The Suno content script remains observation-only. Chrome's `downloads` capability is optional and requested only when the operator explicitly presses **Enable pilot transport** or **Start auto-scroll census**.

Browser transport stages one already-observed asset below Downloads. Durable admission begins only when the local Node `pilot:admit` command receives staged bytes.

## Never persist or commit

Do not persist or commit:

- real audio, artwork, lyrics, or provider response bodies from the private corpus to Git;
- exact signed/CDN transport URLs when they contain query strings, fragments, signed capabilities, or other reusable access material;
- cookies or browser databases;
- passwords;
- bearer/session/access tokens;
- authorization headers;
- exported local/session storage containing reusable authentication material;
- logs or screenshots containing any of the above.

The exact observed transport URL may exist only ephemerally in extension memory long enough for the user-invoked Chrome download. Durable evidence uses a redacted request preview and `requestDescriptorSha256`, plus resulting exact byte identity.

Census v1 preserves admitted raw packs and auto-scroll segments byte-for-byte, so it must not silently sanitize an unsafe source and call the result raw. Before raw admission it refuses explicit authorization/cookie/access-token aliases, bearer values, and capability-bearing URLs. Create a durable-safe observation envelope at the capture boundary with typed `refused` evidence instead of placing reusable browser/session capability in the pack.

The receipt contract rejects secret-shaped fields and obvious secret-shaped values before journal append and does not echo rejected values in diagnostics. `transportUrl` is not a receipt field.

## Browser authority

Required extension authority remains only `sidePanel`. `downloads` is optional runtime authority. Auto-scroll uses it only to complete a local Blob-backed JSON segment before advancing; the content script still cannot call Downloads. The implementation must not add `cookies`, `webRequest`, `declarativeNetRequest`, `<all_urls>`, Native Messaging, browser-database access, telemetry, or a server acquisition path to make either path succeed.

If an observed asset cannot be transported by Chrome in the normal signed-in browser context without extracting reusable authentication material, the correct result is refusal/failure, not wider authority.

Census ingest grants no new browser authority and performs no provider network request. It reads a local NDJSON source or one contiguous directory of completed auto-scroll segments and writes only below the operator-selected Vault root.

## Local admission

`pilot:admit` receives only local file paths and bounded non-secret evidence. It:

1. validates inputs before journal mutation;
2. verifies staged bytes by SHA-256 and byte length;
3. writes a `0600` `.partial` file;
4. verifies before atomic promotion;
5. appends a verified receipt;
6. rebuilds the bounded handoff manifest;
7. independently re-verifies the final file.

An already verified key is skipped only after the existing final independently matches its receipt. A mismatch refuses overwrite.

## Provider behavior

Provider access controls, CAPTCHA, rate limits, entitlement checks, and unavailable downloads must not be bypassed. Phase B2 does not reverse engineer provider APIs or extract session credentials. Ordinary-DOM auto-scroll does not itself establish permission to automate a provider surface; operators must verify current terms and authorization before running it.

## Reporting

For security problems in the repository implementation, open a GitHub issue that describes the behavior without including secrets, private corpus material, exact signed URLs, or reusable session data.
