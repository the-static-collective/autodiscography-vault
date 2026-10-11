// PINCERSMASH-002: a source-side, read-only, one-asset evidence docket.
// The Vault retains its own bytes and journal. This does not claim authorship.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath, stat } from 'node:fs/promises';
import { join, isAbsolute, relative, resolve, sep } from 'node:path';
import { readJournal } from '../journal/index.js';

const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const ROLES=new Set(['audio_mp3','audio_wav','artwork','lyrics','raw_metadata','other']);
export const DOCKET_SCHEMA='static-field/week-source-evidence/v0';
const deny=message=>{ throw new Error(message); };

async function localAsset(root, sourceRelativePath) {
  if(typeof sourceRelativePath!=='string'||!sourceRelativePath||
     isAbsolute(sourceRelativePath)||sourceRelativePath.includes('\\')||
     sourceRelativePath.split('/').some(segment=>!segment||segment==='.'||segment==='..')||
     sourceRelativePath.includes(String.fromCharCode(0))) deny('unsafe asset path');
  const canonicalRoot=await realpath(root);
  const target=resolve(canonicalRoot,sourceRelativePath);
  const contained=relative(canonicalRoot,target);
  if(!contained||contained==='..'||contained.startsWith('..'+sep)||isAbsolute(contained)) deny('asset escapes Vault');
  // Refuse symlink at every component, rather than following a link into other custody.
  let current=canonicalRoot;
  for(const component of contained.split(sep)) {
    current=join(current,component);
    if((await lstat(current)).isSymbolicLink()) deny('symlink asset refused');
  }
  const canonicalTarget=await realpath(target);
  if(canonicalTarget!==target) deny('asset changed during resolution');
  if(!(await stat(target)).isFile()) deny('asset is not a regular file');
  return target;
}
async function hashFile(path) {
  const digest=createHash('sha256');
  let size=0;
  for await (const chunk of createReadStream(path)) {
    size+=chunk.length;
    if(!Number.isSafeInteger(size)) deny('oversized file');
    digest.update(chunk);
  }
  return {byteLength:size,sha256:digest.digest('hex')};
}
export async function makeWeekSourceDocket({vaultRoot,providerTrackId,assetRole='audio_wav',runId}={}) {
  if(typeof vaultRoot!=='string'||!vaultRoot||!UUID.test(providerTrackId??'')||
     !ROLES.has(assetRole)||(runId!==undefined&&(typeof runId!=='string'||!runId))) deny('invalid query');
  const entries=await readJournal(join(vaultRoot,'receipts','acquisition.jsonl'));
  const receipt=[...entries].reverse().find(entry=>
    entry.provider==='suno'&&entry.providerTrackId===providerTrackId&&
    entry.assetRole===assetRole&&(runId===undefined||entry.runId===runId));
  if(!receipt) deny('no matching acquisition receipt');
  if(receipt.state!=='verified') deny('latest matching receipt is not verified');
  if(!receipt.sourceRelativePath) deny('verified receipt lacks locally addressable bytes');
  const target=await localAsset(vaultRoot,receipt.sourceRelativePath);
  const actual=await hashFile(target);
  if(actual.byteLength!==receipt.byteLength||actual.sha256!==receipt.sha256) deny('local bytes mismatch acquisition receipt');
  return Object.freeze({
    schema:DOCKET_SCHEMA,
    provider:'suno',
    providerTrackId,
    assetRole,
    observedAt:receipt.observedAt,
    byteLength:actual.byteLength,
    sha256:actual.sha256,
    sourceReceiptSha256:createHash('sha256').update(JSON.stringify(receipt)).digest('hex'),
    sourceMethod:'vault-local-byte-verification',
    state:'VERIFIED_AT_SOURCE',
    authority:'SOURCE_CLAIM_ONLY_UNTIL_INDEPENDENT_BYTES',
  });
}
