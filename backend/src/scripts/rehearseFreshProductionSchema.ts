import { constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BackupError, privateCommandBytes } from './productionBackupCore.js';
import { RECONCILIATION_FILES, sha256, verifyCandidateFiles } from './productionReconciliation.js';
import { createReferenceDataPlan, parseReferencePlanArguments } from './productionReferenceData.js';

const sshArgs=['-4','-F','/dev/null','-i','/Users/memberid/.ssh/id_ed25519','-o','IdentitiesOnly=yes',
  '-o','PreferredAuthentications=publickey','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ConnectTimeout=10','ubuntu@43.157.242.8'];
async function ssh(command:string,input:string|Buffer='',timeout=30000):Promise<string> {
  return (await privateCommandBytes('/usr/bin/ssh',[...sshArgs,command],input,timeout,4*1024*1024)).toString('utf8');
}
export function parseFreshRehearsalOptions(args: readonly string[]): { referenceMode: boolean; amount: number | null; evidenceFile: string } {
  if (args.length === 1 && args[0] === 'rehearse-fresh') {
    return { referenceMode: false, amount: null, evidenceFile: 'production-reconciliation.fresh-rehearsal.json' };
  }
  if (args[0] === 'rehearse-reference') {
    const amount = parseReferencePlanArguments(['plan', ...args.slice(1)]);
    if (amount !== null) return { referenceMode: true, amount, evidenceFile: 'production-reference-data.rehearsal.json' };
  }
  throw new BackupError('EXPLICIT_ISOLATED_REHEARSAL_MODE_REQUIRED');
}
async function main():Promise<void> {
  const {referenceMode,amount,evidenceFile}=parseFreshRehearsalOptions(process.argv.slice(2));
  if(process.platform!=='darwin') throw new BackupError('MAC_ISOLATED_FRESH_MODE_REQUIRED');
  process.umask(0o077);
  const repository=resolve(__dirname,'../../..');
  const candidate=await verifyCandidateFiles(repository);
  const reference=referenceMode ? createReferenceDataPlan(candidate.snapshot,candidate.fingerprint,amount) : undefined;
  const evidencePath=resolve(repository,'ops',evidenceFile);
  // Refuse before allocating any VPS resources. Never silently overwrite prior evidence.
  try { await lstat(evidencePath); throw new BackupError('REHEARSAL_EVIDENCE_ALREADY_EXISTS'); }
  catch(error:unknown) { if(!(typeof error==='object' && error!==null && 'code' in error && error.code==='ENOENT')) throw error; }
  const bundle=(await ssh('umask 077; mktemp -d /tmp/sinegasi-schema-rehearsal.XXXXXXXX')).trim();
  if(!/^\/tmp\/sinegasi-schema-rehearsal\.[A-Za-z0-9]+$/.test(bundle)) throw new BackupError('INVALID_REMOTE_BUNDLE');
  const command=(action:string)=>`bash '${bundle}/rehearse-schema-reconciliation-vps.sh' '${action}' '${bundle}'`;
  let prepared=false;
  let evidence: Record<string,unknown>|undefined;
  try {
    const files=[...['productionBackupCore.js','verifyBackupRestore.js','productionReconciliation.js','verifyProductionReconciliation.js']
      .map(file=>[file,repository+'/backend/dist/scripts/'+file]),
      ['production-schema.snapshot.json',repository+'/ops/production-schema.snapshot.json'],
      ...RECONCILIATION_FILES.map(file=>[file,repository+'/supabase/migrations/'+file]),
      ['rehearse-schema-reconciliation-vps.sh',repository+'/ops/rehearse-schema-reconciliation-vps.sh']];
    if(referenceMode) {
      await ssh(`umask 077; mkdir '${bundle}/scripts' '${bundle}/middleware' '${bundle}/services'`);
      for(const file of ['scripts/productionReferenceData.js','scripts/verifyProductionReferenceData.js',
        'scripts/productionBackupCore.js','scripts/productionReconciliation.js','scripts/bootstrapTeacherCore.js',
        'middleware/capabilities.js','services/passwordService.js']) files.push([file,repository+'/backend/dist/'+file]);
    }
    for(const [file,path] of files) {
      const bytes=await readFile(path);
      await ssh(`umask 077; test ! -e '${bundle}/${file}' && dd of='${bundle}/${file}' status=none`,bytes);
      if((await ssh(`sha256sum '${bundle}/${file}'`)).split(' ')[0]!==sha256(bytes)) throw new BackupError('REMOTE_SCRIPT_HASH_MISMATCH');
    }
    prepared=true;
    await ssh(command('prepare'),'',60000);
    console.log(JSON.stringify({stage:'ISOLATED_FRESH_DB_PREPARED',bundle,credentialsUsed:false}));
    await ssh(command('scaffold'),'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;');
    const result=JSON.parse(await ssh(command('fresh'),'',130000)) as {status:string;packageSha256:string;stage?:string;check?:string};
    if(result.status!=='RECONCILIATION_FRESH_REHEARSAL_PASSED' || result.packageSha256!==candidate.fingerprint) {
      console.log(JSON.stringify(result)); throw new BackupError('FRESH_SCHEMA_CHECK_FAILED');
    }
    if(reference) {
      const checked=JSON.parse(await ssh(command('reference'),String(amount),130000)) as {status:string;schemaPackageSha256:string;referenceChecksum:string};
      if(checked.status!=='REFERENCE_DATA_REHEARSAL_PASSED' || checked.schemaPackageSha256!==candidate.fingerprint
        || checked.referenceChecksum!==reference.checksum) throw new BackupError('REFERENCE_DATA_CHECK_FAILED');
      evidence={...checked,schemaChecks:result,verifiedAt:new Date().toISOString(),cleanupVerified:false};
    } else evidence={...result,verifiedAt:new Date().toISOString(),cleanupVerified:false};
  } finally {
    if(prepared) {
      try { await ssh(command('cleanup')); console.log(JSON.stringify({stage:'DISPOSABLE_REMOVED',devCaddyUnchanged:true})); }
      catch { console.error(JSON.stringify({status:'DISPOSABLE_CLEANUP_REQUIRED',bundle})); throw new BackupError('CLEANUP_NOT_VERIFIED'); }
    }
  }
  if(!evidence) throw new BackupError('FRESH_SCHEMA_NOT_VERIFIED');
  evidence.cleanupVerified=true;
  const handle=await open(evidencePath,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try { await handle.writeFile(JSON.stringify(evidence,null,2)+'\n'); await handle.sync(); } finally { await handle.close(); }
  console.log(JSON.stringify({...evidence,evidencePath}));
}
if (require.main === module) void main().catch((error:unknown)=>{
  console.error(JSON.stringify({status:'STOP',stage:error instanceof BackupError ? error.stage : 'FRESH_REHEARSAL_FAILED',productionChanged:false}));process.exitCode=1;
});
