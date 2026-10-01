import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { readJournal } from '../journal/index.js';
import { assertMatchesReceipt, verifyFile } from '../verifier/index.js';
import { assertWavContainer } from '../wav/index.js';

const ADDRESS = /^sha256:([a-f0-9]{64})$/;
const AUDIO_ROLES = new Set(['audio_mp3', 'audio_wav']);

export class ResolverError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ResolverError';
    this.code = code;
    this.status = status;
  }
}

export function parseAddress(address) {
  const match = typeof address === 'string' ? ADDRESS.exec(address) : null;
  if (!match) {
    throw new ResolverError(
      'INVALID_ADDRESS',
      'Expected sha256:<64 lowercase hex>.',
      400,
    );
  }
  return Object.freeze({ address, sha256: match[1] });
}

function safeAssetPath(vaultRoot, sourceRelativePath) {
  if (
    typeof sourceRelativePath !== 'string'
    || sourceRelativePath.length === 0
    || sourceRelativePath.startsWith('/')
    || sourceRelativePath.includes('\\')
    || sourceRelativePath.includes('\0')
  ) {
    throw new ResolverError(
      'INVALID_RECEIPT_PATH',
      'Verified receipt has no safe Vault-relative asset path.',
      409,
    );
  }

  const root = resolve(vaultRoot);
  const candidate = resolve(root, sourceRelativePath);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    throw new ResolverError(
      'PATH_ESCAPE',
      'Verified receipt path escapes the configured Vault root.',
      409,
    );
  }
  return candidate;
}

function mediaTypeForRole(role) {
  if (role === 'audio_wav') return 'audio/wav';
  if (role === 'audio_mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

async function verifiedCandidates(vaultRoot, sha256) {
  const journal = await readJournal(resolve(vaultRoot, 'receipts', 'acquisition.jsonl'));
  return journal.filter(receipt =>
    receipt.state === 'verified'
    && AUDIO_ROLES.has(receipt.assetRole)
    && receipt.sha256 === sha256
    && typeof receipt.sourceRelativePath === 'string'
  );
}

async function resolveInternal(vaultRoot, address) {
  const parsed = parseAddress(address);
  const candidates = await verifiedCandidates(vaultRoot, parsed.sha256);

  if (candidates.length === 0) {
    throw new ResolverError(
      'NOT_FOUND',
      'No verified audio receipt matches that content address.',
      404,
    );
  }

  const uniquePaths = new Map();
  for (const receipt of candidates) {
    const key = `${receipt.assetRole}\0${receipt.sourceRelativePath}`;
    uniquePaths.set(key, receipt);
  }

  if (uniquePaths.size !== 1) {
    throw new ResolverError(
      'AMBIGUOUS_ADDRESS',
      'More than one verified Vault audio object claims that content address.',
      409,
    );
  }

  const receipt = [...uniquePaths.values()][0];
  const filePath = safeAssetPath(vaultRoot, receipt.sourceRelativePath);

  let info;
  try {
    info = await stat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new ResolverError(
        'VERIFIED_BYTES_MISSING',
        'Receipt is verified but the local asset bytes are missing.',
        409,
      );
    }
    throw error;
  }

  if (!info.isFile()) {
    throw new ResolverError(
      'NOT_A_FILE',
      'Verified asset path is not a regular file.',
      409,
    );
  }

  const actual = await verifyFile(filePath);
  try {
    assertMatchesReceipt(actual, receipt);
  } catch {
    throw new ResolverError(
      'BYTE_MISMATCH',
      'Local asset bytes no longer match the verified receipt.',
      409,
    );
  }

  if (receipt.assetRole === 'audio_wav') {
    try {
      await assertWavContainer(filePath);
    } catch {
      throw new ResolverError(
        'INVALID_WAV',
        'Verified-address bytes do not pass the WAV container sanity check.',
        409,
      );
    }
  }

  return Object.freeze({
    filePath,
    receipt,
    descriptor: Object.freeze({
      schema: 'autodiscography-vault-resolver/v0',
      status: 'resolved-verified',
      address: parsed.address,
      sha256: actual.sha256,
      byteLength: actual.byteLength,
      mediaType: mediaTypeForRole(receipt.assetRole),
      assetRole: receipt.assetRole,
      provider: receipt.provider,
      providerTrackId: receipt.providerTrackId,
      observedAt: receipt.observedAt,
      sourceRelativePath: receipt.sourceRelativePath,
      authority: 'none',
      boundary: Object.freeze([
        'ADDRESS != AUTHORITY',
        'RECEIPT != BYTES',
        'RESOLUTION REQUIRES BYTE REVERIFICATION',
        'PLAYABLE != ADMITTED',
      ]),
    }),
  });
}

export async function resolveVerifiedAudio(vaultRoot, address) {
  const resolved = await resolveInternal(vaultRoot, address);
  return resolved.descriptor;
}

export async function resolveVerifiedAudioForServe(vaultRoot, address) {
  return resolveInternal(vaultRoot, address);
}
