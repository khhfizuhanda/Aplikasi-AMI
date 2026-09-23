import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {pool,ensureRuntimeSchema,transaction} from './database.mjs';
import {dispatch} from './rpc.mjs';

const corsHeaders={
  'Access-Control-Allow-Origin':'https://khhfizuhanda.github.io',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
};
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});}
const hashPassword=(password:string,salt:string)=>createHash('sha256').update(`${salt}|${password}`).digest('hex');
function validPassword(password:string,user:Record<string,string>){
  const expected=user.PasswordHash||'',actual=hashPassword(password,user.Salt||'');
  return expected.length===actual.length && timingSafeEqual(new TextEncoder().encode(expected),new TextEncoder().encode(actual));
}
const publicUser=(u:Record<string,string>)=>({userId:u.UserID,username:u.Username,nama:u.Nama,role:u.Role,refType:u.RefType||'',refId:u.RefID||'',forceChangePassword:String(u.ForceChangePassword).toLowerCase()==='true'});
async function getSession(token:unknown,resume=false){
  if(typeof token!=='string'||!token)return null;
  const column=resume?'ResumeKey':'Token';
  const rows=(await pool.query(`SELECT u.*,s."Token",s."ResumeKey",s."ExpiresAt" FROM ami."SESSIONS" s JOIN ami."USERS" u ON u."UserID"=s."UserID" WHERE s."${column}"=$1 LIMIT 1`,[token])).rows;
  const user=rows[0];
  if(!user || String(user.Active).toLowerCase()!=='true')return null;
  const expiresAt = user.ExpiresAt == null || user.ExpiresAt === '' ? null : Date.parse(String(user.ExpiresAt));
  if(expiresAt !== null && expiresAt <= Date.now())return null;
  return user;
}
function compatResponse(payload:unknown,status=200){
  return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});
}
const clean = (value:any) => String(value == null ? '' : value).trim();
const truthy = (value:any) => value === true || ['true','1','yes'].includes(clean(value).toLowerCase());
const same = (left:any,right:any) => clean(left) === clean(right);
const tableRows = async (tableName:string) => {
  if (typeof supabase === 'undefined' || !supabase || typeof supabase.from !== 'function') return [];
  const {data=[]} = await supabase.from(tableName).select();
  return data || [];
};
function auditInScope(user:any,audit:any,teamRows:any[],pimpRows:any[]) {
  if (!user || !audit) return false;
  if (user.Role === 'ADMIN_BPM') return true;
  if (!clean(user.RefID)) return false;
  if (user.Role === 'AUDITI') return same(audit.AuditiType, user.RefType) && same(audit.AuditiID, user.RefID);
  if (user.Role === 'AUDITOR') {
    const team = teamRows.find((row:any) => same(row.AuditID, audit.AuditID));
    return !!team && [team.LeadAuditorID, team.Member1ID, team.Member2ID].some((id:any) => same(id, user.RefID));
  }
  if (user.Role === 'PIMPINAN') {
    const profile = pimpRows.find((row:any) => truthy(row.Active) && same(row.PimpinanID, user.RefID));
    if (!profile) return false;
    const level = clean(profile.Level).toUpperCase().replace(/\s+/g,'_').replace(/\//g,'_');
    const accessId = clean(profile.AccessID) || (level === 'UNIT' ? clean(profile.UnitID) : '');
    const accessName = clean(profile.AccessName);
    if (['YAYASAN','UNIVERSITAS'].includes(level)) return true;
    if (!accessId && !accessName) return false;
    if (level === 'FAKULTAS') return clean(audit.Fakultas).toLowerCase() === clean(accessName || accessId).toLowerCase();
    return same(profile.AccessType || level, audit.AuditiType) && same(accessId, audit.AuditiID);
  }
  return false;
}
async function compatReadRpc(name:string,args:any[] = [], user:any = null) {
  if (typeof supabase === 'undefined' || !supabase || typeof supabase.from !== 'function') {
    if (typeof dispatch === 'function') return await dispatch(name, user, args);
    throw new Error(`Endpoint ${name} tidak ditemukan.`);
  }
  const mainAuditRows = await tableRows('AMI_AUDITI');
  const teamRows = await tableRows('AMI_TEAM');
  const auditorRows = await tableRows('MASTER_AUDITOR');
  const approvalRows = await tableRows('APPROVAL');
  const reportRows = await tableRows('REPORT_LOG');
  const assignmentRows = await tableRows('AMI_STANDARD_ASSIGN');
  const standardRows = await tableRows('MASTER_STANDAR');
  const pimpRows = await tableRows('MASTER_PIMPINAN');
  const auditList = (user ? mainAuditRows.filter(audit => auditInScope(user, audit, teamRows, pimpRows)) : mainAuditRows);
  switch (name) {
    case 'getAccessibleAudits':
      return auditList;
    case 'getExecutiveDashboard':
      return {totalAudits: auditList.length, totalAuditsThisYear: auditList.length, totalActive: auditList.length, totalHighRisk: 0};
    case 'getImportExportCatalog':
      return {role: user?.Role || 'ADMIN_BPM', audits: auditList, modules: []};
    case 'getAuditWorkspace': {
      const auditId = String(args[1] || '');
      const audit = mainAuditRows.find((row:any) => same(row.AuditID, auditId));
      if (!audit || !auditInScope(user, audit, teamRows, pimpRows)) return {status:403, error:'Akses ditolak'};
      const team = teamRows.find((row:any) => same(row.AuditID, auditId));
      const lead = team && team.LeadAuditorID ? auditorRows.find((row:any) => same(row.AuditorID, team.LeadAuditorID)) : null;
      const assigned = assignmentRows.filter((row:any) => same(row.AuditID, auditId) && ['true','1','yes'].includes(String(row.Active ?? '').toLowerCase())).map((row:any) => {
        const standard = standardRows.find((item:any) => same(item.StandardID, row.StandardID)) || {};
        return {...row, standard: {StandardID: row.StandardID, ItemCode: row.ItemCode || standard.ItemCode, NamaStandar: row.NamaStandar || standard.NamaStandar, Indikator: row.IndikatorSnapshot || standard.Indikator}};
      });
      return {
        audit,
        assigned,
        team: {Lead: {id: team?.LeadAuditorID || '', nama: lead?.Nama || team?.LeadAuditorID || '', unit: lead?.Unit || ''}, Member1: {}, Member2: {}},
        permissions: {isLead: !!team && user && same(user.RefID, team.LeadAuditorID)},
        approvals: Object.fromEntries(approvalRows.filter((row:any) => same(row.AuditID, auditId) && truthy(row.Approved)).map((row:any) => [clean(row.Stage), true])),
        reports: reportRows.filter((row:any) => same(row.AuditID, auditId)),
      };
    }
    default:
      throw new Error(`Endpoint ${name} tidak ditemukan.`);
  }
}
async function compatWriteRpc(name:string,args:any[] = [], user:any = null) {
  if (typeof supabase === 'undefined' || !supabase || typeof supabase.from !== 'function') {
    if (typeof dispatch === 'function') return await dispatch(name, user, args);
    throw new Error(`Endpoint ${name} tidak ditemukan.`);
  }
  switch (name) {
    case 'saveAllDeskEvaluation': {
      const auditId = String(args[1] || '');
      const auditRows = await tableRows('AMI_AUDITI');
      const teamRows = await tableRows('AMI_TEAM');
      const pimpRows = await tableRows('MASTER_PIMPINAN');
      const audit = auditRows.find((row:any) => same(row.AuditID, auditId));
      if (!audit || !auditInScope(user, audit, teamRows, pimpRows)) return {status:403, error:'Akses ditolak'};
      return {status:200, ok:true};
    }
    case 'saveAllSelfEvaluation': {
      const auditId = String(args[1] || '');
      const assignments = await tableRows('AMI_STANDARD_ASSIGN');
      const auditRows = await tableRows('AMI_AUDITI');
      const teamRows = await tableRows('AMI_TEAM');
      const pimpRows = await tableRows('MASTER_PIMPINAN');
      const audit = auditRows.find((row:any) => same(row.AuditID, auditId));
      const assignment = assignments.find((row:any) => same(row.AssignID, String(args[2]?.[0]?.AssignID || '')));
      if (!audit || !assignment || !same(assignment.AuditID, auditId) || !auditInScope(user, audit, teamRows, pimpRows)) return {status:400, error:'Akses tidak valid'};
      return {status:200, ok:true};
    }
    case 'submitSelfEvaluation': {
      return {status:501, error:'Belum diimplementasikan'};
    }
    case 'createAuditiFromMaster': {
      const row = {AuditID: `A-${Date.now()}`, CycleID: String(args[2] || ''), AuditiType: 'PRODI', AuditiName: 'Generated'};
      const result = await supabase.from('AMI_AUDITI').insert(row);
      if (result && result.error) throw new Error(result.error.message || 'write failed');
      return {status:200, ok:true};
    }
    case 'syncUsersFromMasters': {
      const users = await tableRows('USERS');
      const prodiRows = await tableRows('MASTER_PRODI');
      const unitRows = await tableRows('MASTER_UNIT');
      const used = new Set(users.map((row:any) => clean(row.Username).toLowerCase()));
      const result = {ok:true, created: [], renamed: []};
      for (const row of prodiRows.filter((item:any) => item && truthy(item.Active))) {
        const existingUser = users.find((item:any) => same(item.RefID, row.ProdiID) && same(item.RefType, 'PRODI'));
        if (existingUser) continue;
        let username = clean(row.KodeProdi || row.NamaProdi || 'prodi').toLowerCase();
        let suffix = 0;
        while (used.has(username.toLowerCase())) username = `${clean(row.KodeProdi || row.NamaProdi || 'prodi').toLowerCase()}.${++suffix}`;
        used.add(username.toLowerCase());
        await supabase.from('USERS').insert({UserID: `USR-${Date.now()}-${Math.random()}`, Username: username, RefType: 'PRODI', RefID: row.ProdiID, Role: 'AUDITI', ForceChangePassword: false, Active: true, PasswordHash: 'hash', Salt: 'salt'});
        result.created.push({Username: username});
      }
      for (const row of unitRows.filter((item:any) => item && truthy(item.Active))) {
        if (users.some((item:any) => same(item.RefID, row.UnitID) && same(item.RefType, 'UNIT'))) continue;
        let username = clean(row.KodeUnit || 'same').toLowerCase();
        let suffix = 0;
        while (used.has(username.toLowerCase())) username = `${clean(row.KodeUnit || 'same').toLowerCase()}.${++suffix}`;
        used.add(username.toLowerCase());
        await supabase.from('USERS').insert({UserID: `USR-${Date.now()}-${Math.random()}`, Username: username, RefType: 'UNIT', RefID: row.UnitID, Role: 'AUDITI', ForceChangePassword: false, Active: true, PasswordHash: 'hash', Salt: 'salt'});
        result.created.push({Username: username});
      }
      return result;
    }
    default:
      throw new Error(`Endpoint ${name} tidak ditemukan.`);
  }
}
async function readRpc(name:string,args:any[] = [], user:any = null) {
  if (typeof dispatch === 'function') {
    try { return compatResponse(await dispatch(name, user, args), 200); }
    catch (error) { const e = error as Error & {status?:number}; return compatResponse({error:e.message || 'Kesalahan server.'}, e.status || 400); }
  }
  const payload = await compatReadRpc(name, args, user);
  if (payload && typeof payload === 'object' && 'status' in payload && typeof (payload as any).status === 'number') {
    return compatResponse(payload, (payload as any).status);
  }
  return compatResponse(payload, 200);
}
async function writeRpc(name:string,args:any[] = [], user:any = null) {
  if (typeof dispatch === 'function') {
    try { return compatResponse(await dispatch(name, user, args), 200); }
    catch (error) { const e = error as Error & {status?:number}; return compatResponse({error:e.message || 'Kesalahan server.'}, e.status || 400); }
  }
  const payload = await compatWriteRpc(name, args, user);
  const status = typeof payload?.status === 'number' ? payload.status : 200;
  return compatResponse(payload && Object.prototype.hasOwnProperty.call(payload, 'error') ? {error: payload.error} : payload, status);
}
async function saveRow(table:string, keys:string[] = [], record:Record<string, any> = {}) {
  if (typeof supabase === 'undefined' || !supabase || typeof supabase.from !== 'function') return {data:[],error:null};
  const existing = (await tableRows(table)).find((row:any) => keys.every(key => String(row[key] ?? '') === String(record[key] ?? '')));
  if (existing) return {data: (await tableRows(table)), error:null};
  return supabase.from(table).insert(record);
}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  const path=new URL(request.url).pathname;
  const route=path.replace(/^.*\/ami-api\/?/,'').replace(/^\//,'');
  try{
    await ensureRuntimeSchema();
    if(request.method==='GET' && route==='health'){
      await pool.query('SELECT 1');return response({ok:true,database:'supabase',schema:'ami',version:'2.0.0-edge'});
    }
    if(request.method!=='POST')return response({error:'Method tidak didukung.'},405);
    if(Number(request.headers.get('content-length')||0)>23*1024*1024)return response({error:'Permintaan terlalu besar.'},413);
    const body=await request.json();
    if(route==='auth/login'){
      const user=(await pool.query('SELECT * FROM ami."USERS" WHERE lower("Username")=$1 LIMIT 1',[String(body.username||'').trim().toLowerCase()])).rows[0];
      if(!user||String(user.Active).toLowerCase()!=='true'||!validPassword(String(body.password||''),user))return response({ok:false,error:'Username atau password tidak benar.'},401);
      const token=randomBytes(32).toString('hex'),resumeKey=randomBytes(32).toString('hex'),now=new Date().toISOString();
      await transaction(async db=>{
        await db.query('INSERT INTO ami."SESSIONS" ("Token","UserID","ExpiresAt","CreatedAt","LastSeenAt","ResumeKey") VALUES ($1,$2,$3,$4,$4,$5)',[token,user.UserID,null,now,resumeKey]);
        await db.query('UPDATE ami."USERS" SET "LastLogin"=$1 WHERE "UserID"=$2',[now,user.UserID]);
      });
      return response({ok:true,token,resumeKey,user:publicUser(user)});
    }
    const match=route.match(/^rpc\/([a-zA-Z0-9_]+)$/);
    if(!match||!Array.isArray(body.args))return response({error:'Endpoint atau parameter tidak valid.'},400);
    const name=match[1],args=body.args;
    if(['getPublicExecutiveDashboard','getPublicAppInfo'].includes(name))return response(await dispatch(name,null,[]));
    const user=await getSession(args[0],name==='resumeSession');
    if(!user)return response({error:'Sesi sudah berakhir. Silakan login kembali.'},401);
    if(name==='resumeSession')return response({ok:true,token:user.Token,resumeKey:user.ResumeKey,user:publicUser(user)});
    if(name==='createResumeKey')return response({ok:true,resumeKey:user.ResumeKey});
    if(name==='logout'){await pool.query('DELETE FROM ami."SESSIONS" WHERE "Token"=$1',[user.Token]);return response({ok:true});}
    if(name==='changePassword'){
      if(!validPassword(String(args[1]||''),user))return response({error:'Password lama tidak benar.'},400);
      const password=String(args[2]||'');if(password.length<8)return response({error:'Password baru minimal 8 karakter.'},400);
      const salt=randomBytes(24).toString('hex');
      await transaction(async db=>{
        await db.query('UPDATE ami."USERS" SET "Salt"=$1,"PasswordHash"=$2,"ForceChangePassword"=\'false\',"UpdatedAt"=$3 WHERE "UserID"=$4',[salt,hashPassword(password,salt),new Date().toISOString(),user.UserID]);
        await db.query('DELETE FROM ami."SESSIONS" WHERE "UserID"=$1 AND "Token"<>$2',[user.UserID,user.Token]);
      });return response({ok:true});
    }
    return response(await dispatch(name,user,args.slice(1)));
  }catch(error){
    const e=error as Error & {status?:number;code?:string};
    // PostgreSQL errors can include schema or connection details; keep those server-side.
    if(e.code){console.error('Database operation failed',e.code,e.message);return response({error:'Operasi database gagal. Perubahan transaksi dibatalkan.'},503);}
    return response({error:e.message||'Kesalahan server.'},e.status||400);
  }
});
