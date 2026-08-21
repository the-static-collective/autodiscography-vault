# Pilot Runbook

## Automated preservation floor

Requires Node.js 22 or newer and a clean checkout with no real provider corpus material committed to Git.

```bash
npm ci
npm test
npm run synthetic:pilot
```

The automated suite must prove receipt validation, secret refusal, exact SHA-256/byte length, corruption detection, append-only/torn-journal behavior, explicit incomplete states, read-only provider observation, duplicate-witness enrichment, optional-only browser transport authority, request redaction, one-shot WAV binding, WAV container sanity, staged-byte admission, idempotent resume, and the synthetic interruption/promotion proof.

Any failure keeps live transport below the next pilot gate.

## Landed Phase B2 specimen

The earlier one-track membrane has a real human artwork specimen: Chrome optional Downloads authority staged one observed asset and local `pilot:admit` verified and journaled the exact bytes without making the signed transport URL durable.

That specimen proves the browser/local membrane. It does **not** prove full-song WAV behavior and does not authorize 25-track transport.

## Phase B2C — one full-song WAV specimen

**This is the current human gate. Do not use the disabled 25-track acquisition control.**

### 1. Refresh the real witness

1. Load `extension/` unpacked in Chrome/Chromium.
2. Sign in normally at the real Suno origin.
3. Open the page containing the song you want to test.
4. Open the Vault side panel and press **Refresh live witness**.
5. Confirm the chosen track has a real provider track ID and the panel shows the exact `Observed at` timestamp.

The live observer may classify a real `.wav` / WAV MIME DOM surface as `audio_wav`, but Phase B2C does not invent a WAV URL when none is exposed.

### 2. Grant the existing optional transport

Press **Enable pilot transport**. Grant only Chrome's Downloads permission.

Do not approve cookie, all-sites, request-interception, browser-database, Native Messaging, or reusable session authority.

### 3. Arm exactly one WAV witness

On exactly one track, press **Witness one WAV**.

The arm is future-only and bound to:

- one run ID;
- one provider track ID;
- the original observation timestamp;
- the arm time.

Then use **Suno's own normal Download → WAV action**. The Vault does not click the provider menu for you and does not reconstruct a hidden endpoint.

If two matching WAV downloads begin before the first resolves, the one-shot witness refuses as `wav_witness_ambiguous`. If the download is interrupted, no durable verified receipt exists.

### 4. Confirm the completed local staging path

After Chrome reports completion, Vault resolves that exact download ID through `chrome.downloads.search({ id })` and displays the completed absolute local filename.

For the user-triggered WAV path, the durable evidence intentionally says:

```text
request descriptor unavailable by design
```

Do not invent a request hash. If an honest DOM transport surface supplied a bounded request descriptor, its existing hash may still be carried.

### 5. Point local admission at the preservation drive

Enter the actual external-drive Vault root in **Vault root for local admission**, for example:

```text
E:\Autodiscography-Vault
```

Use the machine's real drive letter/path; the example is not authoritative.

The browser is not granted direct access to that drive. It only completes the download. Node performs durable admission to the chosen `--vault-root`.

### 6. Run the generated temporary handoff

Vault builds a one-line PowerShell command containing only:

- completed local staged filename;
- chosen Vault root;
- run ID;
- provider track ID;
- `assetRole=audio_wav`;
- original observation timestamp;
- request descriptor hash only when one honestly exists.

Press **Copy pilot:admit command** and run the command from the Autodiscography Vault repository root.

This command-line step is temporary B2C proof ceremony. A later local companion should remove the manual PowerShell step while reusing the same verifier/journal/handoff boundary.

### 7. Expected local admission behavior

Before a verified `audio_wav` receipt is written, `pilot:admit` must confirm the staged bytes begin with an ordinary RIFF/WAVE or RF64/WAVE container signature. A `.wav` filename alone is not success.

Then the existing admission path must:

1. verify the staged file's SHA-256 and byte length;
2. write and verify a restricted `.partial` final candidate;
3. atomically promote the final;
4. append one `verified` receipt;
5. write `receipts/handoff.json`;
6. independently re-verify the final;
7. skip a repeated verified key only after the existing final matches its receipt.

### 8. Independently verify the final WAV on Windows

Use the final path printed by `pilot:admit`:

```powershell
Get-FileHash -Algorithm SHA256 '<final-wav-path>'
(Get-Item '<final-wav-path>').Length
```

The SHA-256 and byte length must exactly equal the receipt.

### 9. Inspect the durable boundary

The B2C specimen passes only when:

- the chosen real provider track ID is preserved;
- the operator explicitly selected WAV in Suno;
- exactly one future WAV was bound;
- the staged bytes pass RIFF/WAVE or RF64/WAVE sanity;
- the receipt has `assetRole: audio_wav` and `state: verified`;
- independent final SHA-256/byte length equal the receipt;
- the admitted final exists under the selected Vault root/external drive;
- `acquisition.jsonl` and `handoff.json` contain no exact signed URL/query/fragment, cookie, authorization header, bearer/session token, or browser storage;
- `requestDescriptorSha256` is omitted rather than fabricated when the user-triggered browser download had no honest descriptor;
- the 25-track/full-corpus control remains disabled.

## Gate after the specimen

Only after the one-WAV signed-in witness passes may a separate design propose bounded multi-song WAV preservation. That later slice may investigate Suno's normal multi-song workflow, but B2C itself does not enable the existing 25-track button or a full-corpus run.

The automation destination remains explicit: the proof ceremony should eventually collapse into a local companion/resumable preservation run so the operator does not have to repeat PowerShell admission by hand.

## External deadline

The project records **September 3, 2026** as the external preservation deadline. Operational work should complete materially earlier to leave room for verification, reruns, and a second physical copy.
