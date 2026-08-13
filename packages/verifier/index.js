import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export function verifyBytes(bytes) {
  const buffer = Buffer.from(bytes);
  return Object.freeze({
    byteLength: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  });
}

export async function verifyFile(path) {
  return verifyBytes(await readFile(path));
}

export function assertMatchesReceipt(actual, expected) {
  if (
    actual.byteLength !== expected.byteLength ||
    actual.sha256 !== expected.sha256
  ) {
    throw new Error(
      `verification mismatch: expected ${expected.byteLength}/${expected.sha256}, actual ${actual.byteLength}/${actual.sha256}`,
    );
  }
  return true;
}
