import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admitSourceExport } from '../scripts/admit-source-export.js';

async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'adsource-'));
  try {
    const input = join(dir, 'test-export.json'), vaultRoot = join(dir, 'private-vault');
    await writeFile(input, JSON.stringify({songs:[{id:'a',title:'Oldest',lyrics:'first song',prompt:'p',tags:'bluegrass',created_at:'2025-01-01'}]}));
    return await fn({input,vaultRoot,dir});
  } finally { await rm(dir,{recursive:true,force:true}); }
}
test('preserves prompt and lyrics bytes exactly, not in receipts', async () => fixture(async ({input,vaultRoot}) => {
  const out = await admitSourceExport({input,vaultRoot});
  assert.equal(out.receipt.status,'source_bytes_verified_only');
  assert.equal(out.receipt.contentsInspected,false);
  assert.deepEqual(await readFile(join(vaultRoot,out.receipt.relativePath)),await readFile(input));
  assert.ok(!JSON.stringify(out.receipt).includes('Oldest'));
  assert.ok(!JSON.stringify(out.receipt).includes('bluegrass'));
}));
test('repeat intake is idempotent and journal is not duplicated', async () => fixture(async ({input,vaultRoot}) => {
  const a = await admitSourceExport({input,vaultRoot});
  const b = await admitSourceExport({input,vaultRoot});
  assert.equal(b.skippedExistingVerified,true);
  assert.equal(a.receipt.sha256,b.receipt.sha256);
  const lines = (await readFile(join(vaultRoot,'receipts','source-exports.jsonl'),'utf8')).trim().split('\n');
  assert.equal(lines.length,1);
}));
test('previous receipt cannot conceal tampering', async () => fixture(async ({input,vaultRoot}) => {
  const a = await admitSourceExport({input,vaultRoot});
  await writeFile(join(vaultRoot,a.receipt.relativePath),'tampered');
  await assert.rejects(admitSourceExport({input,vaultRoot}),/mismatch/);
}));
test('rejects unsupported source claims and unsafe formats', async () => fixture(async ({input,vaultRoot,dir}) => {
  await assert.rejects(admitSourceExport({input,vaultRoot,sourceClaim:'verified-first-party'}),/unknown_source_claim/);
  const bad = join(dir,'credentials.env'); await writeFile(bad,'TOKEN=abc');
  await assert.rejects(admitSourceExport({input:bad,vaultRoot}),/unsupported_input_format/);
}));
