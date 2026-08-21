import { readFile, rename, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_ROLES, makeAcquisitionKey, validateReceipt } from '../packages/acquisition-contract/index.js';
import { appendJournalEntry, latestReceiptForKey, readJournal } from '../packages/journal/index.js';
import { buildHandoffManifest } from '../packages/manifest/index.js';
import { assertMatchesReceipt, verifyFile } from '../packages/verifier/index.js';
import { assertWavContainer } from '../packages/wav/index.js';

const SHA256_HEX = /^[a-f0-9]{64}$/;
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:authorization|cookie|session|token|password|secret)\s*[:=])/i;

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`missing ${name}`);
  if (SECRET_VALUE.test(value)) throw new Error('secret-shaped value refused');
  return value;
}

function safePathSegment(value, fallback) {
  const safe = value
    .slice(0, 256)
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^\.+$/, '_');
  return safe || fallback;
}

function safeExtension(path) {
  const extension = extname(path).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '.bin';
}

function slashPath(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

async function assertStagedFile(path) {
  let info;
  try {
    info = await stat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('staged file is missing');
    throw error;
  }
  if (!info.isFile()) throw new Error('staged file is not a file');
}

function validateInputs(options) {
  const stagedFile = resolve(requireString(options?.stagedFile, 'stagedFile'));
  const vaultRoot = resolve(requireString(options?.vaultRoot, 'vaultRoot'));
  const runId = requireString(options?.runId, 'runId');
  const providerTrackId = requireString(options?.providerTrackId, 'providerTrackId');
  const assetRole = requireString(options?.assetRole, 'assetRole');
  const observedAt = requireString(options?.observedAt, 'observedAt');
  const requestDescriptorSha256 = options?.requestDescriptorSha256 === undefined
    ? undefined
    : requireString(options.requestDescriptorSha256, 'requestDescriptorSha256');

  if (requestDescriptorSha256 !== undefined && !SHA256_HEX.test(requestDescriptorSha256)) {
    throw new Error('requestDescriptorSha256 must be lowercase SHA-256');
  }
  if (!ASSET_ROLES.includes(assetRole)) throw new Error('invalid assetRole');

  // Reuse the acquisition contract for canonical time, provider identity,
  // secret-shape refusal, and all other durable receipt invariants.
  validateReceipt({
    schemaVersion: 1,
    runId,
    provider: 'suno',
    providerTrackId,
    assetRole,
    state: 'verified',
    observedAt,
    byteLength: 0,
    sha256: '0'.repeat(64),
    ...(requestDescriptorSha256 === undefined ? {} : { requestDescriptorSha256 }),
  });

  return Object.freeze({
    stagedFile,
    vaultRoot,
    runId,
    providerTrackId,
    assetRole,
    observedAt,
    requestDescriptorSha256,
  });
}

async function writeHandoff({ vaultRoot, runId, journalEntries }) {
  const receiptDir = join(vaultRoot, 'receipts');
  const handoffPath = join(receiptDir, 'handoff.json');
  const partialPath = `${handoffPath}.partial`;
  const manifest = buildHandoffManifest({
    runId,
    receipts: journalEntries.filter(entry => entry.runId === runId),
  });
  await writeFile(partialPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await rename(partialPath, handoffPath);
  return handoffPath;
}

export async function admitStagedAsset(options) {
  const input = validateInputs(options);
  await assertStagedFile(input.stagedFile);
  if (input.assetRole === 'audio_wav') await assertWavContainer(input.stagedFile);

  const safeTrackId = safePathSegment(input.providerTrackId, 'unknown-track');
  const safeRole = safePathSegment(input.assetRole, 'other');
  const finalPath = join(input.vaultRoot, 'assets', safeTrackId, `${safeRole}${safeExtension(input.stagedFile)}`);
  const partialPath = `${finalPath}.partial`;
  const receiptDir = join(input.vaultRoot, 'receipts');
  const journalPath = join(receiptDir, 'acquisition.jsonl');
  const key = makeAcquisitionKey(input);

  const existingJournal = await readJournal(journalPath);
  const latest = latestReceiptForKey(existingJournal, key);
  if (latest?.state === 'verified') {
    let actual;
    try {
      actual = await verifyFile(finalPath);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error('verification mismatch: verified final is missing');
      throw error;
    }
    assertMatchesReceipt(actual, latest);
    return Object.freeze({
      skippedExistingVerified: true,
      finalPath,
      handoffPath: join(receiptDir, 'handoff.json'),
      receipt: latest,
    });
  }

  const stagedIdentity = await verifyFile(input.stagedFile);
  await mkdir(dirname(finalPath), { recursive: true, mode: 0o700 });
  await mkdir(receiptDir, { recursive: true, mode: 0o700 });

  let finalIdentity;
  try {
    finalIdentity = await verifyFile(finalPath);
    assertMatchesReceipt(finalIdentity, stagedIdentity);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;

    const bytes = await readFile(input.stagedFile);
    await writeFile(partialPath, bytes, { mode: 0o600 });
    const partialIdentity = await verifyFile(partialPath);
    assertMatchesReceipt(partialIdentity, stagedIdentity);
    await rename(partialPath, finalPath);
    finalIdentity = await verifyFile(finalPath);
    assertMatchesReceipt(finalIdentity, stagedIdentity);
  }

  const sourceRelativePath = slashPath(relative(input.vaultRoot, finalPath));
  const receipt = validateReceipt({
    schemaVersion: 1,
    runId: input.runId,
    provider: 'suno',
    providerTrackId: input.providerTrackId,
    assetRole: input.assetRole,
    state: 'verified',
    observedAt: input.observedAt,
    sourceRelativePath,
    byteLength: finalIdentity.byteLength,
    sha256: finalIdentity.sha256,
    ...(input.requestDescriptorSha256 === undefined
      ? {}
      : { requestDescriptorSha256: input.requestDescriptorSha256 }),
  });

  await appendJournalEntry(journalPath, receipt);
  const completeJournal = await readJournal(journalPath);
  const handoffPath = await writeHandoff({
    vaultRoot: input.vaultRoot,
    runId: input.runId,
    journalEntries: completeJournal,
  });

  const independentFinalIdentity = await verifyFile(finalPath);
  assertMatchesReceipt(independentFinalIdentity, receipt);

  return Object.freeze({
    skippedExistingVerified: false,
    finalPath,
    handoffPath,
    receipt,
  });
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) throw new Error('arguments must be --name value pairs');
    const key = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[key] = value;
  }
  return options;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const result = await admitStagedAsset(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({
      skippedExistingVerified: result.skippedExistingVerified,
      finalPath: result.finalPath,
      handoffPath: result.handoffPath,
      receipt: result.receipt,
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`pilot:admit refused: ${error?.message ?? 'unknown failure'}\n`);
    process.exitCode = 1;
  }
}
