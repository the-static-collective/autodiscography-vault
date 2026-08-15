# Security

## Current security posture

Autodiscography Vault Phase B2 adds a bounded one-track transport specimen without exporting browser authentication. The Suno content script remains observation-only. Chrome's `downloads` capability is optional and requested only when the operator presses **Enable pilot transport**.

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

The receipt contract rejects secret-shaped fields and obvious secret-shaped values before journal append and does not echo rejected values in diagnostics. `transportUrl` is not a receipt field.

## Browser authority

Required extension authority remains only `sidePanel`. `downloads` is optional runtime authority. The implementation must not add `cookies`, `webRequest`, `declarativeNetRequest`, `<all_urls>`, Native Messaging, browser-database access, telemetry, or a server acquisition path to make the pilot succeed.

If an observed asset cannot be transported by Chrome in the normal signed-in browser context without extracting reusable authentication material, the correct result is refusal/failure, not wider authority.

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

Provider access controls, CAPTCHA, rate limits, entitlement checks, and unavailable downloads must not be bypassed. Phase B2 does not reverse engineer provider APIs or extract session credentials.

## Reporting

For security problems in the repository implementation, open a GitHub issue that describes the behavior without including secrets, private corpus material, exact signed URLs, or reusable session data.
