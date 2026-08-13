import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { appendJournalEntry, latestReceiptForKey, readJournal } from '../packages/journal/index.js';
import { makeAcquisitionKey } from '../packages/acquisition-contract/index.js';
import { assertMatchesReceipt, verifyFile } from '../packages/verifier/index.js';
import { buildHandoffManifest } from '../packages/manifest/index.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const FIXTURE_ROOT = join(REPO_ROOT, 'fixtures', 'synthetic-suno');
const OBSERVED_AT = '2026-08-12T00:00:00.000Z';
const RUN_ID = 'synthetic-phase-a-001';

async function atomicPromoteBytes(bytes, finalPath) {
  await mkdir(dirname(finalPath), { recursive: true });
  const partialPath = `${finalPath}.partial`;
  await writeFile(partialPath, bytes, { mode: 0o600 });
  const verified = await verifyFile(partialPath);
  await rename(partialPath, finalPath);
  return verified;
}

async function verifyExistingFinal({ journalPath, finalPath, key }) {
  const entries = await readJournal(journalPath);
  const latest = latestReceiptForKey(entries, key);
  if (!latest || latest.state !== 'verified') return { skipped: false };
  const actual = await verifyFile(finalPath);
  assertMatchesReceipt(actual, latest);
  return { skipped: true, verification: actual };
}

export async function runSyntheticPilot({ outputRoot } = {}) {
  const root = outputRoot ?? await mkdtemp(join(tmpdir(), 'autodiscography-vault-'));
  const receiptsDir = join(root, 'receipts');
  const rawDir = join(root, 'raw');
  const assetsDir = join(root, 'assets');
  await Promise.all([
    mkdir(receiptsDir, { recursive: true }),
    mkdir(rawDir, { recursive: true }),
    mkdir(assetsDir, { recursive: true }),
  ]);

  const journalPath = join(receiptsDir, 'acquisition.jsonl');
  const rawSource = join(FIXTURE_ROOT, 'raw', 'library.json');
  const rawFinal = join(rawDir, 'library.json');
  const rawBytes = await readFile(rawSource);
  const rawVerification = await atomicPromoteBytes(rawBytes, rawFinal);

  await appendJournalEntry(journalPath, {
    schemaVersion: 1,
    runId: RUN_ID,
    provider: 'suno',
    providerTrackId: 'synthetic-library-observation',
    assetRole: 'raw_metadata',
    state: 'verified',
    observedAt: OBSERVED_AT,
    sourceRelativePath: relative(root, rawFinal),
    ...rawVerification,
  });

  const audioSource = join(FIXTURE_ROOT, 'assets', 'track-alpha.mp3');
  const audioFinal = join(assetsDir, 'synthetic-track-alpha.mp3');
  const audioPartial = `${audioFinal}.partial`;
  const audioBytes = await readFile(audioSource);
  await writeFile(audioPartial, audioBytes.subarray(0, Math.max(1, Math.floor(audioBytes.length / 2))), { mode: 0o600 });

  await appendJournalEntry(journalPath, {
    schemaVersion: 1,
    runId: RUN_ID,
    provider: 'suno',
    providerTrackId: 'synthetic-track-alpha',
    assetRole: 'audio_mp3',
    state: 'partial',
    observedAt: OBSERVED_AT,
    sourceRelativePath: relative(root, audioPartial),
    reasonCode: 'interrupted',
    rawMetadataPath: relative(root, rawFinal),
    rawMetadataSha256: rawVerification.sha256,
  });

  const audioVerification = await atomicPromoteBytes(audioBytes, audioFinal);
  await appendJournalEntry(journalPath, {
    schemaVersion: 1,
    runId: RUN_ID,
    provider: 'suno',
    providerTrackId: 'synthetic-track-alpha',
    assetRole: 'audio_mp3',
    state: 'verified',
    observedAt: OBSERVED_AT,
    sourceRelativePath: relative(root, audioFinal),
    ...audioVerification,
    rawMetadataPath: relative(root, rawFinal),
    rawMetadataSha256: rawVerification.sha256,
  });

  await appendJournalEntry(journalPath, {
    schemaVersion: 1,
    runId: RUN_ID,
    provider: 'suno',
    providerTrackId: 'synthetic-track-beta',
    assetRole: 'lyrics',
    state: 'missing',
    observedAt: OBSERVED_AT,
    reasonCode: 'not_available',
    rawMetadataPath: relative(root, rawFinal),
    rawMetadataSha256: rawVerification.sha256,
  });

  const history = await readJournal(journalPath);
  const manifest = buildHandoffManifest({ runId: RUN_ID, receipts: history });
  const manifestPath = join(receiptsDir, 'handoff.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const independentAudio = await verifyFile(audioFinal);
  assertMatchesReceipt(independentAudio, audioVerification);
  const key = makeAcquisitionKey({ runId: RUN_ID, providerTrackId: 'synthetic-track-alpha', assetRole: 'audio_mp3' });
  const secondPass = await verifyExistingFinal({ journalPath, finalPath: audioFinal, key });

  return Object.freeze({
    runId: RUN_ID,
    outputRoot: root,
    journalPath,
    manifestPath,
    historyEntries: history.length,
    verifiedAssets: history.filter(entry => entry.state === 'verified').length,
    partialEntries: history.filter(entry => entry.state === 'partial').length,
    missingEntries: history.filter(entry => entry.state === 'missing').length,
    skippedExistingVerified: secondPass.skipped,
    audio: independentAudio,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = await runSyntheticPilot();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
