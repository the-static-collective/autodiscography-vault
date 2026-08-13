# Security

## Current security posture

Autodiscography Vault Phase A is synthetic-only. It contains no live provider client and requires no provider credentials.

## Never commit

Do not commit:

- real audio, artwork, lyrics, or provider response bodies from the private corpus;
- cookies or browser databases;
- passwords;
- bearer/session/access tokens;
- authorization headers;
- exported local/session storage containing reusable authentication material;
- logs or screenshots containing any of the above.

The bounded receipt contract rejects secret-shaped fields and obvious secret-shaped string values before journal append and does not echo rejected values in diagnostics.

## Local output

Preservation output is local by design. Phase A has no telemetry or corpus upload path.

## Future live adapter

Any future live provider adapter must be reviewed separately. If operation would require extracting reusable authentication material, the correct behavior is refusal, not expansion of authority.

Provider access controls, CAPTCHA, rate limits, entitlement checks, and unavailable downloads must not be bypassed.

## Reporting

For security problems in the repository implementation, open a GitHub issue that describes the behavior without including secrets, private corpus material, or reusable session data.
