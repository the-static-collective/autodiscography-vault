# PINCERSMASH 002 — source jaw (Autodiscography Vault)

Bounded one-track human-operated proof. This does not acquire anything from Suno and does not alter the acquisition journal.

```sh
npm test
node scripts/week-evidence.js --vault-root /path/to/private/Vault --track-id 70b1d32e-21b6-4340-990d-1a4ef67cfc42 --asset-role audio_wav
```

The command reads Vault's existing validated append-only acquisition journal, selects the latest matching record (or one explicitly specified run ID), refuses anything but `verified`, resolves the recorded asset **inside** the Vault without following symlinks, streams its actual bytes through SHA-256 and compares byte length and hash to the receipt. Only then does it print a path-free `static-field/week-source-evidence/v0` JSON docket.

This is **not** a signature, provider authenticity check, legal rights proof, metadata ancestry claim, audio release or transfer authorization. It is a claim that one current Vault machine has checked its own local source bytes. A human may choose to save and carry that docket and the corresponding audio independently. The Workbench receiver must independently recompute the bytes on its own machine to earn anything beyond `SOURCE_CLAIM_ONLY`.

The original acquisition journal, private audio, lyrics, raw metadata, transport URLs, cookies, sessions and local filesystem paths remain inside the Vault. No network calls, browser permission changes, automatic publishing, or direct receipt-to-reLATTE promotion.

The source and Workbench jaws converge on the exact Suno track ID. They remain independently authoritative only for their **own** local observations.

**Real-world gate:** this code alone does not mean any actual song WAV has been preserved or transferred. Run it only after a real Vault receipt and actual asset exist.
