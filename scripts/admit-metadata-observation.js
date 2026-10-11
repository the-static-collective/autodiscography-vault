/**
 * Local-only authenticated UI metadata observation admission.
 * Does NOT acquire Suno audio or grant full-corpus acquisition authority.
 */
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const SECRET=/authorization|cookie|token|session|password|secret|credential|api[_-]?key|lyrics|prompt|transportUrl|audioBytes/i;
const DANGER=/\bBearer\s+\S+|[?&](?:token|auth|session|key)=|\b(?:authorization|cookie|session|password|secret)\s*[:=]/i;
const TOP=new Set(['schema','provider','source','observedOn','sortOrder','partial','records']);
const FIELDS=new Set(['rank','providerTrackId','sourceUrl','title','durationSeconds','model','ageLabel','visibility','kindTag','relation','evidenceSurface']);
const REL=new Set(['kind','targetProviderTrackId','targetSourceUrl','evidenceSurface']);
function refuse(message){throw new Error('metadata observation refused: '+message);}
function hash(buf){return createHash('sha256').update(buf).digest('hex');}
function exact(obj,fields){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))refuse('expected object');
  for(const key of Object.keys(obj))if(SECRET.test(key)||!fields.has(key))refuse('unsupported or private field');
}
function word(s,max){if(typeof s!=='string'||!s||s.length>max||DANGER.test(s))refuse('unsafe string');}
function id(s){if(typeof s!=='string'||!UUID.test(s))refuse('bad provider ID');}
function url(uid,uri){if(uri!=='https://suno.com/song/'+uid)refuse('noncanonical URL');}
export function validateObservationBundle(b){
  exact(b,TOP);
  if(b.schema!=='autodiscography-oldest-observation/v1'||b.provider!=='suno'||
     b.source!=='authenticated-suno-ui-bounded'||b.sortOrder!=='oldest-ui'||b.partial!==true)refuse('unproven completeness or source');
  const date=b.observedOn;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
     Number.isNaN(Date.parse(date+'T00:00:00Z'))||
     new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)refuse('bad observed date');
  if(!Array.isArray(b.records)||b.records.length<1||b.records.length>25000)refuse('record count');
  const seen=new Set();let rank=0;
  for(const r of b.records){
    exact(r,FIELDS);
    if(!Number.isSafeInteger(r.rank)||r.rank<=rank)refuse('rank order');
    rank=r.rank;id(r.providerTrackId);url(r.providerTrackId,r.sourceUrl);
    if(seen.has(r.providerTrackId))refuse('duplicate ID');
    seen.add(r.providerTrackId);word(r.title,512);word(r.model,64);
    if(!Number.isSafeInteger(r.durationSeconds)||r.durationSeconds<1||r.durationSeconds>86400)refuse('duration');
    if(r.ageLabel!==null)word(r.ageLabel,80);
    if(!['published','unpublished','unknown'].includes(r.visibility))refuse('visibility');
    if(![null,'cover','extend','remix'].includes(r.kindTag))refuse('type');
    if(!['card-preview','detail-panel'].includes(r.evidenceSurface))refuse('surface');
    // v1 observations keep claims separate from verified genealogy. Even a
    // "detail-panel" string from an AI collector is not an authenticated link.
    // Admit the observed track as relation:null and audit any reported edge
    // separately through lineage-audit; never promote an agent report here.
    if(r.relation!==null){
      refuse('lineage claim is not a verified relation: preserve separately and audit');
    }
  }
  return b;
}
async function verified(path,digest,length){
  let bytes;try{bytes=await readFile(path);}catch(e){if(e.code==='ENOENT')return false;throw e;}
  if(bytes.length!==length||hash(bytes)!==digest)refuse('existing bytes differ');
  return true;
}
export async function admitMetadataObservation({input,vaultRoot}){
  if(typeof input!=='string'||typeof vaultRoot!=='string'||!input||!vaultRoot)refuse('local paths required');
  const root=resolve(vaultRoot);
  if(root===dirname(root))refuse('root path invalid');
  const raw=await readFile(resolve(input));
  if(raw.length>50000000)refuse('oversized file');
  let b;try{b=JSON.parse(raw.toString('utf8'));}catch{refuse('invalid JSON');}
  validateObservationBundle(b);
  const digest=hash(raw);
  const rel=join('observations','suno',digest+'.json');
  const destination=join(root,rel);
  const journalPath=join(root,'receipts','metadata-observations.jsonl');
  await mkdir(dirname(destination),{recursive:true,mode:0o700});
  await mkdir(dirname(journalPath),{recursive:true,mode:0o700});
  const lockPath=journalPath+'.lock';
  let lock;try{lock=await open(lockPath,'wx',0o600);}
  catch(e){if(e.code==='EEXIST')refuse('concurrent admission or stale lock');throw e;}
  try{
    let history='';try{history=await readFile(journalPath,'utf8');}
    catch(e){if(e.code!=='ENOENT')throw e;}
    if(history&&!history.endsWith('\n'))refuse('truncated journal');
    let existing=null;
    for(const line of history.split('\n')){
      if(!line)continue;
      let entry;try{entry=JSON.parse(line);}catch{refuse('invalid journal');}
      if(entry.sha256===digest)existing=entry;
    }
    if(existing){
      if(existing.byteLength!==raw.length||!await verified(destination,digest,raw.length))refuse('previous admission missing');
      return {skippedExistingVerified:true,filePath:destination,journalPath,receipt:existing};
    }
    if(!await verified(destination,digest,raw.length)){
      const partial=destination+'.partial';
      const file=await open(partial,'wx',0o600);
      try{await file.writeFile(raw);await file.sync();}finally{await file.close();}
      await rename(partial,destination);
      await verified(destination,digest,raw.length);
    }
    const receipt={schema:'autodiscography-metadata-admission/v1',provider:'suno',
      status:'verified_metadata_bytes_only',sha256:digest,byteLength:raw.length,
      relativePath:rel.replaceAll('\\','/'),observedOn:b.observedOn,
      admittedAt:new Date().toISOString(),recordCount:b.records.length,
      partial:true,sortOrder:'oldest-ui'};
    const journal=await open(journalPath,'a',0o600);
    try{await journal.writeFile(JSON.stringify(receipt)+'\n');await journal.sync();}
    finally{await journal.close();}
    await verified(destination,digest,raw.length);
    return {skippedExistingVerified:false,filePath:destination,journalPath,receipt};
  }finally{await lock.close();await unlink(lockPath);}
}
function args(argv){
  if(argv.length!==4)refuse('use --input <local.json> --vault-root <private path>');
  const out={};for(let i=0;i<4;i+=2){
    if(!['--input','--vault-root'].includes(argv[i]))refuse('invalid argument');
    out[argv[i]==='--input'?'input':'vaultRoot']=argv[i+1];
  }return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.stdout.write(JSON.stringify(await admitMetadataObservation(args(process.argv.slice(2))),null,2)+'\n');}
  catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}
