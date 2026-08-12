import { open, readFile } from 'node:fs/promises';
import { validateReceipt, makeAcquisitionKey } from '../acquisition-contract/index.js';

export async function appendJournalEntry(path, entry) {
  const receipt = validateReceipt(entry);
  const handle = await open(path, 'a', 0o600);
  try {
    await handle.write(`${JSON.stringify(receipt)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return receipt;
}

export async function readJournal(path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  if (text === '') return [];
  if (!text.endsWith('\n')) throw new Error('journal is truncated: missing final newline');

  const lines = text.slice(0, -1).split('\n');
  return lines.map((line, index) => {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`journal line ${index + 1} is invalid JSON`);
    }
    try {
      return validateReceipt(parsed);
    } catch (error) {
      throw new Error(`journal line ${index + 1} is invalid: ${error.message}`);
    }
  });
}

export function latestReceiptForKey(entries, key) {
  return [...entries].reverse().find(entry => makeAcquisitionKey(entry) === key);
}
