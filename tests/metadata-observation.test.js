import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateObservationBundle, admitMetadataObservation } from '../scripts/admit-metadata-observation.js';

const ID='11111111-1111-4111-8111-111111111111';
const PARENT='22222222-2222-4222-8222-222222222222';
const specimen=()=>({
  schema:'autodiscography-oldest-observation/v1',provider:'suno',
  source:'authenticated-suno-ui-bounded',observedOn:'2026-10-11',
  sortOrder:'oldest-ui',partial:true,
  records:[{rank:1,providerTrackId:ID,sourceUrl:'https://suno.com/song/'+ID,
    title:'synthetic title',durationSeconds:260,model:'V5.5',ageLabel:'4mo ago',
    visibility:'unknown',kindTag:null,relation:null,evidenceSurface:'card-preview'}]
});
test('unknown ancestry stays unknown',()=>{
  assert.equal(validateObservationBundle(specimen()).records[0].relation,null);
});
test('refuse secret-shaped fields and mismatched URLs',()=>{
  assert.throws(()=>validateObservationBundle({...specimen(),cookie:'bad'}),/refused/);
  const b=specimen();b.records[0].sourceUrl='https://evil.invalid/song/'+ID;
  assert.throws(()=>validateObservationBundle(b),/noncanonical/);
});
test('reject duplicate IDs with distinct titles',()=>{
  const b=specimen();
  b.records.push({...b.records[0],rank:2,title:'different'});
  assert.throws(()=>validateObservationBundle(b),/duplicate/);
});
test('a relation requires detail-panel evidence',()=>{
  const b=specimen();
  b.records[0].relation={kind:'cover_of',targetProviderTrackId:PARENT,
    targetSourceUrl:'https://suno.com/song/'+PARENT,evidenceSurface:'card-preview'};
  assert.throws(()=>validateObservationBundle(b),/unwitnessed/);
});
test('private local admission hashes, journals, resumes and detects tampering',async()=>{
  const tmp=await mkdtemp(join(tmpdir(),'vault-meta-'));
  const input=join(tmp,'observation.json'),vaultRoot=join(tmp,'vault');
  await writeFile(input,JSON.stringify(specimen()));
  const first=await admitMetadataObservation({input,vaultRoot});
  assert.equal(first.skippedExistingVerified,false);
  assert.equal(first.receipt.recordCount,1);
  const again=await admitMetadataObservation({input,vaultRoot});
  assert.equal(again.skippedExistingVerified,true);
  assert.equal((await readFile(first.journalPath,'utf8')).trim().split('\n').length,1);
  await writeFile(first.filePath,'tampered');
  await assert.rejects(admitMetadataObservation({input,vaultRoot}),/existing bytes differ/);
});
