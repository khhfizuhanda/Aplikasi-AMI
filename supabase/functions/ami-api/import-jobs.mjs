import * as imports from './generated/import-export.mjs';
import {pool, transaction} from './database.mjs';

export async function validateImport(user, ...args) {
  const result = await imports.validateImportXlsx(pool, 'ami', user, ...args);
  const job = imports.jobs.get(result.importToken);
  imports.jobs.delete(result.importToken);
  delete job.data;
  await pool.query('DELETE FROM ami."IMPORT_JOBS" WHERE "ExpiresAt" < now()');
  await pool.query('INSERT INTO ami."IMPORT_JOBS" ("Token","UserID","Payload","ExpiresAt") VALUES ($1,$2,$3,now()+interval \'30 minutes\')', [result.importToken,user.UserID,JSON.stringify(job)]);
  return result;
}
export async function commitImport(user, token) {
  return transaction(async db => {
    const saved = (await db.query('SELECT * FROM ami."IMPORT_JOBS" WHERE "Token"=$1 AND "UserID"=$2 AND "ExpiresAt">now() FOR UPDATE',[token,user.UserID])).rows[0];
    if (!saved) throw new Error('Sesi import tidak ditemukan atau kedaluwarsa. Validasi file kembali.');
    const job = saved.Payload;
    const data = await imports.snapshot(db,'ami');
    imports.assertImportAccess(user,job.module,job.context,data);
    const checked = imports.validateRows(job.module,job.context,job.headers,job.rows,data);
    const result = {ok:true,module:job.module,context:job.context,total:job.rows.length,imported:0,updated:0,skipped:0,invalid:checked.invalid,errors:checked.errors,touchedAssignIds:[]};
    const rows = ['FORM2','FORM3'].includes(job.module) ? [checked.validRows] : checked.validRows;
    for (const row of rows) {
      const saved = await imports.applyRow(db,'ami',job.module,job.context,row,user,data);
      result[saved.mode]++;
      if (saved.assignId) result.touchedAssignIds.push(saved.assignId);
    }
    await db.query('DELETE FROM ami."IMPORT_JOBS" WHERE "Token"=$1 AND "UserID"=$2',[token,user.UserID]);
    return result;
  });
}
export async function cancelImport(user, token) {
  await pool.query('DELETE FROM ami."IMPORT_JOBS" WHERE "Token"=$1 AND "UserID"=$2',[token,user.UserID]);
  return {ok:true};
}
