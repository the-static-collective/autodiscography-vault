// Operator-triggered only; emits a path-free, non-authoritative evidence docket.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeWeekSourceDocket} from '../packages/week-evidence/index.js';

export function parseArgs(argv){
 const args={};
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(!['--vault-root','--track-id','--asset-role','--run-id'].includes(key)||
     value===undefined||Object.hasOwn(args,key))throw new Error('invalid arguments');
  args[key]=value;
 }
 if(!args['--vault-root']||!args['--track-id'])throw new Error('vault root and track ID required');
 return {vaultRoot:args['--vault-root'],providerTrackId:args['--track-id'],
   ...(args['--asset-role']?{assetRole:args['--asset-role']}:{ }),
   ...(args['--run-id']?{runId:args['--run-id']}:{ })};
}
const isCli=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCli){
 try {process.stdout.write(JSON.stringify(await makeWeekSourceDocket(parseArgs(process.argv.slice(2))),null,2)+'\n');}
 catch(error){process.stderr.write('Week evidence refused: '+error.message+'\n');process.exitCode=1;}
}
