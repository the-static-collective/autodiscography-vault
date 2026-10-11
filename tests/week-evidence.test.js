import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {appendJournalEntry} from '../packages/journal/index.js';
import {makeWeekSourceDocket,DOCKET_SCHEMA} from '../packages/week-evidence/index.js';
const song='70b1d32e-21b6-4340-990d-1a4ef67cfc42';
async function fixture({state='verified',asset='assets/song.wav',contents=Buffer.from('RIFF_SYNTHETIC_NOT_REAL_AUDIO')}={}){
 const vaultRoot=await mkdtemp(join(tmpdir(),'week-evidence-'));
 await mkdir(join(vaultRoot,'assets'));await mkdir(join(vaultRoot,'receipts'));
 const bytes=Buffer.from(contents);
 if(state==='verified'&&asset==='assets/song.wav')await writeFile(join(vaultRoot,asset),bytes);
 const receipt={schemaVersion:1,runId:'test-run',provider:'suno',
  providerTrackId:song,assetRole:'audio_wav',state,
  observedAt:'2026-10-11T20:00:00.000Z',
  sourceRelativePath:asset,
  ...(state==='verified'?{byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}:{reasonCode:'unfinished'})};
 await appendJournalEntry(join(vaultRoot,'receipts','acquisition.jsonl'),receipt);
 return {vaultRoot,receipt,bytes};
}
test('an actually present matching source yields a path-free source-only docket',async()=>{
 const {vaultRoot,receipt}=await fixture();
 const doc=await makeWeekSourceDocket({vaultRoot,providerTrackId:song});
 assert.equal(doc.schema,DOCKET_SCHEMA);
 assert.equal(doc.state,'VERIFIED_AT_SOURCE');
 assert.equal(doc.sha256,receipt.sha256);
 assert.equal(doc.authority,'SOURCE_CLAIM_ONLY_UNTIL_INDEPENDENT_BYTES');
 assert.ok(!JSON.stringify(doc).includes(vaultRoot));
 assert.ok(!JSON.stringify(doc).includes('sourceRelativePath'));
});
test('missing, rewritten, nonverified, wrong track and unsafe paths all refuse',async()=>{
 const {vaultRoot}=await fixture();
 await writeFile(join(vaultRoot,'assets','song.wav'),'rewritten');
 await assert.rejects(makeWeekSourceDocket({vaultRoot,providerTrackId:song}),/mismatch/);
 const partial=await fixture({state:'partial'});
 await assert.rejects(makeWeekSourceDocket({vaultRoot:partial.vaultRoot,providerTrackId:song}),/not verified/);
 await assert.rejects(makeWeekSourceDocket({vaultRoot,providerTrackId:'incorrect'}),/invalid query/);
 const escape=await fixture({asset:'../escape.wav'});
 await assert.rejects(makeWeekSourceDocket({vaultRoot:escape.vaultRoot,providerTrackId:song}),/unsafe asset path/);
});
test('symlinked input does not leave the Vault boundary',async()=>{
 const {vaultRoot,bytes}=await fixture();
 await symlink(join(vaultRoot,'assets','song.wav'),join(vaultRoot,'assets','alias.wav'));
 const receipt={schemaVersion:1,runId:'link-run',provider:'suno',
  providerTrackId:song,assetRole:'audio_wav',state:'verified',
  observedAt:'2026-10-11T20:00:00.000Z',sourceRelativePath:'assets/alias.wav',
  byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 await appendJournalEntry(join(vaultRoot,'receipts','acquisition.jsonl'),receipt);
 await assert.rejects(makeWeekSourceDocket({vaultRoot,providerTrackId:song}),/symlink/);
});
test('latest unsuccessful acquisition does not become a verified asset',async()=>{
 const {vaultRoot}=await fixture();
 await appendJournalEntry(join(vaultRoot,'receipts','acquisition.jsonl'),{
   schemaVersion:1,runId:'second-run',provider:'suno',providerTrackId:song,
   assetRole:'audio_wav',state:'partial',observedAt:'2026-10-11T20:01:00.000Z',
   reasonCode:'interrupted',
 });
 await assert.rejects(makeWeekSourceDocket({vaultRoot,providerTrackId:song}),/not verified/);
 assert.equal((await makeWeekSourceDocket({vaultRoot,providerTrackId:song,runId:'test-run'})).state,'VERIFIED_AT_SOURCE');
});
