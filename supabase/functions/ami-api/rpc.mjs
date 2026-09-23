import * as read from './generated/read.mjs';
import * as admin from './generated/admin.mjs';
import * as workflow from './generated/workflow.mjs';
import * as system from './generated/system.mjs';
import {readDashboard} from './generated/dashboard.mjs';
import {exportXlsxModule} from './generated/import-export.mjs';
import * as files from './files.mjs';
import {validateImport,commitImport,cancelImport} from './import-jobs.mjs';
import {pool,transaction} from './database.mjs';

export const methods = Object.create(null);
for (const [service,names] of [
  [read,['listStandardsAdmin','listStandards','getStandardVersions','listUsers','listCycles','listCycleAudits','getAccessibleAudits','getAuditWorkspace']],
  [admin,['saveCycle','setActiveCycle','saveMaster','bulkImportMaster','saveStandard','createStandardVersion','deleteStandardDraft','bulkImportStandards','createAuditiFromMaster','assignStandards','reopenAuditAssignment','resetUserPassword','resetUserPasswordsBulk','syncUsersFromMasters','saveAuditTeamsBatch','saveTeamsAndPublishBatch']],
  [workflow,['saveAllSelfEvaluation','saveEvidenceLinksBatch','saveAllDeskEvaluation','saveAllVisitForms','saveAllFindings','saveAllAuditiFollowUps','returnSelfEvaluation','approveAudit','returnAuditRevision','getAuditValidation','submitSelfEvaluation','finishDeskEvaluation','submitAuditResult']],
  [system,['getDatabaseHealth','getLaunchReadiness','getRecentSystemErrors','runSystemSelfTest','getResetAuditPreview','getResetAllTestDataPreview','upgradeSchemaFinal','previewOfficialStandardCodeMigration','applyOfficialStandardCodeMigration']],
]) for(const name of names) methods[name]=(user,...args)=>service[name](pool,'ami',user,...args);
for(const name of ['getBootstrap','getExecutiveDashboard','getImportExportCatalog','getPublicExecutiveDashboard','getPublicAppInfo'])methods[name]=(user)=>readDashboard(pool,'ami',name,user);
for(const name of ['uploadEvidence','downloadEvidenceFile','getAmiReportPreview','generateAmiFinalReport','listReports','downloadReportFile'])methods[name]=files[name];
methods.exportXlsxModule=(user,...args)=>exportXlsxModule(pool,'ami',user,...args);
methods.validateImportXlsx=validateImport;
methods.commitImportXlsx=commitImport;
methods.cancelImportXlsx=cancelImport;
methods.listMaster=async(user,type)=>{
  admin.requireAdmin(user);
  const tables={PRODI:'MASTER_PRODI',UNIT:'MASTER_UNIT',AUDITOR:'MASTER_AUDITOR',PIMPINAN:'MASTER_PIMPINAN'};
  const table=tables[String(type).toUpperCase().replace(/^MASTER_/,'')];
  if(!table)throw new Error('Jenis master tidak dikenali.');
  return (await pool.query(`SELECT * FROM ami."${table}"`)).rows;
};
methods.deleteEvidence=(user,id)=>transaction(async db=>{
  const evidence=(await db.query('SELECT * FROM ami."EVIDENCE" WHERE "EvidenceID"=$1',[id])).rows[0];
  const result=await workflow.deleteEvidence(db,'ami',user,id);
  if(evidence?.DriveFileID)await db.query('DELETE FROM ami."FILE_STORE" WHERE "FileID"=$1 AND "AuditID"=$2',[evidence.DriveFileID,evidence.AuditID]);
  return result;
});
methods.resetAuditForRetest=(user,id,confirmation)=>transaction(async db=>{
  const result=await system.resetAuditForRetest(db,'ami',user,id,confirmation);
  await db.query('DELETE FROM ami."FILE_STORE" WHERE "AuditID"=$1',[id]);
  return result;
});
methods.resetAllTestData=(user,confirmation)=>transaction(async db=>{
  const result=await system.resetAllTestData(db,'ami',user,confirmation);
  await db.query('DELETE FROM ami."FILE_STORE"');
  await db.query('DELETE FROM ami."IMPORT_JOBS"');
  return result;
});
methods.reportClientError=async(user,name,message,context)=>{
  await pool.query('INSERT INTO ami."SYSTEM_ERROR_LOG" ("ErrorID","Timestamp","UserID","Username","Role","FunctionName","Message","Stack","ContextJSON") VALUES ($1,$2,$3,$4,$5,$6,$7,\'\',$8)',[crypto.randomUUID(),new Date().toISOString(),user.UserID,user.Username,user.Role,String(name||'client').slice(0,120),String(message||'').slice(0,2000),JSON.stringify(context||{}).slice(0,8000)]);
  return {ok:true};
};
export async function dispatch(name,user,args=[]) {
  if(!Object.hasOwn(methods,name))throw Object.assign(new Error(`Endpoint ${name} tidak ditemukan.`),{status:404});
  return methods[name](user,...args);
}
