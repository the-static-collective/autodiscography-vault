# Read-only media resolver v0

**Status:** local experimental resolver over already-admitted Vault assets.

> **An address may locate bytes. It does not confer authority over them.**

The resolver adds a narrow local playback surface to Autodiscography Vault.

It accepts only:

```text
sha256:<64 lowercase hex>
```

and only resolves when the Vault acquisition journal contains exactly one unambiguous verified audio object for that digest.

Resolution is not satisfied by receipt metadata alone. Every request re-checks the local asset:

```text
content address
→ verified acquisition receipt
→ safe Vault-relative path
→ regular local file
→ SHA-256 + byte-length re-verification
→ WAV container sanity when role = audio_wav
→ descriptor / read-only byte stream
```

## Endpoints

Run:

```bash
npm run resolver:serve -- \
  --vault-root /path/to/Autodiscography-Vault \
  --port 13703 \
  --room-origin http://127.0.0.1:13702
```

The server binds only to `127.0.0.1`.

- `GET /v0/status`
- `GET /v0/resolve/<sha256>`
- `GET|HEAD /v0/media/<sha256>`
- a single HTTP byte range is supported for media seeking

The resolver exposes no arbitrary path endpoint, no directory listing, no mutation route, and no provider/session transport.

## Refusal rules

```text
ADDRESS != AUTHORITY
RECEIPT != BYTES
RESOLUTION REQUIRES BYTE REVERIFICATION
PLAYABLE != ADMITTED
```

It refuses:

- malformed/non-SHA addresses;
- unknown hashes;
- missing verified local bytes;
- changed bytes;
- invalid WAV containers;
- path escape;
- ambiguous multiple verified audio objects for one digest;
- non-loopback Host values;
- non-configured browser origins;
- write methods.

## Intended ROroomOM use

ROroomOM may ask the resolver for an addressed audio object and render the returned loopback media URL in an Audio Player instrument.

The player does not acquire the file, rewrite the receipt, or change source identity.

```text
PLAYER != OWNER
PLAYBACK != SOURCE MUTATION
VAULT RESOLUTION != ROOM ADMISSION
```
