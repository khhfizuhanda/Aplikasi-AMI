// Generated read-only Apps Script adapter.
export async function readDashboard(pool, schema, method, user) {
  const names = ['SETTINGS','AMI_CYCLE','AMI_AUDITI','AMI_TEAM','AMI_STANDARD_ASSIGN','SELF_EVAL','DESK_EVAL','FINDINGS','REPORT_LOG','MASTER_STANDAR','MASTER_PRODI','MASTER_UNIT','MASTER_AUDITOR','MASTER_PIMPINAN'];
  const results = await Promise.all(names.map(name => pool.query('SELECT * FROM "ami"."' + name + '"')));
  const data = Object.fromEntries(names.map((name, i) => [name, results[i].rows]));
  const cleanText_ = value => String(value ?? '').trim();
  const normalizeUsername_ = value => cleanText_(value).toLowerCase();
  const getAllRows_ = name => data[name] || [];
  const getSetting_ = (key, fallback) => (data.SETTINGS.find(row => row.Key === key) || {}).Value || fallback;
  const findOne_ = (name, key, value) => getAllRows_(name).find(row => row[key] === value);
  const bool_ = value => value === true || ['true','1','yes'].includes(cleanText_(value).toLowerCase());
  const cleanRow_ = row => ({...row});
  const serializeValue_ = value => JSON.parse(JSON.stringify(value));
  const now_ = () => new Date().toISOString();
  const session_ = () => user;
  const publicUser_ = row => ({userId:row.UserID,username:row.Username,nama:row.Nama,role:row.Role,refType:row.RefType || '',refId:row.RefID || '',forceChangePassword:bool_(row.ForceChangePassword)});
  const CacheService = {getScriptCache: () => ({get: () => null, put: () => {}})};
  /**
 * Config.gs — AMI UMA 2026 FINAL OPTIMIZED
 * Satu konfigurasi aktif untuk seluruh project.
 */
const AMI_CONFIG = Object.freeze({
  VERSION: '1.6.2-user-password-bulk-v28',
  APP_NAME: 'Sistem Audit Mutu Internal (AMI) 2026',
  ORG_NAME: 'Universitas Medan Area',
  UNIT_NAME: 'Biro Penjaminan Mutu',
  TIMEZONE: 'Asia/Jakarta',
  SESSION_HOURS: 12,
  SESSION_SLIDING_MINUTES: 20,
  MAX_UPLOAD_BYTES: 8 * 1024 * 1024,
  PUBLIC_DASHBOARD_ENABLED: true,
  PUBLIC_SHOW_AUDITI_NAMES: true,
  PUBLIC_DASHBOARD_CACHE_SECONDS: 90,
  REQUIRE_EVIDENCE_PER_ITEM: true,
  EXPECTED_STANDARD_SEED_COUNT: 130,
  DB_SPREADSHEET_ID: '1wyEhGjB3LJxUrJN4LxovfBBkypzMRMNLXxRUgK4A-KI',
  DEFAULT_ADMIN_USERNAME: 'admin',
  DEFAULT_ADMIN_PASSWORD: 'admin123',
  DEFAULT_USER_PASSWORD: 'ami2026!',
  ROLES: ['ADMIN_BPM', 'AUDITOR', 'AUDITI', 'PIMPINAN'],
  PIMPINAN_LEVELS: ['YAYASAN', 'UNIVERSITAS', 'FAKULTAS', 'PRODI', 'UNIT'],
  UNIT_TYPES: ['BIRO', 'LEMBAGA', 'UPT', 'PUSAT', 'DIREKTORAT', 'FAKULTAS', 'PASCASARJANA', 'UNIT LAINNYA'],
  AUDITOR_CERTIFICATION: ['IYA', 'TIDAK'],
  STANDARD_STATUSES: ['DRAFT', 'BERLAKU', 'DICABUT', 'ARSIP'],
  CAPAIAN: ['MENYIMPANG', 'BELUM MENCAPAI', 'MENCAPAI', 'MELAMPAUI'],
  DESK_STATUSES: ['SESUAI', 'PERLU KLARIFIKASI', 'BUKTI BELUM CUKUP', 'PERLU VERIFIKASI LAPANGAN', 'INDIKASI TEMUAN'],
  AUDIT_STATUSES: [
    'DRAFT BPM', 'PENUGASAN DITERBITKAN', 'EVALUASI DIRI BERJALAN',
    'EVALUASI DIRI DIKIRIM', 'PERLU REVISI AUDITI', 'DESK EVALUATION',
    'SIAP VISITASI', 'VISITASI BERJALAN', 'HASIL AUDIT DIISI',
    'MENUNGGU ACC AUDITI', 'MENUNGGU ACC LEAD', 'MENUNGGU ACC BPM',
    'PERLU REVISI AUDITOR', 'FINAL'
  ]
});

const SHEET_DEFS = Object.freeze({
  SETTINGS: ['Key','Value','Description','UpdatedAt','UpdatedBy'],
  SOURCE_REGISTER: ['SourceID','Kelompok','NamaFile','Tahun','JumlahButir','CatatanVerifikasi'],
  MASTER_STANDAR: ['StandardID','ItemCode','Kelompok','KodeKelompokStandar','NamaStandar','NoSumber','PernyataanStandar','StrategiPencapaian','Indikator','SumberFile','TahunSumber','HalamanPDFMulai','HalamanPDFAkhir','SourceHash','Active','CreatedAt','UpdatedAt','StandardFamilyID','Versi','TahunBerlakuMulai','TahunBerlakuSampai','StatusStandar','ReplacesStandardID','Origin','Locked','Notes','CreatedBy','UpdatedBy'],
  MASTER_PRODI: ['ProdiID','KodeProdi','NamaProdi','Fakultas','Jenjang','Kaprodi','NIDN','Active','CreatedAt','UpdatedAt'],
  MASTER_UNIT: ['UnitID','KodeUnit','NamaUnit','JenisUnit','Pimpinan','Active','CreatedAt','UpdatedAt'],
  MASTER_AUDITOR: ['AuditorID','NIDN_NIK','Nama','Unit','Sertifikasi','Active','CreatedAt','UpdatedAt'],
  MASTER_PIMPINAN: ['PimpinanID','Nama','Jabatan','Level','Active','CreatedAt','UpdatedAt','UnitID','AccessType','AccessID','AccessName'],
  USERS: ['UserID','Username','PasswordHash','Salt','Nama','Role','RefType','RefID','Active','ForceChangePassword','LastLogin','CreatedAt','UpdatedAt'],
  SESSIONS: ['Token','UserID','ExpiresAt','CreatedAt','LastSeenAt','ResumeKey'],
  AMI_CYCLE: ['CycleID','NamaSiklus','Tahun','TahunAkademik','TanggalMulai','BatasEvaluasiDiri','DeskStart','DeskEnd','VisitStart','VisitEnd','Status','Active','CreatedAt','CreatedBy'],
  AMI_AUDITI: ['AuditID','CycleID','AuditiType','AuditiID','AuditiName','Fakultas','Jenjang','Status','PublishedAt','CreatedAt','CreatedBy'],
  AMI_STANDARD_ASSIGN: ['AssignID','AuditID','StandardID','ItemCode','NamaStandar','AssignedAt','AssignedBy','Active','KelompokSnapshot','KodeKelompokSnapshot','PernyataanStandarSnapshot','StrategiSnapshot','IndikatorSnapshot','SumberFileSnapshot','TahunSumberSnapshot','SourceHashSnapshot','VersiStandarSnapshot','TahunBerlakuSnapshot'],
  AMI_TEAM: ['TeamID','AuditID','LeadAuditorID','Member1ID','Member2ID','AssignedAt','AssignedBy','UpdatedAt'],
  SELF_EVAL: ['SelfEvalID','AuditID','AssignID','StandardID','Capaian','NilaiCapaian','EvaluasiDiri','Akibat','AkarPenyebab','Status','BuktiCount','SavedAt','SubmittedAt','SubmittedBy'],
  SELF_FOLLOW_UP: ['FollowUpID','AuditID','AssignID','StandardID','SelfEvalID','CapaianAwal','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','Status','SavedAt','SavedBy','UpdatedAt'],
  EVIDENCE: ['EvidenceID','SelfEvalID','AuditID','StandardID','NamaBukti','JenisBukti','URL','DriveFileID','Keterangan','ClientKey','FileSize','UploadedAt','UploadedBy'],
  DESK_EVAL: ['DeskID','AuditID','AssignID','StandardID','StatusDesk','CatatanDesk','ButuhVisitasi','AuditorID','UpdatedAt'],
  VISIT: ['VisitID','AuditID','Tanggal','JamMulai','JamSelesai','Lokasi','WakilAuditi','CatatanUmum','Status','UpdatedAt'],
  FORM2_PROGRAM_KERJA: ['Form2ID','AuditID','TentatifAuditObjektif','TujuanAudit','LangkahJSON','UpdatedAt','UpdatedBy'],
  FORM3_CATATAN: ['Form3ID','AuditID','CatatanJSON','UpdatedAt','UpdatedBy'],
  FINDINGS: ['FindingID','AuditID','AssignID','StandardID','Kategori','Deskripsi','Kriteria','Akibat','AkarPenyebab','Rekomendasi','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','CreatedAt','CreatedBy','UpdatedAt','UpdatedBy'],
  AMI_IMPROVEMENT: ['ImprovementID','AuditID','AssignID','StandardID','SelfEvalID','CapaianAwal','KategoriFinal','FaktorPendukung','RekomendasiPeningkatanIndikator','Status','SavedAt','SavedBy','UpdatedAt','UpdatedBy'],
  APPROVAL: ['ApprovalID','AuditID','Stage','Approved','ApprovedByUserID','ApprovedByNama','ApprovedByRole','ApprovedAt','VersionHash','Note'],
  REPORT_LOG: ['ReportID','AuditID','Version','Status','GoogleDocID','DocxFileID','PdfFileID','ValidationHash','DocxBytes','PdfBytes','CreatedAt','CreatedBy'],
  AUDIT_LOG: ['LogID','Timestamp','UserID','Nama','Role','Action','Module','AuditID','RecordID','BeforeJSON','AfterJSON'],
  SYSTEM_ERROR_LOG: ['ErrorID','Timestamp','UserID','Username','Role','FunctionName','Message','Stack','ContextJSON']
});

function getBootstrap(token){
  const u=session_(token),warnings=[];
  let app={appName:AMI_CONFIG.APP_NAME,orgName:AMI_CONFIG.ORG_NAME,unitName:AMI_CONFIG.UNIT_NAME,version:AMI_CONFIG.VERSION};
  let dashboard={activeCycleId:'',totalAudits:0,finalAudits:0,averageProgress:0,standardCount:0,prodiCount:0,auditorCount:0,statusCounts:{},findingCounts:{MENYIMPANG:0,'BELUM MENCAPAI':0,MENCAPAI:0,MELAMPAUI:0},resultTotal:0,fulfilledTotal:0,overallFulfillmentPct:0,auditRows:[],prodiResults:[],standardPerformance:[],reports:0};
  let selections={cycles:[],prodi:[],unit:[],auditors:[],pimpinan:[]};
  try{app=getPublicAppInfo();}catch(e){warnings.push('Info aplikasi: '+(e&&e.message?e.message:e));}
  try{dashboard=getDashboardData_(u);}catch(e){warnings.push('Dashboard: '+(e&&e.message?e.message:e));}
  try{selections=getSelections_(u);}catch(e){warnings.push('Data pilihan/master: '+(e&&e.message?e.message:e));}
  return serializeValue_({user:publicUser_(u),app:app,dashboard:dashboard,selections:selections,warnings:warnings,bootstrapOk:warnings.length===0});
}
function getSelections_(u){const out={cycles:getAllRows_('AMI_CYCLE').map(cleanRow_)};if(cleanText_(u.Role)==='ADMIN_BPM'){out.prodi=getAllRows_('MASTER_PRODI').filter(r=>bool_(r.Active)).map(cleanRow_);out.unit=getAllRows_('MASTER_UNIT').filter(r=>bool_(r.Active)).map(cleanRow_);out.auditors=getAllRows_('MASTER_AUDITOR').filter(r=>bool_(r.Active)).map(cleanRow_);out.pimpinan=getAllRows_('MASTER_PIMPINAN').filter(r=>bool_(r.Active)).map(cleanRow_);}return out;}

function normalizePimpinanLevel_(v){
  const x=cleanText_(v).toUpperCase().replace(/\s+/g,'_').replace(/\//g,'_');
  const map={'YAYASAN':'YAYASAN','UNIVERSITAS':'UNIVERSITAS','FAKULTAS':'FAKULTAS','PRODI':'PRODI','PROGRAM_STUDI':'PRODI','UNIT':'UNIT','UNIT_BIRO':'UNIT','BIRO':'UNIT'};
  return map[x]||'';
}
function getPimpinanProfile_(u){
  if(!u||cleanText_(u.Role)!=='PIMPINAN')return null;
  const p=findOne_('MASTER_PIMPINAN','PimpinanID',u.RefID);if(!p||!bool_(p.Active))return null;
  const level=normalizePimpinanLevel_(p.Level);
  let accessType=cleanText_(p.AccessType)||level,accessId=cleanText_(p.AccessID),accessName=cleanText_(p.AccessName);
  // Migrasi kompatibel data lama: UnitID lama tetap dibaca untuk level UNIT.
  if(level==='UNIT'&&!accessId&&cleanText_(p.UnitID)){accessId=cleanText_(p.UnitID);const x=findOne_('MASTER_UNIT','UnitID',accessId);accessName=accessName||(x?cleanText_(x.NamaUnit):'');accessType='UNIT';}
  if(level==='PRODI'&&accessId&&!accessName){const x=findOne_('MASTER_PRODI','ProdiID',accessId);accessName=x?cleanText_(x.NamaProdi):'';}
  return Object.assign(cleanRow_(p),{Level:level,AccessType:accessType,AccessID:accessId,AccessName:accessName});
}
function normalizePimpinanRecord_(rec){
  rec=Object.assign({},rec||{});const level=normalizePimpinanLevel_(rec.Level);
  if(!level||AMI_CONFIG.PIMPINAN_LEVELS.indexOf(level)<0)throw new Error('Level pimpinan tidak valid. Pilih Yayasan, Universitas, Fakultas, Program Studi, atau Unit/Biro.');
  let accessId=cleanText_(rec.AccessID),accessName=cleanText_(rec.AccessName),accessType=level;
  if(level==='YAYASAN'||level==='UNIVERSITAS'){accessId='';accessName='';accessType=level;}
  else if(level==='PRODI'){
    const rows=getAllRows_('MASTER_PRODI').filter(r=>bool_(r.Active));
    const hit=rows.find(r=>cleanText_(r.ProdiID)===accessId||cleanText_(r.KodeProdi)===accessId||normalizeUsername_(r.NamaProdi)===normalizeUsername_(accessName||accessId));
    if(!hit)throw new Error('Pilih Program Studi pada Area Akses.');
    accessId=cleanText_(hit.ProdiID);accessName=cleanText_(hit.NamaProdi);accessType='PRODI';
  }else if(level==='UNIT'){
    const rows=getAllRows_('MASTER_UNIT').filter(r=>bool_(r.Active));
    const hit=rows.find(r=>cleanText_(r.UnitID)===accessId||cleanText_(r.KodeUnit)===accessId||normalizeUsername_(r.NamaUnit)===normalizeUsername_(accessName||accessId));
    if(!hit)throw new Error('Pilih Unit/Biro pada Area Akses.');
    accessId=cleanText_(hit.UnitID);accessName=cleanText_(hit.NamaUnit);accessType='UNIT';
  }else if(level==='FAKULTAS'){
    const faculties=[...new Set(getAllRows_('MASTER_PRODI').filter(r=>bool_(r.Active)&&cleanText_(r.Fakultas)).map(r=>cleanText_(r.Fakultas)))];
    const target=accessName||accessId,hit=faculties.find(x=>normalizeUsername_(x)===normalizeUsername_(target));
    if(!hit)throw new Error('Pilih Fakultas pada Area Akses.');
    accessId=hit;accessName=hit;accessType='FAKULTAS';
  }
  rec.Level=level;rec.AccessType=accessType;rec.AccessID=accessId;rec.AccessName=accessName;rec.UnitID=level==='UNIT'?accessId:'';
  return rec;
}
function isAuditInPimpinanScope_(u,audit){
  if(cleanText_(u.Role)!=='PIMPINAN')return false;
  const p=getPimpinanProfile_(u);if(!p)return false;
  if(p.Level==='YAYASAN'||p.Level==='UNIVERSITAS')return true;
  if(p.Level==='FAKULTAS')return normalizeUsername_(audit.Fakultas)===normalizeUsername_(p.AccessName||p.AccessID);
  if(p.Level==='PRODI')return cleanText_(audit.AuditiType)==='PRODI'&&cleanText_(audit.AuditiID)===cleanText_(p.AccessID);
  if(p.Level==='UNIT')return cleanText_(audit.AuditiType)==='UNIT'&&cleanText_(audit.AuditiID)===cleanText_(p.AccessID);
  return false;
}
function canPimpinanApproveAudit_(u,audit){
  if(!isAuditInPimpinanScope_(u,audit))return false;
  const p=getPimpinanProfile_(u);if(!p)return false;
  return (p.Level==='PRODI'&&cleanText_(audit.AuditiType)==='PRODI'&&cleanText_(audit.AuditiID)===cleanText_(p.AccessID))||
         (p.Level==='UNIT'&&cleanText_(audit.AuditiType)==='UNIT'&&cleanText_(audit.AuditiID)===cleanText_(p.AccessID));
}
function getPimpinanApproversForAudit_(audit){
  return getAllRows_('MASTER_PIMPINAN').filter(function(p){
    if(!bool_(p.Active))return false;const level=normalizePimpinanLevel_(p.Level),aid=cleanText_(p.AccessID)||(level==='UNIT'?cleanText_(p.UnitID):'');
    return (level==='PRODI'&&cleanText_(audit.AuditiType)==='PRODI'&&cleanText_(audit.AuditiID)===aid)||
           (level==='UNIT'&&cleanText_(audit.AuditiType)==='UNIT'&&cleanText_(audit.AuditiID)===aid);
  });
}
function getPimpinanApproverUsersForAudit_(audit){
  const ids=new Set(getPimpinanApproversForAudit_(audit).map(p=>cleanText_(p.PimpinanID)));
  return getAllRows_('USERS').filter(u=>bool_(u.Active)&&cleanText_(u.Role)==='PIMPINAN'&&cleanText_(u.RefType)==='PIMPINAN'&&ids.has(cleanText_(u.RefID)));
}


function pushByKey_(map,key,row){if(!map[key])map[key]=[];map[key].push(row);}
function resultCounts_(){return{MENYIMPANG:0,'BELUM MENCAPAI':0,MENCAPAI:0,MELAMPAUI:0};}
function pct_(n,d){return d?Math.round((Number(n)||0)*100/(Number(d)||0)):0;}
function buildDashboardAnalytics_(audits,assigns,self,desk,findings,reports,standards){
  audits=audits||[];assigns=(assigns||[]).filter(r=>bool_(r.Active));self=self||[];desk=desk||[];findings=findings||[];reports=reports||[];standards=standards||[];
  const auditIds=new Set(audits.map(a=>cleanText_(a.AuditID))),auditMap={};audits.forEach(a=>auditMap[cleanText_(a.AuditID)]=a);
  const assignByAudit={},selfByAudit={},deskByAudit={},findingByAudit={},findingByAssign={};
  assigns.forEach(r=>{if(auditIds.has(cleanText_(r.AuditID)))pushByKey_(assignByAudit,cleanText_(r.AuditID),r);});
  self.forEach(r=>{if(auditIds.has(cleanText_(r.AuditID)))pushByKey_(selfByAudit,cleanText_(r.AuditID),r);});
  desk.forEach(r=>{if(auditIds.has(cleanText_(r.AuditID)))pushByKey_(deskByAudit,cleanText_(r.AuditID),r);});
  findings.forEach(r=>{if(auditIds.has(cleanText_(r.AuditID))){pushByKey_(findingByAudit,cleanText_(r.AuditID),r);if(cleanText_(r.AssignID))findingByAssign[cleanText_(r.AssignID)]=r;}});

  const statusCounts={},findingCounts=resultCounts_();AMI_CONFIG.AUDIT_STATUSES.forEach(s=>statusCounts[s]=0);
  audits.forEach(a=>statusCounts[cleanText_(a.Status)]=(statusCounts[cleanText_(a.Status)]||0)+1);
  Object.keys(findingByAudit).forEach(k=>(findingByAudit[k]||[]).forEach(f=>{const cat=cleanText_(f.Kategori);if(Object.prototype.hasOwnProperty.call(findingCounts,cat))findingCounts[cat]++;}));

  const auditRows=audits.map(a=>{
    const id=cleanText_(a.AuditID),aa=assignByAudit[id]||[],se=selfByAudit[id]||[],de=deskByAudit[id]||[],ff=findingByAudit[id]||[];
    const total=aa.length,selfDone=se.filter(x=>cleanText_(x.Capaian)).length,deskDone=de.filter(x=>cleanText_(x.StatusDesk)).length,assessed=ff.filter(x=>AMI_CONFIG.CAPAIAN.indexOf(cleanText_(x.Kategori))>=0).length;
    let progress=(total?selfDone/total*30:0)+(total?deskDone/total*25:0)+(total?assessed/total*25:0);const st=cleanText_(a.Status);
    if(['MENUNGGU ACC AUDITI','MENUNGGU ACC LEAD','MENUNGGU ACC BPM'].indexOf(st)>=0)progress+=10;if(st==='MENUNGGU ACC BPM')progress+=5;if(st==='FINAL')progress=100;
    const rc=resultCounts_();ff.forEach(f=>{const c=cleanText_(f.Kategori);if(Object.prototype.hasOwnProperty.call(rc,c))rc[c]++;});
    const met=rc.MENCAPAI+rc.MELAMPAUI;
    return{AuditID:id,AuditiID:cleanText_(a.AuditiID),AuditiType:cleanText_(a.AuditiType),AuditiName:a.AuditiName,Fakultas:a.Fakultas,Jenjang:a.Jenjang,Status:a.Status,StandardCount:total,SelfDone:selfDone,DeskDone:deskDone,Assessed:assessed,Progress:Math.min(100,Math.round(progress)),Negative:rc.MENYIMPANG+rc['BELUM MENCAPAI'],ResultCounts:rc,Fulfilled:met,FulfillmentPct:pct_(met,assessed)};
  });

  const prodiResults=auditRows.filter(r=>r.AuditiType==='PRODI').map(r=>({AuditID:r.AuditID,ProdiID:r.AuditiID,NamaProdi:r.AuditiName,Fakultas:r.Fakultas,Jenjang:r.Jenjang,Status:r.Status,Assessed:r.Assessed,MENYIMPANG:r.ResultCounts.MENYIMPANG,'BELUM MENCAPAI':r.ResultCounts['BELUM MENCAPAI'],MENCAPAI:r.ResultCounts.MENCAPAI,MELAMPAUI:r.ResultCounts.MELAMPAUI,Fulfilled:r.Fulfilled,FulfillmentPct:r.FulfillmentPct,Progress:r.Progress})).sort((a,b)=>String(a.NamaProdi).localeCompare(String(b.NamaProdi)));

  const stdMap={};standards.forEach(s=>stdMap[cleanText_(s.StandardID)]=s);const stdAgg={};
  Object.keys(assignByAudit).forEach(auditId=>{
    const aud=auditMap[auditId];if(!aud||cleanText_(aud.AuditiType)!=='PRODI')return;
    (assignByAudit[auditId]||[]).forEach(asn=>{
      const sid=cleanText_(asn.StandardID),key=sid||cleanText_(asn.ItemCode);if(!stdAgg[key])stdAgg[key]={StandardID:sid,ItemCode:cleanText_(asn.ItemCode),NamaStandar:cleanText_(asn.NamaStandar),Versi:cleanText_(asn.VersiStandarSnapshot)||'',assigned:{},assessed:{},met:{},counts:resultCounts_()};
      const g=stdAgg[key],pid=cleanText_(aud.AuditiID)||auditId;g.assigned[pid]=true;const f=findingByAssign[cleanText_(asn.AssignID)],cat=f?cleanText_(f.Kategori):'';
      if(AMI_CONFIG.CAPAIAN.indexOf(cat)>=0){g.assessed[pid]=true;g.counts[cat]++;if(cat==='MENCAPAI'||cat==='MELAMPAUI')g.met[pid]=true;}
      const sm=stdMap[sid];if(sm){g.ItemCode=g.ItemCode||cleanText_(sm.ItemCode);g.NamaStandar=g.NamaStandar||cleanText_(sm.NamaStandar);g.Versi=g.Versi||cleanText_(sm.Versi);}
    });
  });
  const standardPerformance=Object.keys(stdAgg).map(k=>{const g=stdAgg[k],assigned=Object.keys(g.assigned).length,assessed=Object.keys(g.assessed).length,met=Object.keys(g.met).length;return{StandardID:g.StandardID,ItemCode:g.ItemCode,NamaStandar:g.NamaStandar,Versi:g.Versi||'1.0',AssignedProdi:assigned,AssessedProdi:assessed,MetProdi:met,FulfillmentPct:pct_(met,assessed),CoveragePct:pct_(assessed,assigned),MENYIMPANG:g.counts.MENYIMPANG,'BELUM MENCAPAI':g.counts['BELUM MENCAPAI'],MENCAPAI:g.counts.MENCAPAI,MELAMPAUI:g.counts.MELAMPAUI};}).sort((a,b)=>a.FulfillmentPct-b.FulfillmentPct||String(a.ItemCode).localeCompare(String(b.ItemCode)));

  const assessedTotal=Object.keys(findingCounts).reduce((s,k)=>s+findingCounts[k],0),fulfilledTotal=findingCounts.MENCAPAI+findingCounts.MELAMPAUI;
  return{statusCounts:statusCounts,findingCounts:findingCounts,resultTotal:assessedTotal,fulfilledTotal:fulfilledTotal,overallFulfillmentPct:pct_(fulfilledTotal,assessedTotal),auditRows:auditRows,prodiResults:prodiResults,standardPerformance:standardPerformance,reports:reports.filter(r=>auditIds.has(cleanText_(r.AuditID))).length};
}
function getDashboardData_(u){
  const activeCycleId=cleanText_(getSetting_('ACTIVE_CYCLE_ID','')),allAudits=getAllRows_('AMI_AUDITI'),audits=filterAuditsForUser_(u,allAudits).filter(a=>!activeCycleId||cleanText_(a.CycleID)===activeCycleId),standards=getAllRows_('MASTER_STANDAR'),prodi=getAllRows_('MASTER_PRODI'),auditors=getAllRows_('MASTER_AUDITOR');
  const analytics=buildDashboardAnalytics_(audits,getAllRows_('AMI_STANDARD_ASSIGN'),getAllRows_('SELF_EVAL'),getAllRows_('DESK_EVAL'),getAllRows_('FINDINGS'),getAllRows_('REPORT_LOG'),standards);
  return Object.assign({activeCycleId:activeCycleId,totalAudits:audits.length,finalAudits:audits.filter(a=>cleanText_(a.Status)==='FINAL').length,averageProgress:analytics.auditRows.length?Math.round(analytics.auditRows.reduce((s,r)=>s+r.Progress,0)/analytics.auditRows.length):0,standardCount:standards.filter(r=>bool_(r.Active)).length,prodiCount:prodi.filter(r=>bool_(r.Active)).length,auditorCount:auditors.filter(r=>bool_(r.Active)).length},analytics);
}
function filterAuditsForUser_(u,audits){const role=cleanText_(u.Role);if(role==='ADMIN_BPM')return audits;if(role==='PIMPINAN')return audits.filter(a=>isAuditInPimpinanScope_(u,a));if(role==='AUDITI')return audits.filter(a=>cleanText_(a.AuditiType)===cleanText_(u.RefType)&&cleanText_(a.AuditiID)===cleanText_(u.RefID));if(role==='AUDITOR'){const teams=getAllRows_('AMI_TEAM').filter(t=>[t.LeadAuditorID,t.Member1ID,t.Member2ID].map(cleanText_).indexOf(cleanText_(u.RefID))>=0);const ids=new Set(teams.map(t=>t.AuditID));return audits.filter(a=>ids.has(a.AuditID));}return[];}
function getExecutiveDashboard(token){const u=session_(token);return serializeValue_(getDashboardData_(u));}

function listStandards(token,filters){requireRole_(token,['ADMIN_BPM']);filters=filters||{};let rows=getAllRows_('MASTER_STANDAR').filter(r=>bool_(r.Active)&&(cleanText_(r.StatusStandar)==='BERLAKU'||!cleanText_(r.StatusStandar)));const tahun=Number(filters.tahun)||0;if(tahun)rows=rows.filter(r=>standardAppliesToYear_(r,tahun));if(cleanText_(filters.kelompok))rows=rows.filter(r=>cleanText_(r.Kelompok)===cleanText_(filters.kelompok));if(cleanText_(filters.q)){const q=cleanText_(filters.q).toLowerCase();rows=rows.filter(r=>[r.ItemCode,r.NamaStandar,r.PernyataanStandar,r.Indikator,r.Versi].some(v=>String(v||'').toLowerCase().indexOf(q)>=0));}return rows.map(cleanRow_);}
function listMaster(token,type){requireRole_(token,['ADMIN_BPM']);const map={PRODI:'MASTER_PRODI',UNIT:'MASTER_UNIT',AUDITOR:'MASTER_AUDITOR',PIMPINAN:'MASTER_PIMPINAN'};if(!map[type])throw new Error('Jenis master tidak dikenali.');return getAllRows_(map[type]).map(cleanRow_);}
function normalizeMasterRecord_(type,rec){
  rec=Object.assign({},rec||{});
  if(type==='PRODI'){if(!cleanText_(rec.NamaProdi))throw new Error('Nama Program Studi wajib diisi.');const j=cleanText_(rec.Jenjang).toUpperCase();if(j&&['S1','S2','S3'].indexOf(j)<0)throw new Error('Jenjang harus S1, S2, atau S3.');rec.Jenjang=j;delete rec.Email;}
  else if(type==='UNIT'){if(!cleanText_(rec.NamaUnit))throw new Error('Nama Unit/Biro wajib diisi.');rec.JenisUnit=cleanText_(rec.JenisUnit).toUpperCase();if(AMI_CONFIG.UNIT_TYPES.indexOf(rec.JenisUnit)<0)throw new Error('Pilih Jenis Unit dari dropdown yang tersedia.');delete rec.Email;}
  else if(type==='AUDITOR'){if(!cleanText_(rec.Nama))throw new Error('Nama Auditor wajib diisi. Masukkan gelar langsung pada Nama.');rec.Sertifikasi=cleanText_(rec.Sertifikasi).toUpperCase();if(['YA','YES','TRUE','1'].indexOf(rec.Sertifikasi)>=0)rec.Sertifikasi='IYA';if(['NO','FALSE','0'].indexOf(rec.Sertifikasi)>=0)rec.Sertifikasi='TIDAK';if(AMI_CONFIG.AUDITOR_CERTIFICATION.indexOf(rec.Sertifikasi)<0)throw new Error('Sertifikasi harus IYA atau TIDAK.');delete rec.Gelar;delete rec.Email;delete rec.Telepon;}
  else if(type==='PIMPINAN'){if(!cleanText_(rec.Nama))throw new Error('Nama Pimpinan wajib diisi.');rec=normalizePimpinanRecord_(rec);delete rec.Email;}
  return rec;
}
/** V24: identitas auditor dinormalisasi agar import berulang tidak membuat duplikat. */
function auditorIdentityKey_(value){
  var x=cleanText_(value).toUpperCase();
  if(!x)return '';
  // NIDN/NIK sering ditempel dari Excel dengan spasi, titik, strip, atau slash.
  // Semua variasi tersebut dianggap sebagai identitas yang sama.
  return x.replace(/[^A-Z0-9]/g,'');
}
function auditorNameKey_(value){return normalizeUsername_(value||'').replace(/[^a-z0-9]/g,'');}
function auditorUnitKey_(value){return normalizeUsername_(value||'').replace(/[^a-z0-9]/g,'');}
function findAuditorMasterMatch_(rows,nidnNik,nama,unit,excludeAuditorId){
  rows=rows||[];
  var nid=auditorIdentityKey_(nidnNik),name=auditorNameKey_(nama),unitKey=auditorUnitKey_(unit),exclude=cleanText_(excludeAuditorId);
  var byId=null;
  if(nid){
    byId=rows.find(function(r){return cleanText_(r.AuditorID)!==exclude&&auditorIdentityKey_(r.NIDN_NIK)===nid;})||null;
    if(byId)return byId;
  }
  // Fallback hanya bila NIDN/NIK incoming atau record lama kosong, agar dua orang
  // berbeda yang kebetulan bernama sama tidak digabung bila keduanya punya ID berbeda.
  if(name){
    return rows.find(function(r){
      if(cleanText_(r.AuditorID)===exclude)return false;
      if(auditorNameKey_(r.Nama)!==name)return false;
      if(unitKey&&auditorUnitKey_(r.Unit)!==unitKey)return false;
      return !nid||!auditorIdentityKey_(r.NIDN_NIK);
    })||null;
  }
  return null;
}

function saveMaster(token,type,rec){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']),defs={PRODI:{sheet:'MASTER_PRODI',key:'ProdiID',prefix:'PRODI'},UNIT:{sheet:'MASTER_UNIT',key:'UnitID',prefix:'UNIT'},AUDITOR:{sheet:'MASTER_AUDITOR',key:'AuditorID',prefix:'AUD'},PIMPINAN:{sheet:'MASTER_PIMPINAN',key:'PimpinanID',prefix:'PIM'}},d=defs[type];
  if(!d)throw new Error('Jenis master tidak dikenali.');
  rec=normalizeMasterRecord_(type,rec);
  let id=cleanText_(rec[d.key]),old=id?findOne_(d.sheet,d.key,id):null;
  // Saat membuat Auditor baru, gunakan record lama jika identitas yang sama sudah ada.
  // AuditorID lama dipertahankan supaya relasi AMI_TEAM dan USERS tidak putus.
  if(type==='AUDITOR'&&!old){
    var duplicate=findAuditorMasterMatch_(getAllRows_('MASTER_AUDITOR'),rec.NIDN_NIK,rec.Nama,rec.Unit,id);
    if(duplicate){old=duplicate;id=cleanText_(duplicate.AuditorID);}
  }
  if(!id)id=uuid_(d.prefix);
  rec[d.key]=id;rec.Active=rec.Active!==false;rec.UpdatedAt=now_();
  if(old)updateRow_(d.sheet,old._row,rec);else{rec.CreatedAt=now_();appendObject_(d.sheet,rec);}
  auditLog_(u,'SAVE_MASTER',d.sheet,'',id,old,rec);
  return{ok:true,id:id,updatedExisting:!!old};
});}
function bulkImportMaster(token,type,rawText){
  const u=requireRole_(token,['ADMIN_BPM']),lines=String(rawText||'').split(/\r?\n/).filter(x=>cleanText_(x));let inserted=0,updated=0,skipped=0;
  const prodi=getAllRows_('MASTER_PRODI'),units=getAllRows_('MASTER_UNIT'),auditors=getAllRows_('MASTER_AUDITOR'),pimpinan=getAllRows_('MASTER_PIMPINAN');
  lines.forEach(function(line){const c=line.split('\t');try{
    if(type==='PRODI'){if(!cleanText_(c[1])){skipped++;return;}const old=prodi.find(r=>cleanText_(r.KodeProdi)===cleanText_(c[0])||normalizeUsername_(r.NamaProdi)===normalizeUsername_(c[1]));var rr=saveMaster(token,'PRODI',{ProdiID:old?old.ProdiID:'',KodeProdi:c[0]||'',NamaProdi:c[1]||'',Fakultas:c[2]||'',Jenjang:c[3]||'',Kaprodi:c[4]||'',NIDN:c[5]||'',Active:true});if(old)updated++;else{inserted++;prodi.push({ProdiID:rr.id,KodeProdi:c[0]||'',NamaProdi:c[1]||''});}}
    else if(type==='UNIT'){if(!cleanText_(c[1])){skipped++;return;}const old=units.find(r=>cleanText_(r.KodeUnit)===cleanText_(c[0])||normalizeUsername_(r.NamaUnit)===normalizeUsername_(c[1]));var rr2=saveMaster(token,'UNIT',{UnitID:old?old.UnitID:'',KodeUnit:c[0]||'',NamaUnit:c[1]||'',JenisUnit:c[2]||'',Pimpinan:c[3]||'',Active:true});if(old)updated++;else{inserted++;units.push({UnitID:rr2.id,KodeUnit:c[0]||'',NamaUnit:c[1]||''});}}
    else if(type==='AUDITOR'){
      if(!cleanText_(c[1])){skipped++;return;}
      const old=findAuditorMasterMatch_(auditors,c[0]||'',c[1]||'',c[2]||'','');
      var data={AuditorID:old?old.AuditorID:'',NIDN_NIK:c[0]||'',Nama:c[1]||'',Unit:c[2]||'',Sertifikasi:c[3]||'',Active:true};
      var rr3=saveMaster(token,'AUDITOR',data);
      if(old||rr3.updatedExisting){updated++;}
      else{inserted++;auditors.push(Object.assign({},data,{AuditorID:rr3.id}));}
    }
    else if(type==='PIMPINAN'){if(!cleanText_(c[0])){skipped++;return;}const level=normalizePimpinanLevel_(c[2]),area=cleanText_(c[3]);const old=pimpinan.find(r=>normalizeUsername_(r.Nama)===normalizeUsername_(c[0])&&normalizeUsername_(r.Jabatan)===normalizeUsername_(c[1]));var rr4=saveMaster(token,'PIMPINAN',{PimpinanID:old?old.PimpinanID:'',Nama:c[0]||'',Jabatan:c[1]||'',Level:level,AccessID:area,AccessName:area,Active:true});if(old)updated++;else{inserted++;pimpinan.push({PimpinanID:rr4.id,Nama:c[0]||'',Jabatan:c[1]||''});}}
    else throw new Error('Jenis bulk belum didukung.');
  }catch(e){console.error('BULK IMPORT '+type+' ERROR:',e);skipped++;}});
  auditLog_(u,'BULK_IMPORT',type,'','','',{inserted:inserted,updated:updated,skipped:skipped,dedupeVersion:'V24'});return{inserted:inserted,updated:updated,skipped:skipped};
}

/**
 * V24 — DIAGNOSTIK DUPLIKAT AUDITOR (READ ONLY, editor-only).
 * Menampilkan grup auditor ganda dan apakah masing-masing AuditorID sudah direferensikan
 * oleh AMI_TEAM atau USERS. Tidak menghapus/mengubah data.
 */
function maintenanceCheckDuplicateAuditors_(){
  var auditors=getAllRows_('MASTER_AUDITOR');
  var teams=getAllRows_('AMI_TEAM');
  var users=getAllRows_('USERS');
  var groups={};
  auditors.forEach(function(a){
    var nid=auditorIdentityKey_(a.NIDN_NIK);
    var key=nid?'NID:'+nid:'NAME:'+auditorNameKey_(a.Nama)+'|UNIT:'+auditorUnitKey_(a.Unit);
    if(!groups[key])groups[key]=[];
    groups[key].push(a);
  });
  var duplicates=[];
  Object.keys(groups).forEach(function(key){
    var rows=groups[key];
    if(rows.length<2)return;
    duplicates.push({
      key:key,
      count:rows.length,
      auditors:rows.map(function(a){
        var id=cleanText_(a.AuditorID);
        var teamRefs=teams.filter(function(t){return [t.LeadAuditorID,t.Member1ID,t.Member2ID].map(cleanText_).indexOf(id)>=0;}).length;
        var userRefs=users.filter(function(u){return cleanText_(u.RefType)==='AUDITOR'&&cleanText_(u.RefID)===id;}).length;
        return {AuditorID:id,NIDN_NIK:cleanText_(a.NIDN_NIK),Nama:cleanText_(a.Nama),Unit:cleanText_(a.Unit),Active:bool_(a.Active),teamRefs:teamRefs,userRefs:userRefs,CreatedAt:a.CreatedAt||'',UpdatedAt:a.UpdatedAt||''};
      })
    });
  });
  Logger.log(JSON.stringify({duplicateGroups:duplicates.length,duplicates:duplicates},null,2));
  return {duplicateGroups:duplicates.length,duplicates:duplicates};
}

function saveCycle(token,data){return withLock_(function(){const u=requireRole_(token,['ADMIN_BPM']);data=data||{};let id=cleanText_(data.CycleID),old=id?findOne_('AMI_CYCLE','CycleID',id):null;if(!id)id=uuid_('CYCLE');const rec={CycleID:id,NamaSiklus:cleanText_(data.NamaSiklus)||('AMI Tahun '+cleanText_(data.Tahun)),Tahun:cleanText_(data.Tahun),TahunAkademik:cleanText_(data.TahunAkademik),TanggalMulai:data.TanggalMulai||'',BatasEvaluasiDiri:data.BatasEvaluasiDiri||'',DeskStart:data.DeskStart||'',DeskEnd:data.DeskEnd||'',VisitStart:data.VisitStart||'',VisitEnd:data.VisitEnd||'',Status:cleanText_(data.Status)||'DRAFT BPM',Active:data.Active!==false,CreatedBy:old?old.CreatedBy:u.Nama,CreatedAt:old?old.CreatedAt:now_()};if(old)updateRow_('AMI_CYCLE',old._row,rec);else appendObject_('AMI_CYCLE',rec);if(rec.Status==='AKTIF')setActiveCycle_(id,u);auditLog_(u,'SAVE_CYCLE','AMI_CYCLE','',id,old,rec);return{ok:true,cycleId:id};});}
function setActiveCycle_(cycleId,u){const target=findOne_('AMI_CYCLE','CycleID',cycleId);if(!target)throw new Error('Siklus tidak ditemukan.');getAllRows_('AMI_CYCLE').forEach(r=>updateRow_('AMI_CYCLE',r._row,{Active:r.CycleID===cycleId,Status:r.CycleID===cycleId?'AKTIF':(r.Status==='AKTIF'?'DRAFT BPM':r.Status)}));setSetting_('ACTIVE_CYCLE_ID',cycleId,'Siklus AMI aktif',u?u.Nama:'SYSTEM');}
function setActiveCycle(token,cycleId){return withLock_(function(){const u=requireRole_(token,['ADMIN_BPM']);setActiveCycle_(cycleId,u);return{ok:true};});}

function assignmentEditStateFromData_(auditId,status,data){
  auditId=cleanText_(auditId);
  status=cleanText_(status);
  data=data||{};

  const selfRows=(data.self||[]).filter(r=>cleanText_(r.AuditID)===auditId);
  const selfStarted=selfRows.some(function(r){
    return !!(
      cleanText_(r.Capaian)||
      cleanText_(r.NilaiCapaian)||
      cleanText_(r.EvaluasiDiri)||
      cleanText_(r.SavedAt)||
      cleanText_(r.SubmittedAt)||
      Number(r.BuktiCount||0)>0
    );
  });

  const evidenceCount=(data.evidence||[]).filter(r=>cleanText_(r.AuditID)===auditId).length;
  const deskStarted=(data.desk||[]).some(r=>cleanText_(r.AuditID)===auditId&&(cleanText_(r.StatusDesk)||cleanText_(r.CatatanDesk)));
  const findingCount=(data.findings||[]).filter(r=>cleanText_(r.AuditID)===auditId).length;
  const visitExists=(data.visit||[]).some(r=>cleanText_(r.AuditID)===auditId);
  const f2Exists=(data.form2||[]).some(r=>cleanText_(r.AuditID)===auditId);
  const f3Exists=(data.form3||[]).some(r=>cleanText_(r.AuditID)===auditId);
  const approvalCount=(data.approval||[]).filter(r=>cleanText_(r.AuditID)===auditId).length;
  const reportCount=(data.report||[]).filter(r=>cleanText_(r.AuditID)===auditId).length;

  const started=selfStarted||evidenceCount>0||deskStarted||findingCount>0||visitExists||f2Exists||f3Exists||approvalCount>0||reportCount>0;

  if(status==='DRAFT BPM'){
    return{
      canEdit:!started,
      canReopen:false,
      started:started,
      reason:started?'Data proses audit sudah ditemukan. Hubungi administrator sistem sebelum mengubah penetapan.':''
    };
  }

  if(status==='PENUGASAN DITERBITKAN'&&!started){
    return{canEdit:false,canReopen:true,started:false,reason:''};
  }

  let reason='';
  if(status==='FINAL')reason='Audit sudah FINAL.';
  else if(started)reason='Proses audit sudah mulai diisi sehingga penetapan tidak boleh diubah.';
  else reason='Penetapan hanya dapat dibuka kembali saat status PENUGASAN DITERBITKAN.';

  return{canEdit:false,canReopen:false,started:started,reason:reason};
}

function assignmentEditState_(auditId,status){
  return assignmentEditStateFromData_(auditId,status,{
    self:getAllRows_('SELF_EVAL'),
    evidence:getAllRows_('EVIDENCE'),
    desk:getAllRows_('DESK_EVAL'),
    findings:getAllRows_('FINDINGS'),
    visit:getAllRows_('VISIT'),
    form2:getAllRows_('FORM2_PROGRAM_KERJA'),
    form3:getAllRows_('FORM3_CATATAN'),
    approval:getAllRows_('APPROVAL'),
    report:getAllRows_('REPORT_LOG')
  });
}

function reopenAuditAssignment(token,auditId){
  return withLock_(function(){
    const u=requireRole_(token,['ADMIN_BPM']);
    const audit=findOne_('AMI_AUDITI','AuditID',auditId);
    if(!audit)throw new Error('Auditi tidak ditemukan.');

    const status=cleanText_(audit.Status);
    if(status==='DRAFT BPM')return{ok:true,alreadyDraft:true};
    if(status!=='PENUGASAN DITERBITKAN'){
      throw new Error('Penetapan hanya dapat dibuka kembali saat status PENUGASAN DITERBITKAN.');
    }

    const editState=assignmentEditState_(auditId,status);
    if(!editState.canReopen){
      throw new Error(editState.reason||'Penetapan tidak dapat dibuka kembali.');
    }

    // SELF_EVAL pada tahap ini hanya placeholder kosong yang dibuat saat publish.
    // Hapus agar jika standar diganti tidak meninggalkan baris yatim.
    deleteRowsByPredicate_('SELF_EVAL',function(r){
      return cleanText_(r.AuditID)===cleanText_(auditId);
    });

    deleteRowsByPredicate_('APPROVAL',function(r){
      return cleanText_(r.AuditID)===cleanText_(auditId);
    });

    updateRow_('AMI_AUDITI',audit._row,{
      Status:'DRAFT BPM',
      PublishedAt:''
    });

    auditLog_(u,'REOPEN_ASSIGNMENT','AMI_AUDITI',auditId,auditId,audit,{
      Status:'DRAFT BPM',
      note:'Penetapan dibuka kembali sebelum Auditi mulai mengisi.'
    });

    return{ok:true,auditId:auditId,status:'DRAFT BPM'};
  });
}

function listCycleAudits(token,cycleId){
  requireRole_(token,['ADMIN_BPM']);

  const assigns=getAllRows_('AMI_STANDARD_ASSIGN');
  const teams=getAllRows_('AMI_TEAM');
  const counts={},teamMap={};

  assigns.forEach(function(x){
    if(bool_(x.Active)){
      counts[cleanText_(x.AuditID)]=(counts[cleanText_(x.AuditID)]||0)+1;
    }
  });
  teams.forEach(function(t){
    teamMap[cleanText_(t.AuditID)]=t;
  });

  // Dibaca satu kali untuk seluruh auditi agar halaman Penetapan tidak lambat.
  const editData={
    self:getAllRows_('SELF_EVAL'),
    evidence:getAllRows_('EVIDENCE'),
    desk:getAllRows_('DESK_EVAL'),
    findings:getAllRows_('FINDINGS'),
    visit:getAllRows_('VISIT'),
    form2:getAllRows_('FORM2_PROGRAM_KERJA'),
    form3:getAllRows_('FORM3_CATATAN'),
    approval:getAllRows_('APPROVAL'),
    report:getAllRows_('REPORT_LOG')
  };

  return getAllRows_('AMI_AUDITI')
    .filter(function(r){return cleanText_(r.CycleID)===cleanText_(cycleId);})
    .map(function(r){
      const o=cleanRow_(r);
      o.StandardCount=counts[cleanText_(r.AuditID)]||0;
      o.Team=cleanRow_(teamMap[cleanText_(r.AuditID)]||{});

      const es=assignmentEditStateFromData_(r.AuditID,r.Status,editData);
      o.CanEditAssignment=!!es.canEdit;
      o.CanReopenAssignment=!!es.canReopen;
      o.AssignmentStarted=!!es.started;
      o.AssignmentLockReason=es.reason||'';
      return o;
    });
}

function createAuditiFromMaster(token,cycleId,target){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']);
  if(!findOne_('AMI_CYCLE','CycleID',cycleId))throw new Error('Siklus tidak ditemukan.');
  target=target||{};
  let src=[];const mode=cleanText_(target.mode);
  if(mode==='ALL_PRODI')src=getAllRows_('MASTER_PRODI').filter(r=>bool_(r.Active)).map(r=>({type:'PRODI',id:r.ProdiID,name:r.NamaProdi,fak:r.Fakultas,jenjang:r.Jenjang}));
  else if(mode==='JENJANG')src=getAllRows_('MASTER_PRODI').filter(r=>bool_(r.Active)&&cleanText_(r.Jenjang)===cleanText_(target.jenjang)).map(r=>({type:'PRODI',id:r.ProdiID,name:r.NamaProdi,fak:r.Fakultas,jenjang:r.Jenjang}));
  else if(mode==='UNIT_IDS')src=getAllRows_('MASTER_UNIT').filter(r=>(target.ids||[]).indexOf(r.UnitID)>=0).map(r=>({type:'UNIT',id:r.UnitID,name:r.NamaUnit,fak:'',jenjang:''}));
  else throw new Error('Target auditi tidak dikenali.');
  const current=getAllRows_('AMI_AUDITI'),existing=new Set(current.map(r=>cleanText_(r.CycleID)+'|'+cleanText_(r.AuditiType)+'|'+cleanText_(r.AuditiID)));
  const stamp=now_(),batch=[];let skipped=0;
  src.forEach(function(x){const key=cleanText_(cycleId)+'|'+cleanText_(x.type)+'|'+cleanText_(x.id);if(existing.has(key)){skipped++;return;}existing.add(key);batch.push({AuditID:uuid_('AUDIT'),CycleID:cycleId,AuditiType:x.type,AuditiID:x.id,AuditiName:x.name,Fakultas:x.fak,Jenjang:x.jenjang,Status:'DRAFT BPM',PublishedAt:'',CreatedAt:stamp,CreatedBy:u.Nama});});
  if(batch.length)appendObjects_('AMI_AUDITI',batch);
  auditLog_(u,'CREATE_AUDITI','AMI_AUDITI','','','',{target:target,inserted:batch.length,skipped:skipped});
  return{inserted:batch.length,skipped:skipped};
});}
function assignStandards(token,auditIds,standardIds,replaceExisting){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']);auditIds=auditIds||[];standardIds=standardIds||[];if(!auditIds.length)throw new Error('Pilih minimal satu auditi. Jika penugasan sudah diterbitkan, klik Buka Penetapan terlebih dahulu.');if(!standardIds.length)throw new Error('Pilih minimal satu standar/indikator.');
  const standards=getAllRows_('MASTER_STANDAR'),stdMap={},auditMap={},cycleMap={};standards.forEach(s=>stdMap[cleanText_(s.StandardID)]=s);getAllRows_('AMI_AUDITI').forEach(a=>auditMap[cleanText_(a.AuditID)]=a);getAllRows_('AMI_CYCLE').forEach(c=>cycleMap[cleanText_(c.CycleID)]=c);let current=getAllRows_('AMI_STANDARD_ASSIGN'),inserted=0,skipped=0,removed=0;
  const auditSet=new Set(auditIds.map(cleanText_));
  auditIds.forEach(function(auditId){
    const audit=auditMap[cleanText_(auditId)];
    if(!audit)throw new Error('Auditi tidak ditemukan.');
    if(cleanText_(audit.Status)!=='DRAFT BPM')throw new Error(audit.AuditiName+': penetapan terkunci. Klik Buka Penetapan terlebih dahulu.');
  });
  if(replaceExisting){
    // DRAFT BPM tidak boleh mempunyai pekerjaan audit substantif. Bersihkan placeholder kosong.
    auditIds.forEach(function(auditId){
      const es=assignmentEditState_(auditId,'DRAFT BPM');
      if(es.started)throw new Error((auditMap[cleanText_(auditId)]||{}).AuditiName+': data audit sudah mulai diisi sehingga standar tidak boleh diganti.');
      deleteRowsByPredicate_('SELF_EVAL',function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
    });
    removed+=deleteRowsByPredicate_('AMI_STANDARD_ASSIGN',r=>auditSet.has(cleanText_(r.AuditID)));
    current=current.filter(r=>!auditSet.has(cleanText_(r.AuditID)));
  }
  const existing=new Set(current.filter(r=>bool_(r.Active)).map(r=>cleanText_(r.AuditID)+'|'+cleanText_(r.StandardID))),batch=[],usedStandards={};
  auditIds.forEach(auditId=>{const aid=cleanText_(auditId),audit=auditMap[aid];if(!audit)throw new Error('Auditi tidak ditemukan.');if(cleanText_(audit.Status)!=='DRAFT BPM')throw new Error(audit.AuditiName+': standar hanya dapat diubah saat status DRAFT BPM.');const cycle=cycleMap[cleanText_(audit.CycleID)]||{},year=Number(cycle.Tahun)||0;
    standardIds.forEach(stdId=>{const sid=cleanText_(stdId),std=stdMap[sid],key=aid+'|'+sid;if(!std)throw new Error('Standar '+sid+' tidak ditemukan.');if(!(bool_(std.Active)&&(cleanText_(std.StatusStandar)==='BERLAKU'||!cleanText_(std.StatusStandar))))throw new Error((std.ItemCode||sid)+': standar belum berstatus BERLAKU.');if(year&&!standardAppliesToYear_(std,year))throw new Error((std.ItemCode||sid)+': standar tidak berlaku untuk tahun siklus '+year+'.');if(existing.has(key)){skipped++;return;}const snap=standardSnapshotFromMaster_(std);batch.push(Object.assign({AssignID:uuid_('ASN'),AuditID:aid,StandardID:sid,ItemCode:std.ItemCode,NamaStandar:std.NamaStandar,AssignedAt:now_(),AssignedBy:u.Nama,Active:true},snap));existing.add(key);usedStandards[sid]=std;inserted++;});
  });
  if(batch.length)appendObjects_('AMI_STANDARD_ASSIGN',batch);
  const lockStamp=now_(),standardPatches=Object.keys(usedStandards).map(function(sid){return{StandardID:sid,Locked:true,UpdatedAt:lockStamp,UpdatedBy:u.Nama};});
  if(standardPatches.length)batchUpsert_('MASTER_STANDAR',['StandardID'],standardPatches,[]);
  auditLog_(u,'ASSIGN_STANDARDS','AMI_STANDARD_ASSIGN','','','',{auditIds:auditIds,standardIds:standardIds,replaceExisting:replaceExisting,inserted:inserted});return{inserted:inserted,skipped:skipped,removed:removed};
});}

function saveAuditTeam(token,auditId,leadId,member1Id,member2Id){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']),audit=findOne_('AMI_AUDITI','AuditID',auditId);
  if(!audit)throw new Error('Auditi tidak ditemukan.');
  if(cleanText_(audit.Status)!=='DRAFT BPM')throw new Error('Tim auditor hanya dapat diubah saat DRAFT BPM.');
  const ids=[leadId,member1Id,member2Id].map(cleanText_);
  if(ids.some(x=>!x))throw new Error('Tim harus terdiri dari 1 Lead Auditor dan 2 anggota.');
  if(new Set(ids).size!==3)throw new Error('Lead dan anggota harus tiga orang yang berbeda.');
  const auditors=getAllRows_('MASTER_AUDITOR'),byId={};auditors.forEach(function(a){byId[cleanText_(a.AuditorID)]=a;});
  ids.forEach(function(id){const a=byId[id];if(!a)throw new Error('Auditor tidak ditemukan: '+id);if(!bool_(a.Active))throw new Error('Auditor '+(a.Nama||id)+' sedang nonaktif.');});
  const old=findOne_('AMI_TEAM','AuditID',auditId),rec={TeamID:old?old.TeamID:uuid_('TEAM'),AuditID:auditId,LeadAuditorID:ids[0],Member1ID:ids[1],Member2ID:ids[2],AssignedAt:old?old.AssignedAt:now_(),AssignedBy:u.Nama,UpdatedAt:now_()};
  if(old)updateRow_('AMI_TEAM',old._row,rec);else appendObject_('AMI_TEAM',rec);
  auditLog_(u,'SAVE_TEAM','AMI_TEAM',auditId,rec.TeamID,old,rec);return{ok:true};
});}
function ensureSelfEvalRows_(auditId){const assigns=getAllRows_('AMI_STANDARD_ASSIGN').filter(r=>cleanText_(r.AuditID)===cleanText_(auditId)&&bool_(r.Active)),existing=new Set(getAllRows_('SELF_EVAL').filter(r=>cleanText_(r.AuditID)===cleanText_(auditId)).map(r=>cleanText_(r.AssignID))),batch=assigns.filter(a=>!existing.has(cleanText_(a.AssignID))).map(a=>({SelfEvalID:uuid_('SE'),AuditID:auditId,AssignID:a.AssignID,StandardID:a.StandardID,Capaian:'',NilaiCapaian:'',EvaluasiDiri:'',Status:'DRAFT',BuktiCount:0,SavedAt:'',SubmittedAt:'',SubmittedBy:''}));if(batch.length)appendObjects_('SELF_EVAL',batch);return batch.length;}
function publishAuditAssignments(token,auditIds){return withLock_(function(){const u=requireRole_(token,['ADMIN_BPM']);auditIds=auditIds||[];let published=0;auditIds.forEach(id=>{const a=findOne_('AMI_AUDITI','AuditID',id);if(!a)return;if(cleanText_(a.Status)!=='DRAFT BPM')throw new Error(a.AuditiName+': hanya DRAFT BPM yang dapat diterbitkan.');const count=getAllRows_('AMI_STANDARD_ASSIGN').filter(r=>r.AuditID===id&&bool_(r.Active)).length,team=findOne_('AMI_TEAM','AuditID',id);if(!count)throw new Error(a.AuditiName+': belum memiliki standar audit.');if(!team||!team.LeadAuditorID||!team.Member1ID||!team.Member2ID)throw new Error(a.AuditiName+': tim auditor belum lengkap.');
const approvers=getPimpinanApproversForAudit_(a);if(!approvers.length)throw new Error(a.AuditiName+': Pimpinan Auditi belum dipetakan. Tambahkan Master Pimpinan dengan level '+(a.AuditiType==='PRODI'?'PRODI':'UNIT')+' dan Area Akses yang sesuai.');
const approverUsers=getPimpinanApproverUsersForAudit_(a);if(!approverUsers.length)throw new Error(a.AuditiName+': akun Pimpinan Auditi belum tersedia. Buka Akun Pengguna lalu klik Sinkronkan dari Master.');
ensureSelfEvalRows_(id);updateRow_('AMI_AUDITI',a._row,{Status:'PENUGASAN DITERBITKAN',PublishedAt:now_()});published++;});auditLog_(u,'PUBLISH_ASSIGNMENTS','AMI_AUDITI','','','',{auditIds:auditIds});return{published:published};});}

function auditLog_(u,action,module,auditId,recordId,beforeObj,afterObj){try{appendObject_('AUDIT_LOG',{LogID:uuid_('LOG'),Timestamp:now_(),UserID:u?u.UserID:'SYSTEM',Nama:u?u.Nama:'SYSTEM',Role:u?u.Role:'SYSTEM',Action:action,Module:module,AuditID:auditId||'',RecordID:recordId||'',BeforeJSON:beforeObj?JSON.stringify(cleanRow_(beforeObj)):'',AfterJSON:afterObj?JSON.stringify(serializeValue_(afterObj)):''});}catch(e){console.log('AUDIT_LOG gagal: '+e.message);}}


/* ================= V27 — RESTORED BATCH ASSIGNMENT API =================
   Required by Index.html and Code.gs self-test. Consolidated here so no
   AdminBatchService patch file is needed.
   ====================================================================== */
function adminBatchClean_(v) {
  return cleanText_(v);
}


function adminBatchValidateTeam_(item, auditMap, auditorMap) {
  item = item || {};

  var auditId = adminBatchClean_(item.AuditID);
  var audit = auditMap[auditId];

  if (!audit) {
    throw new Error('Auditi tidak ditemukan: ' + auditId);
  }

  if (adminBatchClean_(audit.Status) !== 'DRAFT BPM') {
    throw new Error(
      (audit.AuditiName || auditId) +
      ': hanya audit DRAFT BPM yang dapat diubah.'
    );
  }

  var ids = [
    adminBatchClean_(item.LeadAuditorID),
    adminBatchClean_(item.Member1ID),
    adminBatchClean_(item.Member2ID)
  ];

  if (!ids[0] || !ids[1] || !ids[2]) {
    throw new Error(
      (audit.AuditiName || auditId) +
      ': tim harus terdiri dari 1 Lead Auditor dan 2 anggota.'
    );
  }

  if (
    ids[0] === ids[1] ||
    ids[0] === ids[2] ||
    ids[1] === ids[2]
  ) {
    throw new Error(
      (audit.AuditiName || auditId) +
      ': Lead dan dua anggota harus orang yang berbeda.'
    );
  }

  for (var i = 0; i < ids.length; i++) {
    var auditor = auditorMap[ids[i]];

    if (!auditor) {
      throw new Error(
        (audit.AuditiName || auditId) +
        ': auditor tidak ditemukan.'
      );
    }

    if (!bool_(auditor.Active)) {
      throw new Error(
        (audit.AuditiName || auditId) +
        ': auditor ' +
        (auditor.Nama || ids[i]) +
        ' tidak aktif.'
      );
    }
  }

  return {
    audit:audit,
    auditId:auditId,
    leadId:ids[0],
    member1Id:ids[1],
    member2Id:ids[2]
  };
}

function adminBatchLoadMaps_() {
  var auditMap = {};
  var auditorMap = {};
  var teamMap = {};
  var standardCount = {};
  var selfKeys = {};

  getAllRows_('AMI_AUDITI').forEach(function(a) {
    auditMap[adminBatchClean_(a.AuditID)] = a;
  });

  getAllRows_('MASTER_AUDITOR').forEach(function(a) {
    auditorMap[adminBatchClean_(a.AuditorID)] = a;
  });

  getAllRows_('AMI_TEAM').forEach(function(t) {
    teamMap[adminBatchClean_(t.AuditID)] = t;
  });

  getAllRows_('AMI_STANDARD_ASSIGN').forEach(function(a) {
    if (!bool_(a.Active)) return;

    var aid = adminBatchClean_(a.AuditID);

    standardCount[aid] =
      (standardCount[aid] || 0) + 1;
  });

  getAllRows_('SELF_EVAL').forEach(function(s) {
    selfKeys[
      adminBatchClean_(s.AuditID) +
      '|' +
      adminBatchClean_(s.AssignID)
    ] = true;
  });

  return {
    auditMap:auditMap,
    auditorMap:auditorMap,
    teamMap:teamMap,
    standardCount:standardCount,
    selfKeys:selfKeys
  };
}

function adminBatchNormalizeItems_(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error(
      'Pilih minimal satu Auditi yang akan diproses.'
    );
  }

  var seen = {};
  var out = [];

  items.forEach(function(item) {
    var id = adminBatchClean_(
      item && item.AuditID
    );

    if (!id || seen[id]) return;

    seen[id] = true;
    out.push(item);
  });

  if (!out.length) {
    throw new Error(
      'Tidak ada Auditi valid yang dipilih.'
    );
  }

  return out;
}

function saveAuditTeamsBatch(token,items){
  return withLock_(function(){
    const u=requireRole_(token,['ADMIN_BPM']);items=adminBatchNormalizeItems_(items);
    const maps=adminBatchLoadMaps_(),validated=[];
    items.forEach(function(item){validated.push(adminBatchValidateTeam_(item,maps.auditMap,maps.auditorMap));});
    const stamp=now_(),records=validated.map(function(x){const old=maps.teamMap[x.auditId]||{};return{TeamID:old.TeamID||uuid_('TEAM'),AuditID:x.auditId,LeadAuditorID:x.leadId,Member1ID:x.member1Id,Member2ID:x.member2Id,AssignedAt:old.AssignedAt||stamp,AssignedBy:old.AssignedBy||u.Nama,UpdatedAt:stamp};});
    const r=batchUpsert_('AMI_TEAM',['AuditID'],records,[]);
    if(typeof auditLog_==='function')auditLog_(u,'SAVE_TEAMS_BATCH','AMI_TEAM','','','',{audits:validated.map(function(x){return x.auditId;}),inserted:r.inserted,updated:r.updated});
    return{ok:true,processed:validated.length,inserted:r.inserted,updated:r.updated,message:validated.length+' tim auditor berhasil disimpan sekaligus.'};
  });
}



function adminBatchPimpinanApproversForAudit_(audit) {
  return getPimpinanApproversForAudit_(audit);
}

function adminBatchPimpinanApproverUsersForAudit_(audit) {
  return getPimpinanApproverUsersForAudit_(audit);
}


function saveTeamsAndPublishBatch(token,items){
  return withLock_(function(){
    const u=requireRole_(token,['ADMIN_BPM']);items=adminBatchNormalizeItems_(items);
    const maps=adminBatchLoadMaps_(),validated=[];
    items.forEach(function(item){
      const x=adminBatchValidateTeam_(item,maps.auditMap,maps.auditorMap);
      if(!(maps.standardCount[x.auditId]||0))throw new Error((x.audit.AuditiName||x.auditId)+': belum memiliki standar audit.');
      if(!adminBatchPimpinanApproversForAudit_(x.audit).length)throw new Error((x.audit.AuditiName||x.auditId)+': Pimpinan Auditi belum dipetakan.');
      if(!adminBatchPimpinanApproverUsersForAudit_(x.audit).length)throw new Error((x.audit.AuditiName||x.auditId)+': akun Pimpinan Auditi belum tersedia. Sinkronkan akun dari Master Pimpinan terlebih dahulu.');
      validated.push(x);
    });
    const stamp=now_();
    const teamRecords=validated.map(function(x){const old=maps.teamMap[x.auditId]||{};return{TeamID:old.TeamID||uuid_('TEAM'),AuditID:x.auditId,LeadAuditorID:x.leadId,Member1ID:x.member1Id,Member2ID:x.member2Id,AssignedAt:old.AssignedAt||stamp,AssignedBy:old.AssignedBy||u.Nama,UpdatedAt:stamp};});
    const teamResult=batchUpsert_('AMI_TEAM',['AuditID'],teamRecords,[]);
    const selected={};validated.forEach(function(x){selected[x.auditId]=true;});
    const selfBatch=[];
    getAllRows_('AMI_STANDARD_ASSIGN').forEach(function(a){const aid=adminBatchClean_(a.AuditID),key=aid+'|'+adminBatchClean_(a.AssignID);if(selected[aid]&&bool_(a.Active)&&!maps.selfKeys[key]){selfBatch.push({SelfEvalID:uuid_('SE'),AuditID:aid,AssignID:a.AssignID,StandardID:a.StandardID,Capaian:'',NilaiCapaian:'',EvaluasiDiri:'',Status:'DRAFT',BuktiCount:0,SavedAt:'',SubmittedAt:'',SubmittedBy:''});maps.selfKeys[key]=true;}});
    if(selfBatch.length)batchUpsert_('SELF_EVAL',['AuditID','AssignID'],selfBatch,['NilaiCapaian']);
    const auditPatches=validated.map(function(x){return{AuditID:x.auditId,Status:'PENUGASAN DITERBITKAN',PublishedAt:stamp};});
    batchUpsert_('AMI_AUDITI',['AuditID'],auditPatches,[]);
    if(typeof auditLog_==='function')auditLog_(u,'SAVE_TEAMS_AND_PUBLISH_BATCH','AMI_AUDITI','','','',{auditIds:validated.map(function(x){return x.auditId;}),teamsInserted:teamResult.inserted,teamsUpdated:teamResult.updated,selfEvalCreated:selfBatch.length,published:validated.length});
    return{ok:true,published:validated.length,teamsInserted:teamResult.inserted,teamsUpdated:teamResult.updated,selfEvalCreated:selfBatch.length,message:validated.length+' penugasan berhasil disimpan dan diterbitkan sekaligus.'};
  });
}

/** Code.gs — entry point, public dashboard, dan self-test. */
function doGet(e){
  const t=HtmlService.createTemplateFromFile('Index');
  // V27: info aplikasi disisipkan pada respons HTML pertama. Ini menghapus satu
  // google.script.run tambahan per browser sebelum login dan mengurangi burst
  // eksekusi saat peserta AMI membuka URL secara serentak.
  let info={appName:AMI_CONFIG.APP_NAME,orgName:AMI_CONFIG.ORG_NAME,unitName:AMI_CONFIG.UNIT_NAME,version:AMI_CONFIG.VERSION};
  try{info=getPublicAppInfo();}catch(ignore){}
  t.appName=info.appName||AMI_CONFIG.APP_NAME;
  t.orgName=info.orgName||AMI_CONFIG.ORG_NAME;
  t.unitName=info.unitName||AMI_CONFIG.UNIT_NAME;
  t.appVersion=info.version||AMI_CONFIG.VERSION;
  const requestedView=e&&e.parameter?String(e.parameter.view||'').toLowerCase():'';
  t.initialView=requestedView==='login'?'login':'public';
  t.webAppUrl=ScriptApp.getService().getUrl()||'';
  const assets=getUiAssets_();
  t.bpmLogo=assets.bpmLogo;
  t.spmiLogo=assets.spmiLogo;
  t.campusHero=assets.campusHero;
  return t.evaluate().setTitle(t.appName).addMetaTag('viewport','width=device-width, initial-scale=1');
}

function getPublicAppInfo(){
  const cache=CacheService.getScriptCache(),key='AMI_APP_INFO_'+AMI_CONFIG.VERSION,cached=cache.get(key);
  if(cached){try{return JSON.parse(cached);}catch(ignore){}}
  let app=AMI_CONFIG.APP_NAME,org=AMI_CONFIG.ORG_NAME,unit=AMI_CONFIG.UNIT_NAME;
  try{
    const rows=getAllRows_('SETTINGS'),map={};
    rows.forEach(function(r){map[cleanText_(r.Key)]=cleanText_(r.Value);});
    app=map.APP_NAME||app;org=map.ORG_NAME||org;unit=map.UNIT_NAME||unit;
  }catch(ignore){}
  const out={appName:app,orgName:org,unitName:unit,version:AMI_CONFIG.VERSION,unitTypes:AMI_CONFIG.UNIT_TYPES||[],auditorCertification:AMI_CONFIG.AUDITOR_CERTIFICATION||[],standardStatuses:AMI_CONFIG.STANDARD_STATUSES||[]};
  try{cache.put(key,JSON.stringify(out),300);}catch(ignore){}
  return out;
}

/** Dashboard publik hanya agregat; tidak memuat bukti atau rincian temuan. */
function getPublicExecutiveDashboard(forceRefresh){
  if(!AMI_CONFIG.PUBLIC_DASHBOARD_ENABLED)return{enabled:false,ready:true};
  const cache=CacheService.getScriptCache(),key='AMI_PUBLIC_DASH_'+AMI_CONFIG.VERSION;
  if(!forceRefresh){const cached=cache.get(key);if(cached){try{return JSON.parse(cached);}catch(ignore){}}}
  try{
    const cycleId=cleanText_(getSetting_('ACTIVE_CYCLE_ID',''));
    const cycles=getAllRows_('AMI_CYCLE');
    const cycle=(cycleId&&cycles.find(function(c){return cleanText_(c.CycleID)===cycleId;}))||cycles.filter(function(c){return bool_(c.Active);}).slice(-1)[0]||{};
    const audits=getAllRows_('AMI_AUDITI').filter(function(a){return !cycle.CycleID||cleanText_(a.CycleID)===cleanText_(cycle.CycleID);});
    const allReports=getAllRows_('REPORT_LOG'),auditIds=new Set(audits.map(function(a){return cleanText_(a.AuditID);}));
    const analytics=buildDashboardAnalytics_(audits,getAllRows_('AMI_STANDARD_ASSIGN'),getAllRows_('SELF_EVAL'),getAllRows_('DESK_EVAL'),getAllRows_('FINDINGS'),allReports,getAllRows_('MASTER_STANDAR'));
    const stage={preparation:0,selfEvaluation:0,auditProcess:0,approval:0,final:0};
    audits.forEach(function(a){
      const st=cleanText_(a.Status);
      if(['DRAFT BPM','PENUGASAN DITERBITKAN'].indexOf(st)>=0)stage.preparation++;
      else if(['EVALUASI DIRI BERJALAN','EVALUASI DIRI DIKIRIM','PERLU REVISI AUDITI'].indexOf(st)>=0)stage.selfEvaluation++;
      else if(['DESK EVALUATION','SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','PERLU REVISI AUDITOR'].indexOf(st)>=0)stage.auditProcess++;
      else if(['MENUNGGU ACC AUDITI','MENUNGGU ACC LEAD','MENUNGGU ACC BPM'].indexOf(st)>=0)stage.approval++;
      else if(st==='FINAL')stage.final++;
    });
    const out=serializeValue_(Object.assign({
      enabled:true,ready:true,lastUpdated:now_(),
      cycle:{CycleID:cycle.CycleID||'',NamaSiklus:cycle.NamaSiklus||'AMI 2026',Tahun:cycle.Tahun||'2026',TahunAkademik:cycle.TahunAkademik||'',TanggalMulai:cycle.TanggalMulai||'',BatasEvaluasiDiri:cycle.BatasEvaluasiDiri||'',DeskStart:cycle.DeskStart||'',DeskEnd:cycle.DeskEnd||'',VisitStart:cycle.VisitStart||'',VisitEnd:cycle.VisitEnd||''},
      totalAudits:audits.length,finalAudits:audits.filter(function(a){return cleanText_(a.Status)==='FINAL';}).length,
      averageProgress:analytics.auditRows.length?Math.round(analytics.auditRows.reduce(function(s,x){return s+x.Progress;},0)/analytics.auditRows.length):0,
      pendingApproval:stage.approval,
      finalReports:allReports.filter(function(r){return auditIds.has(cleanText_(r.AuditID))&&cleanText_(r.Status)==='FINAL';}).length,
      stageCounts:stage,
      prodiCount:getAllRows_('MASTER_PRODI').filter(function(r){return bool_(r.Active);}).length,
      auditorCount:getAllRows_('MASTER_AUDITOR').filter(function(r){return bool_(r.Active);}).length,
      standardCount:getAllRows_('MASTER_STANDAR').filter(function(r){return bool_(r.Active);}).length
    },analytics));
    try{cache.put(key,JSON.stringify(out),Number(AMI_CONFIG.PUBLIC_DASHBOARD_CACHE_SECONDS)||90);}catch(ignore){}
    return out;
  }catch(e){
    return{enabled:true,ready:false,lastUpdated:'',cycle:{NamaSiklus:'AMI 2026'},totalAudits:0,finalAudits:0,averageProgress:0,pendingApproval:0,finalReports:0,findingCounts:{MENYIMPANG:0,'BELUM MENCAPAI':0,MENCAPAI:0,MELAMPAUI:0},resultTotal:0,overallFulfillmentPct:0,prodiResults:[],standardPerformance:[],stageCounts:{preparation:0,selfEvaluation:0,auditProcess:0,approval:0,final:0},message:'Database AMI belum selesai dikonfigurasi: '+(e&&e.message?e.message:e)};
  }
}

function exportGoogleDocBlob_(docId,mime,fileName){
  const format=mime==='application/pdf'?'pdf':'docx';
  const url='https://docs.google.com/document/d/'+encodeURIComponent(docId)+'/export?format='+format;
  let last=0,text='';
  for(let i=1;i<=3;i++){
    const res=UrlFetchApp.fetch(url,{method:'get',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},followRedirects:true,muteHttpExceptions:true});
    last=res.getResponseCode();text=res.getContentText();
    if(last>=200&&last<300){const b=res.getBlob().setName(fileName);if(b.getBytes().length>100)return b;}
    Utilities.sleep(400*i);
  }
  throw new Error('Ekspor '+format.toUpperCase()+' gagal. HTTP '+last+' '+String(text).substring(0,180));
}

function systemSelfTest_(){
  const ss=db_(),checks=[];
  function add(name,ok,detail){checks.push({name:name,ok:!!ok,detail:detail||''});}

  // 1) Struktur database final: bukan hanya nama sheet, tetapi seluruh header wajib.
  const structure=validateDatabaseStructure_(ss);
  add('Struktur database final lengkap',structure.ok,structure.ok?'Semua sheet dan header wajib tersedia.':structure.errors.join(' | '));
  Object.keys(SHEET_DEFS).forEach(function(n){add('Sheet '+n,!!ss.getSheetByName(n));});

  // 2) Zona waktu harus konsisten agar ApprovalAt dan laporan tidak bergeser.
  const scriptTz=Session.getScriptTimeZone(),sheetTz=ss.getSpreadsheetTimeZone();
  add('Timezone Apps Script = '+AMI_CONFIG.TIMEZONE,scriptTz===AMI_CONFIG.TIMEZONE,'Terbaca: '+scriptTz);
  add('Timezone Spreadsheet = '+AMI_CONFIG.TIMEZONE,sheetTz===AMI_CONFIG.TIMEZONE,'Terbaca: '+sheetTz);

  // 3) Seed standar dan API final yang dipakai frontend harus benar-benar tersedia.
  const seedCodes=AMI_STANDARD_SEED.map(function(x){return x.ItemCode;}),unique=new Set(seedCodes);
  add('130 butir seed standar',AMI_STANDARD_SEED.length===Number(AMI_CONFIG.EXPECTED_STANDARD_SEED_COUNT||130),'Terbaca: '+AMI_STANDARD_SEED.length);
  add('Kode seed standar unik',unique.size===seedCodes.length,'Unik: '+unique.size+' / '+seedCodes.length);
  const criticalApi={
    saveAllSelfEvaluation:typeof saveAllSelfEvaluation==='function',
    saveEvidenceLinksBatch:typeof saveEvidenceLinksBatch==='function',
    saveAllDeskEvaluation:typeof saveAllDeskEvaluation==='function',
    saveAllVisitForms:typeof saveAllVisitForms==='function',
    saveAllFindings:typeof saveAllFindings==='function',
    saveAllAuditiFollowUps:typeof saveAllAuditiFollowUps==='function',
    saveAuditTeamsBatch:typeof saveAuditTeamsBatch==='function',
    saveTeamsAndPublishBatch:typeof saveTeamsAndPublishBatch==='function',
    createResumeKey:typeof createResumeKey==='function',
    resumeSession:typeof resumeSession==='function',
    getAmiReportPreview:typeof getAmiReportPreview==='function',
    generateAmiFinalReport:typeof generateAmiFinalReport==='function',
    listReports:typeof listReports==='function',
    upgradeSchemaFinal:typeof upgradeSchemaFinal==='function',
    getResetAllTestDataPreview:typeof getResetAllTestDataPreview==='function',
    resetAllTestData:typeof resetAllTestData==='function'
  };
  const missingApi=Object.keys(criticalApi).filter(function(k){return !criticalApi[k];});
  add('API workflow final lengkap',missingApi.length===0,missingApi.length?'Tidak ditemukan: '+missingApi.join(', '):Object.keys(criticalApi).length+' API utama tersedia.');

  // 4) Template DOCX resmi yang tertanam harus utuh dan hash-nya cocok.
  try{
    const templateBytes=Utilities.base64Decode(R3_TEMPLATE_B64_);
    const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,templateBytes);
    const hash=digest.map(function(b){return('0'+((b<0?b+256:b).toString(16))).slice(-2);}).join('');
    add('Template laporan resmi tertanam',templateBytes.length>10000,'Ukuran: '+templateBytes.length+' byte');
    add('Hash template laporan resmi cocok',hash===R31_TEMPLATE_SHA256_,'SHA-256: '+hash);

    // Regression test bug preview 3 Sep 2026: sel template BAB 2/3/4 dan lampiran
    // kosong tidak memiliki <w:t>, sehingga data dahulu tidak pernah tertulis.
    const parts=r3TemplateParts_(),docXml=parts['word/document.xml'].getDataAsString(),reportTables=r3TableBlocks_(docXml);
    let blankPatchOk=false;
    if(reportTables.length>=13){
      const resultRows=r3RowBlocks_(reportTables[7]);
      if(resultRows.length>1){
        const patchedRow=r3SetRowCellText_(resultRows[1],1,'AMI_DATA_CELL_TEST');
        blankPatchOk=patchedRow.indexOf('AMI_DATA_CELL_TEST')>=0&&patchedRow.indexOf('<w:t')>=0;
      }
    }
    add('Template laporan dapat mengisi sel kosong BAB 2/3/4',blankPatchOk,'Tabel template terbaca: '+reportTables.length);

    let programVisibleOk=false;
    if(reportTables.length>=13){
      const programRows=r3RowBlocks_(reportTables[12]);
      if(programRows.length>4){
        const patchedPurpose=r3SetRowCellText_(programRows[4],0,'AMI_PROGRAM_PURPOSE_TEST');
        programVisibleOk=patchedPurpose.indexOf('AMI_PROGRAM_PURPOSE_TEST')>=0&&patchedPurpose.indexOf('w:val="FFFFFF"')<0;
      }
    }
    add('Program Kerja dapat menampilkan teks pada placeholder tersembunyi',programVisibleOk,'Uji Tentatif/Tujuan/Langkah Kerja template.');
  }catch(e){add('Template laporan resmi',false,e&&e.message?e.message:String(e));}

  // 5) Admin dan integritas relasi aktual.
  const admin=getAllRows_('USERS').find(function(r){return normalizeUsername_(r.Username)==='admin';});
  add('Admin aktif dan memiliki password',!!admin&&bool_(admin.Active)&&!!cleanText_(admin.PasswordHash)&&!!cleanText_(admin.Salt));
  const integrity=dataIntegrityChecks_();integrity.checks.forEach(function(x){checks.push(x);});

  // 6) Uji izin Google Docs/Drive serta jalur ekspor Word dan PDF.
  let testDocId='';
  try{
    const d=DocumentApp.create('AMI 2026 - SELF TEST '+new Date().getTime());
    testDocId=d.getId();d.getBody().appendParagraph('AMI 2026 self test');d.saveAndClose();
    const docx=exportGoogleDocBlob_(testDocId,'application/vnd.openxmlformats-officedocument.wordprocessingml.document','self-test.docx');
    const pdf=exportGoogleDocBlob_(testDocId,'application/pdf','self-test.pdf');
    add('Google Docs dan ekspor Word',docx.getBytes().length>100,'DOCX '+docx.getBytes().length+' byte');
    add('Ekspor PDF',pdf.getBytes().length>100,'PDF '+pdf.getBytes().length+' byte');
  }catch(e){add('Google Docs / Word / PDF',false,e&&e.message?e.message:String(e));}
  finally{if(testDocId){try{DriveApp.getFileById(testDocId).setTrashed(true);}catch(ignore){}}}

  return serializeValue_({
    ok:checks.every(function(x){return x.ok;}),
    database:ss.getName(),databaseId:ss.getId(),version:AMI_CONFIG.VERSION,
    scriptTimezone:scriptTz,spreadsheetTimezone:sheetTz,checks:checks
  });
}

function runSystemSelfTest(token){requireRole_(token,['ADMIN_BPM']);return systemSelfTest_();}


function ieVisitTimeText_(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, AMI_CONFIG.TIMEZONE, 'HH:mm');
  }

  if (typeof value === 'number' && isFinite(value)) {
    var frac = value - Math.floor(value);
    if (frac < 0) frac += 1;
    var total = Math.round(frac * 24 * 60) % 1440;
    return ('0' + Math.floor(total / 60)).slice(-2) + ':' +
      ('0' + (total % 60)).slice(-2);
  }

  var text = String(value).trim();
  if (!text) return '';

  var m = text.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return text;

  return ('0' + Number(m[1])).slice(-2) + ':' +
    ('0' + Number(m[2])).slice(-2);
}

function ieWriteVisitTimeText_(rowNumber, fieldName, value) {
  if (!rowNumber) return;
  var h = headers_('VISIT'), idx = h.indexOf(fieldName);
  if (idx < 0) return;
  var cell = sheet_('VISIT').getRange(Number(rowNumber), idx + 1);
  cell.setNumberFormat('@');
  var text = ieVisitTimeText_(value);
  if (!text) {
    cell.clearContent();
    return;
  }
  cell.setRichTextValue(
    SpreadsheetApp.newRichTextValue().setText(text).build()
  );
}

/**
 * ImportExportService.gs — AMI 2026
 * Import / Export XLSX terkontrol per modul.
 * Tidak menulis database mentah tanpa validasi workflow.
 */

var IE_XLSX_MIME_ = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
var IE_GSHEET_MIME_ = 'application/vnd.google-apps.spreadsheet';
var IE_CACHE_PREFIX_ = 'AMI_IE_IMPORT_';
var IE_CACHE_SECONDS_ = 1800;
var IE_VALIDATE_CACHE_ = null;

function ieModuleDefs_(){
  return {
    MASTER_PRODI:{label:'Master Prodi',context:'NONE',admin:true,columns:['KodeProdi','NamaProdi','Fakultas','Jenjang','Kaprodi','NIDN','Active']},
    MASTER_UNIT:{label:'Master Unit/Biro',context:'NONE',admin:true,columns:['KodeUnit','NamaUnit','JenisUnit','Pimpinan','Active']},
    MASTER_AUDITOR:{label:'Master Auditor',context:'NONE',admin:true,columns:['NIDN_NIK','Nama','Unit','Sertifikasi','Active']},
    MASTER_PIMPINAN:{label:'Master Pimpinan',context:'NONE',admin:true,columns:['Nama','Jabatan','Level','AreaAkses','Active']},
    MASTER_STANDAR:{label:'Master Standar',context:'NONE',admin:true,columns:['ItemCode','Kelompok','KodeKelompokStandar','NamaStandar','NoSumber','PernyataanStandar','StrategiPencapaian','Indikator','TahunBerlakuMulai','Versi','StatusStandar','SumberFile','TahunSumber','HalamanPDFMulai','HalamanPDFAkhir','Notes']},
    SIKLUS:{label:'Siklus AMI',context:'NONE',admin:true,columns:['NamaSiklus','Tahun','TahunAkademik','TanggalMulai','BatasEvaluasiDiri','DeskStart','DeskEnd','VisitStart','VisitEnd','Status','Active']},
    PENETAPAN_STANDAR:{label:'Penetapan Auditi & Standar',context:'CYCLE',admin:true,columns:['AuditiType','KodeAuditi','NamaAuditi','ItemCode','VersiStandar','Active']},
    TIM_AUDITOR:{label:'Tim Auditor',context:'CYCLE',admin:true,columns:['AuditiType','KodeAuditi','NamaAuditi','LeadNIDN_NIK','Anggota1NIDN_NIK','Anggota2NIDN_NIK']},
    EVALUASI_DIRI:{label:'Evaluasi Diri + Tindak Lanjut + Peningkatan + Link Bukti',context:'AUDIT',roles:['AUDITI'],columns:['ItemCode','VersiStandar','NamaStandar','PernyataanStandar','Indikator','Capaian','NilaiAktual','EvaluasiDiri','Akibat','AkarPenyebab','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','FaktorPendukung','RekomendasiPeningkatanIndikator','LinkBukti1','NamaBukti1','LinkBukti2','NamaBukti2','LinkBukti3','NamaBukti3','LinkBukti4','NamaBukti4','LinkBukti5','NamaBukti5']},
    DESK_EVALUATION:{label:'Desk Evaluation Terintegrasi',context:'AUDIT',roles:['AUDITOR'],columns:['ItemCode','VersiStandar','NamaStandar','PernyataanStandar','Indikator','CapaianAuditi','NilaiAktualAuditi','EvaluasiDiriAuditi','AkibatAuditi','AkarPenyebabAuditi','TanggapanAuditiAwal','RencanaPerbaikanAwal','JadwalPerbaikanAwal','PJPerbaikanAwal','RencanaPencegahanAwal','JadwalPencegahanAwal','PJPencegahanAwal','FaktorPendukungAuditi','RekomendasiPeningkatanAuditi','StatusDesk','CatatanDesk','ButuhVisitasi']},
    VISITASI:{label:'Visitasi',context:'AUDIT',roles:['AUDITOR'],columns:['Tanggal','JamMulai','JamSelesai','Lokasi','WakilAuditi','CatatanUmum']},
    FORM2:{label:'Form 2 — Program Kerja Audit',context:'AUDIT',roles:['AUDITOR'],columns:['ProgramNo','NomorStandar','NamaStandar','TentatifAuditObjektif','TujuanAudit','LangkahNo','UraianLangkah','Estimasi','NoPernyataan','Realisasi','InisialAuditor']},
    FORM3:{label:'Form 3 — Catatan Audit',context:'AUDIT',roles:['AUDITOR'],columns:['CatatanNo','Catatan','Tanggal','ReferensiNo','DokumenRef']},
    HASIL_AUDIT:{label:'Hasil Audit / Aksi Auditor',context:'AUDIT',roles:['AUDITOR'],columns:['ItemCode','VersiStandar','NamaStandar','PernyataanStandar','Indikator','StatusDesk','CatatanDesk','ButuhVisitasi','CapaianAuditi','NilaiAktualAuditi','EvaluasiDiriAuditi','Kategori','Deskripsi','Kriteria','Akibat','AkarPenyebab','Rekomendasi','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','FaktorPendukung','RekomendasiPeningkatanIndikator']},
    TINDAK_LANJ:{label:'Tindak Lanjut Auditi',context:'AUDIT',roles:['AUDITI'],columns:['ItemCode','VersiStandar','NamaStandar','Kategori','Deskripsi','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan']},
    AUDIT_REKAP:{label:'Rekap Lengkap Satu Audit',context:'AUDIT',exportOnly:true,columns:[]},
    AUDIT_LOG:{label:'Audit Log',context:'NONE',admin:true,exportOnly:true,columns:['Timestamp','Nama','Role','Action','Module','AuditID','RecordID','BeforeJSON','AfterJSON']},
    ERROR_LOG:{label:'Error Log',context:'NONE',admin:true,exportOnly:true,columns:['Timestamp','Username','Role','FunctionName','Message','Stack','ContextJSON']}
  };
}

function ieClean_(v){return cleanText_(v);}
function ieForm2Programs_(form2){
  form2=form2||{};var raw=parseJson_(form2.LangkahJSON,[])||[];
  if(typeof wfNormalizeProgramForms_==='function')return wfNormalizeProgramForms_(raw,form2);
  return raw.map(function(x,i){x=x||{};var ls=Array.isArray(x.langkahKerja)?x.langkahKerja:[];if(!ls.length&&(x.uraian||x.estimasi||x.noPernyataan||x.realisasi||x.inisialAuditor))ls=[{rowId:'XLSX_LEGACY_F2L_'+(i+1),uraian:x.uraian||'',estimasi:x.estimasi||'',noPernyataan:x.noPernyataan||'',realisasi:x.realisasi||'',inisialAuditor:x.inisialAuditor||''}];return {rowId:x.rowId||('XLSX_LEGACY_F2_'+(i+1)),nomorStandar:x.nomorStandar||'',namaStandar:x.namaStandar||'',tentatifAuditObjektif:x.tentatifAuditObjektif||(i===0?form2.TentatifAuditObjektif||'':''),tujuanAudit:x.tujuanAudit||(i===0?form2.TujuanAudit||'':''),langkahKerja:ls};});
}
function ieForm3Notes_(form3){
  form3=form3||{};var raw=parseJson_(form3.CatatanJSON,[])||[];if(typeof wfNormalizeAuditNotes_==='function')return wfNormalizeAuditNotes_(raw);
  return raw.map(function(x,i){x=x||{};var refs=Array.isArray(x.dokumenReferensi)?x.dokumenReferensi:(x.dokumenRef?[{rowId:'XLSX_LEGACY_F3R_'+(i+1),dokumenRef:x.dokumenRef}]:[]);return {rowId:x.rowId||('XLSX_LEGACY_F3_'+(i+1)),catatan:x.catatan||'',tanggal:x.tanggal||'',dokumenReferensi:refs};});
}
function ieUpper_(v){return ieClean_(v).toUpperCase();}
function ieNormCategory_(v){
  var x=ieUpper_(v)
    .replace(/_/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  if(x==='MENYIMPANG')return 'MENYIMPANG';
  if(x==='BELUM MENCAPAI')return 'BELUM MENCAPAI';
  if(x==='MENCAPAI')return 'MENCAPAI';
  if(x==='MELAMPAUI')return 'MELAMPAUI';

  return '';
}
function ieBool_(v,def){
  var s=ieUpper_(v);
  if(!s)return def!==false;
  return ['TRUE','1','YA','YES','IYA','AKTIF'].indexOf(s)>=0;
}
function ieUrlOk_(v){
  var s=ieClean_(v);
  return !s || /^https?:\/\//i.test(s);
}
function ieModule_(module){
  module=ieUpper_(module);
  var d=ieModuleDefs_()[module];
  if(!d)throw new Error('Modul Import/Export tidak dikenali: '+module);
  return {key:module,def:d};
}

function ieAccessibleAudits_(u){
  var audits=getAllRows_('AMI_AUDITI'),role=ieUpper_(u.Role);
  if(role==='ADMIN_BPM')return audits;
  if(role==='AUDITI')return audits.filter(function(a){return ieClean_(a.AuditiType)===ieClean_(u.RefType)&&ieClean_(a.AuditiID)===ieClean_(u.RefID);});
  if(role==='AUDITOR'){
    var ids={};
    getAllRows_('AMI_TEAM').forEach(function(t){
      if([t.LeadAuditorID,t.Member1ID,t.Member2ID].map(ieClean_).indexOf(ieClean_(u.RefID))>=0)ids[ieClean_(t.AuditID)]=true;
    });
    return audits.filter(function(a){return !!ids[ieClean_(a.AuditID)];});
  }
  if(role==='PIMPINAN'&&typeof isAuditInPimpinanScope_==='function')return audits.filter(function(a){return isAuditInPimpinanScope_(u,a);});
  return [];
}

function ieAssertAuditAccess_(u,auditId,importRole){
  var a=findOne_('AMI_AUDITI','AuditID',auditId);
  if(!a)throw new Error('Audit tidak ditemukan.');
  var role=ieUpper_(u.Role);
  if(importRole&&role!==importRole)throw new Error('Import modul ini hanya dapat dilakukan oleh '+importRole+'.');
  var ok=ieAccessibleAudits_(u).some(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);});
  if(!ok)throw new Error('Anda tidak memiliki akses ke audit tersebut.');
  return a;
}

function getImportExportCatalog(token){
  var u=session_(token),role=ieUpper_(u.Role),defs=ieModuleDefs_(),mods=[];
  Object.keys(defs).forEach(function(k){
    var d=defs[k],visible=false,canImport=!d.exportOnly;
    if(d.admin){visible=role==='ADMIN_BPM';canImport=visible&&!d.exportOnly;}
    else if(d.roles){visible=d.roles.indexOf(role)>=0||role==='ADMIN_BPM'||role==='PIMPINAN';canImport=d.roles.indexOf(role)>=0&&!d.exportOnly;}
    else visible=true;
    if(k==='AUDIT_REKAP')visible=true;
    if(!visible)return;
    mods.push({key:k,label:d.label,context:d.context,canImport:!!canImport,canExport:true,exportOnly:!!d.exportOnly});
  });
  var audits=ieAccessibleAudits_(u).map(function(a){return {AuditID:a.AuditID,AuditiName:a.AuditiName,AuditiType:a.AuditiType,Jenjang:a.Jenjang,Status:a.Status,CycleID:a.CycleID,label:(a.AuditiName||a.AuditID)+' — '+(a.Status||'')};});
  var cycles=[];
  if(role==='ADMIN_BPM')cycles=getAllRows_('AMI_CYCLE').map(function(c){return {CycleID:c.CycleID,NamaSiklus:c.NamaSiklus,Tahun:c.Tahun,Status:c.Status,label:(c.NamaSiklus||c.CycleID)+' — '+(c.Status||'')};});
  return serializeValue_({modules:mods,audits:audits,cycles:cycles,role:role});
}

function ieInstruction_(module){
  var notes={
    MASTER_PRODI:'Isi KodeProdi, NamaProdi, Fakultas, Jenjang S1/S2/S3, Kaprodi, NIDN. Active: IYA/TIDAK.',
    MASTER_UNIT:'JenisUnit: BIRO/LEMBAGA/UPT/PUSAT/DIREKTORAT/FAKULTAS/PASCASARJANA/UNIT LAINNYA.',
    MASTER_AUDITOR:'Sertifikasi: IYA/TIDAK. Gelar ditulis langsung pada Nama bila diperlukan. Import berulang dengan NIDN/NIK yang sama akan memperbarui AuditorID lama, bukan membuat auditor baru.',
    MASTER_PIMPINAN:'Level: YAYASAN/UNIVERSITAS/FAKULTAS/PRODI/UNIT. AreaAkses diisi nama/kode area yang sesuai.',
    MASTER_STANDAR:'ItemCode adalah kode resmi buku standar. Standar yang sudah digunakan tidak boleh diubah substansinya; gunakan versi baru.',
    PENETAPAN_STANDAR:'Konteks Siklus wajib dipilih. Import hanya menambah/mengaktifkan penetapan pada audit DRAFT BPM.',
    TIM_AUDITOR:'Gunakan NIDN/NIK auditor. Tim wajib 1 Lead + 2 anggota berbeda. Audit harus DRAFT BPM.',
    EVALUASI_DIRI:'Isi Capaian hanya MENYIMPANG/BELUM MENCAPAI/MENCAPAI/MELAMPAUI. Jika MENYIMPANG/BELUM MENCAPAI, EvaluasiDiri menjadi Deskripsi Temuan dan kolom Akibat, AkarPenyebab, RencanaPerbaikan, JadwalPerbaikan, serta PJPerbaikan wajib. Untuk MENCAPAI/MELAMPAUI, FaktorPendukung dan RekomendasiPeningkatanIndikator wajib. Jadwal berupa teks bebas dan link bukti dapat diisi sampai 5 link per butir.',
    DESK_EVALUATION:'Kolom data Auditi bersifat referensi dan otomatis terisi dari Evaluasi Diri, termasuk Deskripsi Temuan awal (EvaluasiDiri), Akibat, dan AkarPenyebab untuk capaian negatif. Auditor mengisi StatusDesk, CatatanDesk (opsional), dan ButuhVisitasi. Data dapat direvisi sampai hasil audit dikirim untuk persetujuan.',
    HASIL_AUDIT:'Data Auditi dan Desk otomatis dibawa ke file. Untuk hasil negatif, Deskripsi, Akibat, dan AkarPenyebab diprefill dari Evaluasi Diri Prodi; Auditor dapat mengedit bila diperlukan dan menambahkan Rekomendasi Perbaikan Auditor. Tindak lanjut Auditi tetap ikut terbawa dan dapat direvisi sesuai visitasi. Untuk MENCAPAI/MELAMPAUI, FaktorPendukung dan RekomendasiPeningkatanIndikator wajib.',
    TINDAK_LANJ:'Tindak lanjut bersumber dari Evaluasi Diri untuk capaian MENYIMPANG/BELUM MENCAPAI dan tetap dapat disempurnakan setelah hasil Auditor tersedia. Export tidak lagi kosong bila tindak lanjut sudah diisi pada Evaluasi Diri.',
    AUDIT_LOG:'Export saja. Jangan diedit/import.',ERROR_LOG:'Export saja. Jangan diedit/import.'
  };
  return notes[module]||'Gunakan template hasil Export XLSX lalu Import kembali. Jangan mengubah kolom identitas yang bersifat referensi.';
}

function ieApplyValidation_(sh,cols,maxRows){
  function list(col,vals){var i=cols.indexOf(col);if(i<0)return;var rule=SpreadsheetApp.newDataValidation().requireValueInList(vals,true).setAllowInvalid(true).build();sh.getRange(2,i+1,maxRows,1).setDataValidation(rule);}
  list('Jenjang',['S1','S2','S3']);
  list('JenisUnit',AMI_CONFIG.UNIT_TYPES||[]);
  list('Sertifikasi',['IYA','TIDAK']);
  list('Level',AMI_CONFIG.PIMPINAN_LEVELS||[]);
  list('StatusStandar',AMI_CONFIG.STANDARD_STATUSES||[]);
  list('Capaian',AMI_CONFIG.CAPAIAN||[]);
  list('Kategori',AMI_CONFIG.CAPAIAN||[]);
  list('StatusDesk',AMI_CONFIG.DESK_STATUSES||[]);
  list('ButuhVisitasi',['IYA','TIDAK']);
  list('Active',['IYA','TIDAK']);
  list('AuditiType',['PRODI','UNIT']);
  var nilaiIdx=cols.indexOf('NilaiAktual');
  if(nilaiIdx>=0)sh.getRange(2,nilaiIdx+1,maxRows,1).setNumberFormat('@');
  ['JadwalPerbaikan','JadwalPencegahan'].forEach(function(col){
    var i=cols.indexOf(col);
    if(i>=0)sh.getRange(2,i+1,maxRows,1).setNumberFormat('@');
  });
}

function ieExportBlob_(ss,fileName){
  SpreadsheetApp.flush();
  var url='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(ss.getId())+'/export?format=xlsx';
  var resp=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  var code=resp.getResponseCode();
  if(code<200||code>=300)throw new Error('Gagal membuat XLSX ('+code+'): '+resp.getContentText().substring(0,300));
  var blob=resp.getBlob().setName(fileName);
  return {fileName:fileName,mimeType:IE_XLSX_MIME_,base64:Utilities.base64Encode(blob.getBytes())};
}

function ieWorkbookData_(module,u,ctx){
  var def=ieModule_(module),m=def.key,d=def.def,rows=[],readonly=[];
  if(d.admin&&ieUpper_(u.Role)!=='ADMIN_BPM')throw new Error('Modul ini hanya untuk Admin BPM.');
  if(m==='MASTER_PRODI')rows=getAllRows_('MASTER_PRODI').map(function(r){return [r.KodeProdi,r.NamaProdi,r.Fakultas,r.Jenjang,r.Kaprodi,r.NIDN,bool_(r.Active)?'IYA':'TIDAK'];});
  else if(m==='MASTER_UNIT')rows=getAllRows_('MASTER_UNIT').map(function(r){return [r.KodeUnit,r.NamaUnit,r.JenisUnit,r.Pimpinan,bool_(r.Active)?'IYA':'TIDAK'];});
  else if(m==='MASTER_AUDITOR')rows=getAllRows_('MASTER_AUDITOR').map(function(r){return [r.NIDN_NIK,r.Nama,r.Unit,r.Sertifikasi,bool_(r.Active)?'IYA':'TIDAK'];});
  else if(m==='MASTER_PIMPINAN')rows=getAllRows_('MASTER_PIMPINAN').map(function(r){return [r.Nama,r.Jabatan,r.Level,r.AccessName||r.AccessID,bool_(r.Active)?'IYA':'TIDAK'];});
  else if(m==='MASTER_STANDAR')rows=getAllRows_('MASTER_STANDAR').map(function(r){return [r.ItemCode,r.Kelompok,r.KodeKelompokStandar,r.NamaStandar,r.NoSumber,r.PernyataanStandar,r.StrategiPencapaian,r.Indikator,r.TahunBerlakuMulai,r.Versi,r.StatusStandar,r.SumberFile,r.TahunSumber,r.HalamanPDFMulai,r.HalamanPDFAkhir,r.Notes];});
  else if(m==='SIKLUS')rows=getAllRows_('AMI_CYCLE').map(function(r){return [r.NamaSiklus,r.Tahun,r.TahunAkademik,r.TanggalMulai,r.BatasEvaluasiDiri,r.DeskStart,r.DeskEnd,r.VisitStart,r.VisitEnd,r.Status,bool_(r.Active)?'IYA':'TIDAK'];});
  else if(m==='PENETAPAN_STANDAR')rows=ieExportAssignments_(u,ctx.cycleId);
  else if(m==='TIM_AUDITOR')rows=ieExportTeams_(u,ctx.cycleId);
  else if(['EVALUASI_DIRI','DESK_EVALUATION','VISITASI','FORM2','FORM3','HASIL_AUDIT','TINDAK_LANJ'].indexOf(m)>=0)rows=ieExportAuditModuleRows_(m,u,ctx.auditId);
  else if(m==='AUDIT_LOG')rows=getAllRows_('AUDIT_LOG').map(function(r){return [r.Timestamp,r.Nama,r.Role,r.Action,r.Module,r.AuditID,r.RecordID,r.BeforeJSON,r.AfterJSON];});
  else if(m==='ERROR_LOG')rows=getAllRows_('SYSTEM_ERROR_LOG').map(function(r){return [r.Timestamp,r.Username,r.Role,r.FunctionName,r.Message,r.Stack,r.ContextJSON];});
  else throw new Error('Gunakan export rekap khusus untuk modul '+m+'.');
  if(m==='EVALUASI_DIRI')readonly=['ItemCode','VersiStandar','NamaStandar','PernyataanStandar','Indikator'];
  if(m==='DESK_EVALUATION')readonly=['ItemCode','VersiStandar','NamaStandar','PernyataanStandar','Indikator','CapaianAuditi','NilaiAktualAuditi','EvaluasiDiriAuditi','AkibatAuditi','AkarPenyebabAuditi','TanggapanAuditiAwal','RencanaPerbaikanAwal','JadwalPerbaikanAwal','PJPerbaikanAwal','RencanaPencegahanAwal','JadwalPencegahanAwal','PJPencegahanAwal','FaktorPendukungAuditi','RekomendasiPeningkatanAuditi'];
  if(m==='HASIL_AUDIT')readonly=['ItemCode','VersiStandar','NamaStandar','PernyataanStandar','Indikator','StatusDesk','CatatanDesk','ButuhVisitasi','CapaianAuditi','NilaiAktualAuditi','EvaluasiDiriAuditi'];
  if(m==='TINDAK_LANJ')readonly=['ItemCode','VersiStandar','NamaStandar'];
  return {columns:d.columns,rows:rows,readonlyColumns:readonly};
}

function exportXlsxModule(token,module,context){
  var u=session_(token),x=ieModule_(module),ctx=context||{};
  if(x.key==='AUDIT_REKAP')return exportAuditRekapXlsx_(token,ctx.auditId);
  var data=ieWorkbookData_(x.key,u,ctx),ss=null;
  try{
    ss=SpreadsheetApp.create('AMI_TMP_'+x.key+'_'+new Date().getTime());
    var sh=ss.getSheets()[0];sh.setName('DATA');
    sh.getRange(1,1,1,data.columns.length).setValues([data.columns]).setFontWeight('bold').setBackground('#173d6b').setFontColor('#ffffff').setWrap(true);
    if(data.rows.length)sh.getRange(2,1,data.rows.length,data.columns.length).setValues(data.rows);
    sh.setFrozenRows(1);sh.getRange(1,1,Math.max(2,data.rows.length+1),data.columns.length).setWrap(true).setVerticalAlignment('top');
    data.columns.forEach(function(c,i){sh.setColumnWidth(i+1,Math.min(420,Math.max(115,String(c).length*10)));});
    ieApplyValidation_(sh,data.columns,Math.max(200,data.rows.length+100));
    (data.readonlyColumns||[]).forEach(function(c){var ix=data.columns.indexOf(c);if(ix>=0)sh.getRange(2,ix+1,Math.max(1,data.rows.length+100),1).setBackground('#f1f3f5');});
    var note=ss.insertSheet('PETUNJUK');note.getRange(1,1,7,2).setValues([
      ['MODUL',x.def.label],['PETUNJUK',ieInstruction_(x.key)],['IMPORT','Pilih file XLSX ini dari menu Import / Export aplikasi lalu Validasi.'],['VALIDASI','Data tidak langsung ditulis. Sistem menampilkan jumlah valid/error sebelum commit.'],['BUKTI LINK',x.key==='EVALUASI_DIRI'?'Isi LinkBukti1–5 dan NamaBukti1–5. URL harus http/https.':'-'],['APPROVAL','Tidak dapat diimport dari XLSX.'],['WAKTU EXPORT',Utilities.formatDate(new Date(),AMI_CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss')]
    ]);note.getRange('A1:B7').setWrap(true);note.setColumnWidth(1,150);note.setColumnWidth(2,650);note.getRange('A1:B1').setFontWeight('bold').setBackground('#173d6b').setFontColor('#ffffff');
    var fn='AMI_'+x.key+'_'+Utilities.formatDate(new Date(),AMI_CONFIG.TIMEZONE,'yyyyMMdd_HHmm')+'.xlsx';
    return ieExportBlob_(ss,fn);
  }finally{if(ss){try{DriveApp.getFileById(ss.getId()).setTrashed(true);}catch(ignore){}}}
}

function ieExportAssignments_(u,cycleId){
  if(ieUpper_(u.Role)!=='ADMIN_BPM')throw new Error('Hanya Admin BPM.');
  if(!cycleId)throw new Error('Pilih Siklus AMI.');
  var audits=getAllRows_('AMI_AUDITI').filter(function(a){return ieClean_(a.CycleID)===ieClean_(cycleId);});
  var amap={};audits.forEach(function(a){amap[a.AuditID]=a;});
  var prodi={};getAllRows_('MASTER_PRODI').forEach(function(p){prodi[p.ProdiID]=p;});
  var unit={};getAllRows_('MASTER_UNIT').forEach(function(x){unit[x.UnitID]=x;});
  var masters={};getAllRows_('MASTER_STANDAR').forEach(function(s){masters[s.StandardID]=s;});
  return getAllRows_('AMI_STANDARD_ASSIGN').filter(function(x){return amap[x.AuditID]&&bool_(x.Active);}).map(function(x){
    var a=amap[x.AuditID],ref=a.AuditiType==='PRODI'?prodi[a.AuditiID]:unit[a.AuditiID],s=masters[x.StandardID]||{};
    return [a.AuditiType,ref?(ref.KodeProdi||ref.KodeUnit||''):'',a.AuditiName,x.ItemCode||s.ItemCode,s.Versi||x.VersiStandarSnapshot||'1.0','IYA'];
  });
}

function ieExportTeams_(u,cycleId){
  if(ieUpper_(u.Role)!=='ADMIN_BPM')throw new Error('Hanya Admin BPM.');
  if(!cycleId)throw new Error('Pilih Siklus AMI.');
  var audits=getAllRows_('AMI_AUDITI').filter(function(a){return ieClean_(a.CycleID)===ieClean_(cycleId);});
  var teams={};getAllRows_('AMI_TEAM').forEach(function(t){teams[t.AuditID]=t;});
  var aud={};getAllRows_('MASTER_AUDITOR').forEach(function(a){aud[a.AuditorID]=a;});
  var prodi={};getAllRows_('MASTER_PRODI').forEach(function(p){prodi[p.ProdiID]=p;});
  var unit={};getAllRows_('MASTER_UNIT').forEach(function(x){unit[x.UnitID]=x;});
  return audits.map(function(a){var t=teams[a.AuditID]||{},ref=a.AuditiType==='PRODI'?prodi[a.AuditiID]:unit[a.AuditiID];return [a.AuditiType,ref?(ref.KodeProdi||ref.KodeUnit||''):'',a.AuditiName,aud[t.LeadAuditorID]?aud[t.LeadAuditorID].NIDN_NIK:'',aud[t.Member1ID]?aud[t.Member1ID].NIDN_NIK:'',aud[t.Member2ID]?aud[t.Member2ID].NIDN_NIK:''];});
}

function ieAuditMaps_(auditId){
  var assigns=getAllRows_('AMI_STANDARD_ASSIGN').filter(function(a){
    return ieClean_(a.AuditID)===ieClean_(auditId)&&bool_(a.Active);
  });

  var masters={};
  getAllRows_('MASTER_STANDAR').forEach(function(s){
    masters[s.StandardID]=s;
  });

  var selfs={};
  var selfsByStandard={};

  getAllRows_('SELF_EVAL')
    .filter(function(x){
      return ieClean_(x.AuditID)===ieClean_(auditId);
    })
    .forEach(function(x){
      var aid=ieClean_(x.AssignID);
      var sid=ieClean_(x.StandardID);

      if(aid)selfs[aid]=x;

      // Fallback untuk data hasil import versi lama / relasi AssignID berubah.
      if(sid){
        var old=selfsByStandard[sid];

        // Utamakan record yang sudah memiliki Capaian/EvaluasiDiri.
        if(
          !old ||
          (
            !ieNormCategory_(old.Capaian) &&
            ieNormCategory_(x.Capaian)
          ) ||
          (
            !ieClean_(old.EvaluasiDiri) &&
            ieClean_(x.EvaluasiDiri)
          )
        ){
          selfsByStandard[sid]=x;
        }
      }
    });

  var desks={};
  getAllRows_('DESK_EVAL')
    .filter(function(x){
      return ieClean_(x.AuditID)===ieClean_(auditId);
    })
    .forEach(function(x){
      desks[ieClean_(x.AssignID)]=x;
    });

  var finds={};
  var findsByStandard={};

  getAllRows_('FINDINGS')
    .filter(function(x){
      return ieClean_(x.AuditID)===ieClean_(auditId);
    })
    .forEach(function(x){
      var aid=ieClean_(x.AssignID);
      var sid=ieClean_(x.StandardID);

      if(aid)finds[aid]=x;
      if(sid)findsByStandard[sid]=x;
    });

  var ev={};
  getAllRows_('EVIDENCE')
    .filter(function(x){
      return ieClean_(x.AuditID)===ieClean_(auditId);
    })
    .forEach(function(x){
      var k=ieClean_(x.StandardID);
      if(!ev[k])ev[k]=[];
      ev[k].push(x);
    });

  return {
    assigns:assigns,
    masters:masters,
    selfs:selfs,
    selfsByStandard:selfsByStandard,
    desks:desks,
    finds:finds,
    findsByStandard:findsByStandard,
    evidence:ev
  };
}

function ieExportAuditModuleRows_(module,u,auditId){
  var audit=ieAssertAuditAccess_(u,auditId),m=ieAuditMaps_(auditId),rows=[];
  if(module==='EVALUASI_DIRI'){
    var sfmEval=typeof wfSelfFollowUpMap_==='function'?wfSelfFollowUpMap_(auditId):{};
    var impEval=typeof wfImprovementMap_==='function'?wfImprovementMap_(auditId):{};
    m.assigns.forEach(function(a){
      var s=m.masters[a.StandardID]||{},se=m.selfs[a.AssignID]||{},sf=sfmEval[a.AssignID]||{},imp=impEval[a.AssignID]||{},links=(m.evidence[a.StandardID]||[]).filter(function(e){return ieUpper_(e.JenisBukti)==='LINK';}).slice(0,5);
      var selfCat=ieNormCategory_(se.Capaian),selfNeg=['MENYIMPANG','BELUM MENCAPAI'].indexOf(selfCat)>=0,selfPos=['MENCAPAI','MELAMPAUI'].indexOf(selfCat)>=0;
      var r=[
        a.ItemCode||s.ItemCode,
        s.Versi||a.VersiStandarSnapshot||'1.0',
        a.NamaStandar||s.NamaStandar,
        a.PernyataanStandarSnapshot||s.PernyataanStandar,
        a.IndikatorSnapshot||s.Indikator,
        se.Capaian,
        se.NilaiCapaian,
        se.EvaluasiDiri,
        selfNeg?(se.Akibat||''):'',
        selfNeg?(se.AkarPenyebab||''):'',
        selfNeg?(sf.TanggapanAuditi||''):'',
        selfNeg?(sf.RencanaPerbaikan||''):'',
        selfNeg?(sf.JadwalPerbaikan||''):'',
        selfNeg?(sf.PJPerbaikan||''):'',
        selfNeg?(sf.RencanaPencegahan||''):'',
        selfNeg?(sf.JadwalPencegahan||''):'',
        selfNeg?(sf.PJPencegahan||''):'',
        selfPos?(imp.FaktorPendukung||''):'',
        selfPos?(imp.RekomendasiPeningkatanIndikator||''):''
      ];
      for(var i=0;i<5;i++){r.push(links[i]?links[i].URL:'');r.push(links[i]?links[i].NamaBukti:'');}
      rows.push(r);
    });
  }
  else if(module==='DESK_EVALUATION'){
    var sfDesk=typeof wfSelfFollowUpMap_==='function'?wfSelfFollowUpMap_(auditId):{};
    var impDesk=typeof wfImprovementMap_==='function'?wfImprovementMap_(auditId):{};
    m.assigns.forEach(function(a){
      var s=m.masters[a.StandardID]||{},se=m.selfs[a.AssignID]||{},sf=sfDesk[a.AssignID]||{},imp=impDesk[a.AssignID]||{},d=m.desks[a.AssignID]||{};
      var deskSelfCat=ieNormCategory_(se.Capaian),deskSelfNeg=['MENYIMPANG','BELUM MENCAPAI'].indexOf(deskSelfCat)>=0,deskSelfPos=['MENCAPAI','MELAMPAUI'].indexOf(deskSelfCat)>=0;
      rows.push([
        a.ItemCode||s.ItemCode,
        s.Versi||a.VersiStandarSnapshot||'1.0',
        a.NamaStandar||s.NamaStandar,
        a.PernyataanStandarSnapshot||s.PernyataanStandar,
        a.IndikatorSnapshot||s.Indikator,
        se.Capaian||'',
        se.NilaiCapaian||'',
        se.EvaluasiDiri||'',
        deskSelfNeg?(se.Akibat||''):'',
        deskSelfNeg?(se.AkarPenyebab||''):'',
        deskSelfNeg?(sf.TanggapanAuditi||''):'',
        deskSelfNeg?(sf.RencanaPerbaikan||''):'',
        deskSelfNeg?(sf.JadwalPerbaikan||''):'',
        deskSelfNeg?(sf.PJPerbaikan||''):'',
        deskSelfNeg?(sf.RencanaPencegahan||''):'',
        deskSelfNeg?(sf.JadwalPencegahan||''):'',
        deskSelfNeg?(sf.PJPencegahan||''):'',
        deskSelfPos?(imp.FaktorPendukung||''):'',
        deskSelfPos?(imp.RekomendasiPeningkatanIndikator||''):'',
        d.StatusDesk||'',
        d.CatatanDesk||'',
        bool_(d.ButuhVisitasi)?'IYA':'TIDAK'
      ]);
    });
  }
  else if(module==='VISITASI'){var v=findOne_('VISIT','AuditID',auditId)||{};rows.push([v.Tanggal,ieVisitTimeText_(v.JamMulai),ieVisitTimeText_(v.JamSelesai),v.Lokasi,v.WakilAuditi,v.CatatanUmum]);}
  else if(module==='FORM2'){
    var f2=findOne_('FORM2_PROGRAM_KERJA','AuditID',auditId)||{},programs=ieForm2Programs_(f2);
    if(!programs.length)programs=[{langkahKerja:[]}];
    programs.forEach(function(p,pi){var ls=Array.isArray(p.langkahKerja)?p.langkahKerja:[];if(!ls.length)ls=[{}];ls.forEach(function(x,li){rows.push([pi+1,p.nomorStandar||'',p.namaStandar||'',p.tentatifAuditObjektif||'',p.tujuanAudit||'',li+1,x.uraian||'',x.estimasi||'',x.noPernyataan||'',x.realisasi||'',x.inisialAuditor||'']);});});
  }
  else if(module==='FORM3'){
    var f3=findOne_('FORM3_CATATAN','AuditID',auditId)||{},notes=ieForm3Notes_(f3);if(!notes.length)notes=[{dokumenReferensi:[]}];
    notes.forEach(function(x,ni){var refs=Array.isArray(x.dokumenReferensi)?x.dokumenReferensi:[];if(!refs.length)refs=[{}];refs.forEach(function(r,ri){rows.push([ni+1,x.catatan||'',x.tanggal||'',ri+1,r.dokumenRef||'']);});});
  }
  else if(module==='HASIL_AUDIT'){
    var sfH=typeof wfSelfFollowUpMap_==='function'?wfSelfFollowUpMap_(auditId):{};
    var impH=typeof wfImprovementMap_==='function'?wfImprovementMap_(auditId):{};
    m.assigns.forEach(function(a){
      var s=m.masters[a.StandardID]||{},se=m.selfs[a.AssignID]||{},d=m.desks[a.AssignID]||{},f=m.finds[a.AssignID]||{},sf=sfH[a.AssignID]||{},imp=impH[a.AssignID]||{};
      var finalKat=ieNormCategory_(f.Kategori);
      var selfKat=ieNormCategory_(se.Capaian);
      var initialKat=finalKat||(ieUpper_(d.StatusDesk)==='SESUAI'?selfKat:'');
      var selfNegH=['MENYIMPANG','BELUM MENCAPAI'].indexOf(selfKat)>=0;
      var neg=finalKat ? ['MENYIMPANG','BELUM MENCAPAI'].indexOf(finalKat)>=0 : selfNegH;
      rows.push([
        a.ItemCode||s.ItemCode,
        s.Versi||a.VersiStandarSnapshot||'1.0',
        a.NamaStandar||s.NamaStandar,
        a.PernyataanStandarSnapshot||s.PernyataanStandar,
        a.IndikatorSnapshot||s.Indikator,
        d.StatusDesk||'',
        d.CatatanDesk||'',
        bool_(d.ButuhVisitasi)?'IYA':'TIDAK',
        se.Capaian||'',
        se.NilaiCapaian||'',
        se.EvaluasiDiri||'',
        initialKat,
        f.Deskripsi||(selfNegH?se.EvaluasiDiri||'':(ieUpper_(d.StatusDesk)==='SESUAI'?se.EvaluasiDiri||'':'')),
        f.Kriteria||a.PernyataanStandarSnapshot||s.PernyataanStandar||'',
        f.Akibat||(selfNegH?se.Akibat||'':''),
        f.AkarPenyebab||(selfNegH?se.AkarPenyebab||'':''),
        f.Rekomendasi||'',
        neg?(f.TanggapanAuditi||sf.TanggapanAuditi||''):'',
        neg?(f.RencanaPerbaikan||sf.RencanaPerbaikan||''):'',
        neg?(f.JadwalPerbaikan||sf.JadwalPerbaikan||''):'',
        neg?(f.PJPerbaikan||sf.PJPerbaikan||''):'',
        neg?(f.RencanaPencegahan||sf.RencanaPencegahan||''):'',
        neg?(f.JadwalPencegahan||sf.JadwalPencegahan||''):'',
        neg?(f.PJPencegahan||sf.PJPencegahan||''):'',
        ['MENCAPAI','MELAMPAUI'].indexOf(initialKat)>=0?(imp.FaktorPendukung||''):'',
        ['MENCAPAI','MELAMPAUI'].indexOf(initialKat)>=0?(imp.RekomendasiPeningkatanIndikator||''):''
      ]);
    });
  }
  else if(module==='TINDAK_LANJ'){
    var sfm=
      typeof wfSelfFollowUpMap_==='function'
        ? wfSelfFollowUpMap_(auditId)
        : {};

    var sfByStandard={};

    try{
      if(db_().getSheetByName('SELF_FOLLOW_UP')){
        getAllRows_('SELF_FOLLOW_UP')
          .filter(function(x){
            return ieClean_(x.AuditID)===ieClean_(auditId);
          })
          .forEach(function(x){
            var sid=ieClean_(x.StandardID);
            if(sid)sfByStandard[sid]=x;
          });
      }
    }catch(ignoreFollowSheet){
      sfByStandard={};
    }

    m.assigns.forEach(function(a){
      var sid=ieClean_(a.StandardID);

      var std=
        m.masters[a.StandardID]||{};

      var se=
        m.selfs[ieClean_(a.AssignID)]||
        m.selfsByStandard[sid]||
        {};

      var f=
        m.finds[ieClean_(a.AssignID)]||
        m.findsByStandard[sid]||
        {};

      var sf=
        sfm[ieClean_(a.AssignID)]||
        sfByStandard[sid]||
        {};

      var finalKat=ieNormCategory_(f.Kategori);
      var selfKat=ieNormCategory_(se.Capaian);

      // Hasil Auditor menjadi sumber utama bila sudah ada.
      // Bila belum, Evaluasi Diri Auditi menjadi sumber.
      var kat=finalKat||selfKat;

      if(
        ['MENYIMPANG','BELUM MENCAPAI'].indexOf(kat)<0
      ){
        return;
      }

      rows.push([
        a.ItemCode||std.ItemCode,
        std.Versi||a.VersiStandarSnapshot||'1.0',
        a.NamaStandar||std.NamaStandar,
        kat,

        ieClean_(f.Deskripsi)||
        ieClean_(se.EvaluasiDiri)||
        '',

        ieClean_(f.TanggapanAuditi)||
        ieClean_(sf.TanggapanAuditi)||
        '',

        ieClean_(f.RencanaPerbaikan)||
        ieClean_(sf.RencanaPerbaikan)||
        '',

        ieClean_(f.JadwalPerbaikan)||
        ieClean_(sf.JadwalPerbaikan)||
        '',

        ieClean_(f.PJPerbaikan)||
        ieClean_(sf.PJPerbaikan)||
        '',

        ieClean_(f.RencanaPencegahan)||
        ieClean_(sf.RencanaPencegahan)||
        '',

        ieClean_(f.JadwalPencegahan)||
        ieClean_(sf.JadwalPencegahan)||
        '',

        ieClean_(f.PJPencegahan)||
        ieClean_(sf.PJPencegahan)||
        ''
      ]);
    });
  }

  return rows;
}

function diagnoseTindakLanjutExport(token,auditId){
  var u=session_(token);
  ieAssertAuditAccess_(u,auditId);
  var m=ieAuditMaps_(auditId);

  var rows=m.assigns.map(function(a){
    var sid=ieClean_(a.StandardID);
    var se=
      m.selfs[ieClean_(a.AssignID)]||
      m.selfsByStandard[sid]||
      {};
    var f=
      m.finds[ieClean_(a.AssignID)]||
      m.findsByStandard[sid]||
      {};

    return {
      AuditID:auditId,
      AssignID:a.AssignID,
      StandardID:a.StandardID,
      ItemCode:a.ItemCode,
      SelfEvalFound:!!ieClean_(se.SelfEvalID),
      SelfCapaian:ieNormCategory_(se.Capaian),
      SelfEvaluasiDiri:ieClean_(se.EvaluasiDiri),
      FindingFound:!!ieClean_(f.FindingID),
      FindingKategori:ieNormCategory_(f.Kategori),
      ExportedAsTindakLanjut:
        ['MENYIMPANG','BELUM MENCAPAI'].indexOf(
          ieNormCategory_(f.Kategori)||
          ieNormCategory_(se.Capaian)
        )>=0
    };
  });

  return serializeValue_({
    ok:true,
    auditId:auditId,
    assigned:m.assigns.length,
    selfEvalRows:Object.keys(m.selfs).length,
    selfEvalFallbackRows:Object.keys(m.selfsByStandard).length,
    negativeRows:rows.filter(function(x){
      return x.ExportedAsTindakLanjut;
    }).length,
    rows:rows
  });
}

function exportAuditRekapXlsx_(token,auditId){
  var u=session_(token),audit=ieAssertAuditAccess_(u,auditId),mods=['EVALUASI_DIRI','DESK_EVALUATION','VISITASI','FORM2','FORM3','HASIL_AUDIT','TINDAK_LANJ'],ss=SpreadsheetApp.create('AMI_REKAP_'+audit.AuditiName+'_'+new Date().getTime());
  try{
    var id=ss.getSheets()[0];id.setName('IDENTITAS');id.clear();id.getRange(1,1,8,2).setValues([['AuditID',audit.AuditID],['Auditi',audit.AuditiName],['Jenis',audit.AuditiType],['Fakultas',audit.Fakultas],['Jenjang',audit.Jenjang],['Status',audit.Status],['CycleID',audit.CycleID],['Export',Utilities.formatDate(new Date(),AMI_CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss')]]);id.getRange('A1:B8').setWrap(true);id.getRange('A1:A8').setFontWeight('bold').setBackground('#e8f0f8');
    mods.forEach(function(m){var def=ieModuleDefs_()[m],rows=ieExportAuditModuleRows_(m,u,auditId),sh=ss.insertSheet(m.substring(0,90));sh.getRange(1,1,1,def.columns.length).setValues([def.columns]).setFontWeight('bold').setBackground('#173d6b').setFontColor('#fff');if(rows.length)sh.getRange(2,1,rows.length,def.columns.length).setValues(rows);sh.setFrozenRows(1);sh.getRange(1,1,Math.max(2,rows.length+1),def.columns.length).setWrap(true);});
    var amap={};getAllRows_('AMI_STANDARD_ASSIGN').filter(function(a){return ieClean_(a.AuditID)===ieClean_(auditId);}).forEach(function(a){amap[a.StandardID]=a.ItemCode;});
    var evCols=['ItemCode','NamaBukti','JenisBukti','URL','DriveFileID','Keterangan','UploadedAt','UploadedBy'],evRows=getAllRows_('EVIDENCE').filter(function(e){return ieClean_(e.AuditID)===ieClean_(auditId);}).map(function(e){return [amap[e.StandardID]||'',e.NamaBukti,e.JenisBukti,e.URL,e.DriveFileID,e.Keterangan,e.UploadedAt,e.UploadedBy];}),evSh=ss.insertSheet('BUKTI');evSh.getRange(1,1,1,evCols.length).setValues([evCols]).setFontWeight('bold').setBackground('#173d6b').setFontColor('#fff');if(evRows.length)evSh.getRange(2,1,evRows.length,evCols.length).setValues(evRows);
    var apCols=['Stage','Approved','ApprovedByNama','ApprovedByRole','ApprovedAt','VersionHash','Note'],apRows=getAllRows_('APPROVAL').filter(function(a){return ieClean_(a.AuditID)===ieClean_(auditId);}).map(function(a){return [a.Stage,a.Approved,a.ApprovedByNama,a.ApprovedByRole,a.ApprovedAt,a.VersionHash,a.Note];}),apSh=ss.insertSheet('PERSETUJUAN');apSh.getRange(1,1,1,apCols.length).setValues([apCols]).setFontWeight('bold').setBackground('#173d6b').setFontColor('#fff');if(apRows.length)apSh.getRange(2,1,apRows.length,apCols.length).setValues(apRows);
    var rpCols=['Version','Status','GoogleDocID','DocxFileID','PdfFileID','ValidationHash','CreatedAt','CreatedBy'],rpRows=getAllRows_('REPORT_LOG').filter(function(a){return ieClean_(a.AuditID)===ieClean_(auditId);}).map(function(a){return [a.Version,a.Status,a.GoogleDocID,a.DocxFileID,a.PdfFileID,a.ValidationHash,a.CreatedAt,a.CreatedBy];}),rpSh=ss.insertSheet('LAPORAN');rpSh.getRange(1,1,1,rpCols.length).setValues([rpCols]).setFontWeight('bold').setBackground('#173d6b').setFontColor('#fff');if(rpRows.length)rpSh.getRange(2,1,rpRows.length,rpCols.length).setValues(rpRows);
    return ieExportBlob_(ss,'AMI_REKAP_'+String(audit.AuditiName||audit.AuditID).replace(/[^a-z0-9_-]+/gi,'_')+'.xlsx');
  }finally{try{DriveApp.getFileById(ss.getId()).setTrashed(true);}catch(ignore){}}
}

function ieConcatBytes_(parts){var out=[];parts.forEach(function(p){var b=typeof p==='string'?Utilities.newBlob(p).getBytes():p;for(var i=0;i<b.length;i++)out.push(b[i]);});return out;}
function ieConvertXlsx_(blob){
  var boundary='AMI_BOUNDARY_'+Utilities.getUuid().replace(/-/g,''),meta=JSON.stringify({name:'AMI_IMPORT_TMP_'+new Date().getTime(),mimeType:IE_GSHEET_MIME_});
  var pre='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: '+IE_XLSX_MIME_+'\r\n\r\n',post='\r\n--'+boundary+'--';
  var resp=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',{method:'post',contentType:'multipart/related; boundary='+boundary,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:ieConcatBytes_([pre,blob.getBytes(),post]),muteHttpExceptions:true});
  var code=resp.getResponseCode(),txt=resp.getContentText();if(code<200||code>=300)throw new Error('Gagal membaca XLSX melalui Drive ('+code+'): '+txt.substring(0,400));
  var obj=JSON.parse(txt);if(!obj.id)throw new Error('File XLSX tidak berhasil dikonversi.');return obj.id;
}

function ieReadConvertedRows_(ssId){
  var ss=null,lastErr='';
  for(var n=0;n<4;n++){
    try{ss=SpreadsheetApp.openById(ssId);break;}catch(e){lastErr=e.message;Utilities.sleep(400*(n+1));}
  }
  if(!ss)throw new Error('Spreadsheet hasil konversi belum dapat dibuka: '+lastErr);
  var sh=ss.getSheetByName('DATA')||ss.getSheets()[0],vals=sh.getDataRange().getDisplayValues();if(!vals.length)throw new Error('File XLSX kosong.');
  var headers=vals[0].map(ieClean_),rows=[];
  for(var i=1;i<vals.length;i++){var arr=vals[i],blank=arr.every(function(v){return !ieClean_(v);});if(blank)continue;var o={_row:i+1};headers.forEach(function(h,j){if(h)o[h]=arr[j];});rows.push(o);}
  return {headers:headers,rows:rows};
}

function validateImportXlsx(token,module,context,fileName,mimeType,base64){
  var u=session_(token),x=ieModule_(module),ctx=context||{};
  if(x.def.exportOnly)throw new Error('Modul ini hanya dapat diekspor.');
  var role=ieUpper_(u.Role);if(x.def.admin&&role!=='ADMIN_BPM')throw new Error('Hanya Admin BPM yang dapat mengimpor modul ini.');if(x.def.roles&&x.def.roles.indexOf(role)<0)throw new Error('Role '+role+' tidak dapat mengimpor modul ini.');
  if(x.def.context==='AUDIT')ieAssertAuditAccess_(u,ctx.auditId,role);if(x.def.context==='CYCLE'&&!ctx.cycleId)throw new Error('Pilih siklus AMI terlebih dahulu.');
  var bytes=Utilities.base64Decode(String(base64||'').replace(/^data:[^,]+,/,''));if(!bytes.length)throw new Error('File XLSX kosong.');if(bytes.length>15*1024*1024)throw new Error('Ukuran XLSX maksimal 15 MB.');
  var blob=Utilities.newBlob(bytes,mimeType||IE_XLSX_MIME_,fileName||'import.xlsx'),ssId='';
  try{ssId=ieConvertXlsx_(blob);var parsed=ieReadConvertedRows_(ssId),vres=ieValidateRows_(x.key,u,ctx,parsed.headers,parsed.rows),importToken=Utilities.getUuid();CacheService.getScriptCache().put(IE_CACHE_PREFIX_+importToken,JSON.stringify({ssId:ssId,module:x.key,context:ctx,userId:u.UserID,created:new Date().getTime()}),IE_CACHE_SECONDS_);return serializeValue_({importToken:importToken,module:x.key,total:vres.total,valid:vres.valid,invalid:vres.invalid,preview:vres.preview,errors:vres.errors,fileName:fileName});}
  catch(e){if(ssId){try{DriveApp.getFileById(ssId).setTrashed(true);}catch(ignore){}}throw e;}
}

function cancelImportXlsx(token,importToken){var u=session_(token),cache=CacheService.getScriptCache(),raw=cache.get(IE_CACHE_PREFIX_+importToken);if(raw){var x=JSON.parse(raw);if(x.userId===u.UserID){try{DriveApp.getFileById(x.ssId).setTrashed(true);}catch(ignore){}cache.remove(IE_CACHE_PREFIX_+importToken);}}return {ok:true};}

function commitImportXlsx(token,importToken){
  var u=session_(token),cache=CacheService.getScriptCache(),raw=cache.get(IE_CACHE_PREFIX_+importToken);
  if(!raw)throw new Error('Sesi import sudah kedaluwarsa. Validasi file kembali.');
  var job=JSON.parse(raw);if(job.userId!==u.UserID)throw new Error('Sesi import bukan milik pengguna ini.');
  try{
    // Konversi/read XLSX dilakukan tanpa lock. Validasi akhir + seluruh write baru
    // masuk satu transaksi agar import tidak bertabrakan dengan Simpan dari UI.
    var parsed=ieReadConvertedRows_(job.ssId);
    return withLock_(function(){
      u=session_(token);
      IE_VALIDATE_CACHE_=null;
      var vres=ieValidateRows_(job.module,u,job.context||{},parsed.headers,parsed.rows),validRows=vres.validRows||[];
      var result=ieApplyRows_(job.module,u,job.context||{},validRows,token);
      try{auditLog_(u,'IMPORT_XLSX',job.module,job.context&&job.context.auditId?job.context.auditId:'','', '', {total:vres.total,valid:vres.valid,invalid:vres.invalid,result:result});}catch(ignoreLog){}
      return serializeValue_({ok:true,module:job.module,context:job.context||{},total:vres.total,imported:result.imported||0,updated:result.updated||0,skipped:result.skipped||0,invalid:vres.invalid,errors:vres.errors,touchedAssignIds:result.touchedAssignIds||[]});
    });
  }finally{
    cache.remove(IE_CACHE_PREFIX_+importToken);
    try{DriveApp.getFileById(job.ssId).setTrashed(true);}catch(ignore){}
  }
}

function ieMissingHeaders_(headers,required){var norm={};headers.forEach(function(h){norm[ieUpper_(h).replace(/[^A-Z0-9]/g,'')]=true;});return required.filter(function(h){return !norm[ieUpper_(h).replace(/[^A-Z0-9]/g,'')];});}
function ieCell_(r,name){if(Object.prototype.hasOwnProperty.call(r,name))return r[name];var n=ieUpper_(name).replace(/[^A-Z0-9]/g,'');var k=Object.keys(r).find(function(x){return ieUpper_(x).replace(/[^A-Z0-9]/g,'')===n;});return k?r[k]:'';}

function ieValidateRows_(module,u,ctx,headers,rows){
  var def=ieModuleDefs_()[module],missing=ieMissingHeaders_(headers,def.columns);if(missing.length)throw new Error('Header XLSX kurang: '+missing.join(', ')+'. Gunakan file hasil Export dari aplikasi.');
  var validRows=[],errors=[],preview=[];
  iePrepareValidationCache_(module,u,ctx);
  try{
    rows.forEach(function(r){var e=ieValidateRow_(module,u,ctx,r);var item={row:r._row,ok:!e.length,errors:e.join(' | '),data:{}};def.columns.slice(0,8).forEach(function(c){item.data[c]=ieCell_(r,c);});preview.push(item);if(e.length){if(errors.length<50)errors.push('Baris '+r._row+': '+e.join(' | '));}else validRows.push(r);});
  }finally{IE_VALIDATE_CACHE_=null;}
  return {total:rows.length,valid:validRows.length,invalid:rows.length-validRows.length,validRows:validRows,errors:errors,preview:preview.slice(0,100)};
}

function ieValidationRows_(sheet){
  if(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.rows&&IE_VALIDATE_CACHE_.rows[sheet])return IE_VALIDATE_CACHE_.rows[sheet];
  return getAllRows_(sheet);
}
function ieFindAuditiMaster_(type,code,name){type=ieUpper_(type);var rows=type==='PRODI'?ieValidationRows_('MASTER_PRODI'):type==='UNIT'?ieValidationRows_('MASTER_UNIT'):[];return rows.find(function(r){var c=type==='PRODI'?r.KodeProdi:r.KodeUnit,n=type==='PRODI'?r.NamaProdi:r.NamaUnit;return (ieClean_(code)&&ieUpper_(c)===ieUpper_(code))||(!ieClean_(code)&&ieUpper_(n)===ieUpper_(name));})||null;}
function ieFindAuditInCycle_(cycleId,type,auditiId){return ieValidationRows_('AMI_AUDITI').find(function(a){return ieClean_(a.CycleID)===ieClean_(cycleId)&&ieUpper_(a.AuditiType)===ieUpper_(type)&&ieClean_(a.AuditiID)===ieClean_(auditiId);})||null;}
function ieFindStandard_(code,version){var rows=ieValidationRows_('MASTER_STANDAR'),v=ieClean_(version)||'1.0';return rows.find(function(s){return ieUpper_(s.ItemCode)===ieUpper_(code)&&ieClean_(s.Versi||'1.0')===v;})||null;}
function ieFindAssign_(auditId,code,version){var std=ieFindStandard_(code,version);if(!std)return null;return ieValidationRows_('AMI_STANDARD_ASSIGN').find(function(a){return ieClean_(a.AuditID)===ieClean_(auditId)&&ieClean_(a.StandardID)===ieClean_(std.StandardID)&&bool_(a.Active);})||null;}

function iePrepareValidationCache_(module,u,ctx){
  var rows={};
  ['MASTER_PRODI','MASTER_UNIT','MASTER_AUDITOR','MASTER_STANDAR','AMI_CYCLE','AMI_AUDITI','AMI_STANDARD_ASSIGN','AMI_TEAM','FINDINGS'].forEach(function(n){rows[n]=getAllRows_(n);});
  var cache={rows:rows,audit:null};
  var roleMap={EVALUASI_DIRI:'AUDITI',DESK_EVALUATION:'AUDITOR',VISITASI:'AUDITOR',FORM2:'AUDITOR',FORM3:'AUDITOR',HASIL_AUDIT:'AUDITOR',TINDAK_LANJ:'AUDITI'};
  if(roleMap[module])cache.audit=ieAssertAuditAccess_(u,ctx.auditId,roleMap[module]);
  IE_VALIDATE_CACHE_=cache;
  return cache;
}

function ieValidateRow_(module,u,ctx,r){
  var e=[],c=function(n){return ieClean_(ieCell_(r,n));},up=function(n){return ieUpper_(ieCell_(r,n));};
  var activeText=up('Active');if(activeText&&['IYA','TIDAK','TRUE','FALSE','1','0','YA','YES'].indexOf(activeText)<0)e.push('Active harus IYA/TIDAK');
  if(module==='MASTER_PRODI'){if(!c('NamaProdi'))e.push('NamaProdi wajib');if(['S1','S2','S3'].indexOf(up('Jenjang'))<0)e.push('Jenjang harus S1/S2/S3');}
  else if(module==='MASTER_UNIT'){if(!c('NamaUnit'))e.push('NamaUnit wajib');if((AMI_CONFIG.UNIT_TYPES||[]).indexOf(up('JenisUnit'))<0)e.push('JenisUnit tidak valid');}
  else if(module==='MASTER_AUDITOR'){if(!c('NIDN_NIK'))e.push('NIDN_NIK wajib');if(!c('Nama'))e.push('Nama wajib');if(['IYA','TIDAK'].indexOf(up('Sertifikasi'))<0)e.push('Sertifikasi IYA/TIDAK');}
  else if(module==='MASTER_PIMPINAN'){if(!c('Nama'))e.push('Nama wajib');if((AMI_CONFIG.PIMPINAN_LEVELS||[]).indexOf(up('Level'))<0)e.push('Level tidak valid');}
  else if(module==='MASTER_STANDAR'){if(!c('ItemCode'))e.push('ItemCode wajib');if(!c('NamaStandar'))e.push('NamaStandar wajib');if(!c('PernyataanStandar'))e.push('Pernyataan wajib');if(!c('Indikator'))e.push('Indikator wajib');if((AMI_CONFIG.STANDARD_STATUSES||[]).indexOf(up('StatusStandar'))<0)e.push('StatusStandar tidak valid');var oldStd=ieFindStandard_(c('ItemCode'),c('Versi'));if(oldStd){var used=ieValidationRows_('AMI_STANDARD_ASSIGN').some(function(a){return ieClean_(a.StandardID)===ieClean_(oldStd.StandardID);});if(used){var pairs=[['Kelompok','Kelompok'],['KodeKelompokStandar','KodeKelompokStandar'],['NamaStandar','NamaStandar'],['NoSumber','NoSumber'],['PernyataanStandar','PernyataanStandar'],['StrategiPencapaian','StrategiPencapaian'],['Indikator','Indikator'],['SumberFile','SumberFile'],['TahunSumber','TahunSumber'],['HalamanPDFMulai','HalamanPDFMulai'],['HalamanPDFAkhir','HalamanPDFAkhir']];if(pairs.some(function(p){return ieClean_(oldStd[p[0]])!==c(p[1]);}))e.push('Standar versi ini sudah dipakai audit; buat versi baru untuk perubahan substansi');}}}
  else if(module==='SIKLUS'){if(!c('Tahun'))e.push('Tahun wajib');if(!c('NamaSiklus'))e.push('NamaSiklus wajib');var cs=up('Status');if(cs&&['DRAFT BPM','AKTIF','DITUTUP'].indexOf(cs)<0)e.push('Status siklus tidak valid');}
  else if(module==='PENETAPAN_STANDAR'){
    var type=up('AuditiType'),ref=ieFindAuditiMaster_(type,c('KodeAuditi'),c('NamaAuditi')),std=ieFindStandard_(c('ItemCode'),c('VersiStandar'));
    if(['PRODI','UNIT'].indexOf(type)<0)e.push('AuditiType PRODI/UNIT');if(!ref)e.push('Auditi tidak ditemukan pada master');if(!std)e.push('ItemCode/Versi standar tidak ditemukan');if(std){if(ieUpper_(std.StatusStandar||'BERLAKU')!=='BERLAKU')e.push('Standar harus berstatus BERLAKU');var cyc=ieValidationRows_('AMI_CYCLE').find(function(x){return ieClean_(x.CycleID)===ieClean_(ctx.cycleId);});if(cyc&&typeof standardAppliesToYear_==='function'&&!standardAppliesToYear_(std,Number(cyc.Tahun)||0))e.push('Standar tidak berlaku pada tahun siklus ini');}if(ref){var a=ieFindAuditInCycle_(ctx.cycleId,type,ref.ProdiID||ref.UnitID);if(a&&ieClean_(a.Status)!=='DRAFT BPM')e.push('Penetapan hanya dapat diubah saat DRAFT BPM');}
  }
  else if(module==='TIM_AUDITOR'){
    var t=up('AuditiType'),rr=ieFindAuditiMaster_(t,c('KodeAuditi'),c('NamaAuditi')),aa=rr?ieFindAuditInCycle_(ctx.cycleId,t,rr.ProdiID||rr.UnitID):null,ars=ieValidationRows_('MASTER_AUDITOR');var ids=['LeadNIDN_NIK','Anggota1NIDN_NIK','Anggota2NIDN_NIK'].map(c);var idKey=function(v){return typeof auditorIdentityKey_==='function'?auditorIdentityKey_(v):ieUpper_(v).replace(/[^A-Z0-9]/g,'');};if(!aa)e.push('Audit/Auditi belum ada pada siklus');else if(ieClean_(aa.Status)!=='DRAFT BPM')e.push('Tim hanya dapat diubah saat DRAFT BPM');if(ids.some(function(x){return !x;}))e.push('Lead dan 2 anggota wajib');if((new Set(ids.map(idKey))).size!==3)e.push('Tiga auditor harus berbeda');ids.forEach(function(id){if(!id)return;var key=idKey(id),hit=ars.find(function(a){return idKey(a.NIDN_NIK)===key;});if(!hit)e.push('Auditor '+id+' tidak ditemukan');else if(!bool_(hit.Active))e.push('Auditor '+id+' tidak aktif');});
  }
  else if(module==='EVALUASI_DIRI'){
    var audit=(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.audit)||ieAssertAuditAccess_(u,ctx.auditId,'AUDITI'),st=ieClean_(audit.Status);
    if(['PENUGASAN DITERBITKAN','EVALUASI DIRI BERJALAN','PERLU REVISI AUDITI'].indexOf(st)<0)e.push('Status audit tidak mengizinkan import Evaluasi Diri');
    if(!ieFindAssign_(ctx.auditId,c('ItemCode'),c('VersiStandar')))e.push('Standar tidak ditugaskan ke audit ini');
    var cap=up('Capaian');
    if(cap&&(AMI_CONFIG.CAPAIAN||[]).indexOf(cap)<0)e.push('Capaian tidak valid');
    if(['MENYIMPANG','BELUM MENCAPAI'].indexOf(cap)>=0){
      if(!c('EvaluasiDiri'))e.push('EvaluasiDiri/Deskripsi Temuan wajib untuk capaian negatif');
      if(!c('Akibat'))e.push('Akibat wajib untuk capaian negatif');
      if(!c('AkarPenyebab'))e.push('AkarPenyebab wajib untuk capaian negatif');
      if(!c('RencanaPerbaikan'))e.push('RencanaPerbaikan wajib untuk capaian negatif');
      if(!c('JadwalPerbaikan'))e.push('JadwalPerbaikan wajib untuk capaian negatif');
      if(!c('PJPerbaikan'))e.push('PJPerbaikan wajib untuk capaian negatif');
    }
    if(['MENCAPAI','MELAMPAUI'].indexOf(cap)>=0){
      if(!c('FaktorPendukung'))e.push('FaktorPendukung wajib untuk capaian positif');
      if(!c('RekomendasiPeningkatanIndikator'))e.push('RekomendasiPeningkatanIndikator wajib untuk capaian positif');
    }
    for(var li=1;li<=5;li++){var url=c('LinkBukti'+li);if(url&&!ieUrlOk_(url))e.push('LinkBukti'+li+' harus http/https');}
  }
  else if(module==='DESK_EVALUATION'){
    var ad=(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.audit)||ieAssertAuditAccess_(u,ctx.auditId,'AUDITOR'),sd=ieClean_(ad.Status);
    if(['EVALUASI DIRI DIKIRIM','DESK EVALUATION','SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','PERLU REVISI AUDITOR'].indexOf(sd)<0)e.push('Status audit tidak mengizinkan import Desk');
    if(!ieFindAssign_(ctx.auditId,c('ItemCode'),c('VersiStandar')))e.push('Standar tidak ditugaskan');
    var ds=up('StatusDesk');if(ds&&(AMI_CONFIG.DESK_STATUSES||[]).indexOf(ds)<0)e.push('StatusDesk tidak valid');
  }
  else if(module==='VISITASI'){
    var av=(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.audit)||ieAssertAuditAccess_(u,ctx.auditId,'AUDITOR');
    if(['EVALUASI DIRI DIKIRIM','DESK EVALUATION','SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','PERLU REVISI AUDITOR'].indexOf(ieClean_(av.Status))<0)e.push('Status audit tidak mengizinkan import Visitasi');
  }
  else if(module==='FORM2'){
    var af2=(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.audit)||ieAssertAuditAccess_(u,ctx.auditId,'AUDITOR');
    if(['EVALUASI DIRI DIKIRIM','DESK EVALUATION','SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','PERLU REVISI AUDITOR'].indexOf(ieClean_(af2.Status))<0)e.push('Status audit tidak mengizinkan import Form 2');
    if(!c('NomorStandar'))e.push('NomorStandar wajib diisi');
    if(!c('NamaStandar'))e.push('NamaStandar wajib diisi');
    if(!c('TentatifAuditObjektif'))e.push('TentatifAuditObjektif wajib diisi');
    if(!c('TujuanAudit'))e.push('TujuanAudit wajib diisi');
  }
  else if(module==='FORM3'){
    var af3=(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.audit)||ieAssertAuditAccess_(u,ctx.auditId,'AUDITOR');
    if(['EVALUASI DIRI DIKIRIM','DESK EVALUATION','SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','PERLU REVISI AUDITOR'].indexOf(ieClean_(af3.Status))<0)e.push('Status audit tidak mengizinkan import Form 3');
  }
  else if(module==='HASIL_AUDIT'){
    var ah=(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.audit)||ieAssertAuditAccess_(u,ctx.auditId,'AUDITOR');
    if(['SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','PERLU REVISI AUDITOR'].indexOf(ieClean_(ah.Status))<0)e.push('Status audit tidak mengizinkan import Hasil');
    if(!ieFindAssign_(ctx.auditId,c('ItemCode'),c('VersiStandar')))e.push('Standar tidak ditugaskan');
    var kat=up('Kategori');if(kat&&(AMI_CONFIG.CAPAIAN||[]).indexOf(kat)<0)e.push('Kategori tidak valid');
    if(['MENYIMPANG','BELUM MENCAPAI'].indexOf(kat)>=0){
      if(!c('Deskripsi'))e.push('Deskripsi wajib untuk hasil negatif');
      if(!c('Kriteria'))e.push('Kriteria wajib untuk hasil negatif');
      if(!c('Akibat'))e.push('Akibat wajib untuk hasil negatif');
      if(!c('AkarPenyebab'))e.push('AkarPenyebab wajib untuk hasil negatif');
      if(!c('Rekomendasi'))e.push('Rekomendasi wajib untuk hasil negatif');
      if(!c('RencanaPerbaikan'))e.push('RencanaPerbaikan wajib untuk hasil negatif');
      if(!c('JadwalPerbaikan'))e.push('JadwalPerbaikan wajib untuk hasil negatif');
      if(!c('PJPerbaikan'))e.push('PJPerbaikan wajib untuk hasil negatif');
    }
    if(['MENCAPAI','MELAMPAUI'].indexOf(kat)>=0){
      if(!c('FaktorPendukung'))e.push('FaktorPendukung wajib untuk hasil positif');
      if(!c('RekomendasiPeningkatanIndikator'))e.push('RekomendasiPeningkatanIndikator wajib untuk hasil positif');
    }
  }
  else if(module==='TINDAK_LANJ'){
    var at=(IE_VALIDATE_CACHE_&&IE_VALIDATE_CACHE_.audit)||ieAssertAuditAccess_(u,ctx.auditId,'AUDITI');
    var ats=ieClean_(at.Status);
    if(['PENUGASAN DITERBITKAN','EVALUASI DIRI BERJALAN','PERLU REVISI AUDITI','MENUNGGU ACC AUDITI'].indexOf(ats)<0)e.push('Status audit tidak mengizinkan import Tindak Lanjut');
    var as=ieFindAssign_(ctx.auditId,c('ItemCode'),c('VersiStandar'));
    if(!as)e.push('Standar tidak ditugaskan');
    else{
      var f=ieValidationRows_('FINDINGS').find(function(x){return ieClean_(x.AuditID)===ieClean_(ctx.auditId)&&ieClean_(x.AssignID)===ieClean_(as.AssignID);});
      var se=ieValidationRows_('SELF_EVAL').find(function(x){return ieClean_(x.AuditID)===ieClean_(ctx.auditId)&&ieClean_(x.AssignID)===ieClean_(as.AssignID);});
      var sourceCat=ieUpper_(f?f.Kategori:(se?se.Capaian:c('Kategori')));
      if(['MENYIMPANG','BELUM MENCAPAI'].indexOf(sourceCat)<0)e.push('Tindak lanjut hanya berlaku untuk capaian/hasil negatif');
      if(!c('RencanaPerbaikan'))e.push('RencanaPerbaikan wajib');
      if(!c('JadwalPerbaikan'))e.push('JadwalPerbaikan wajib');
      if(!c('PJPerbaikan'))e.push('PJPerbaikan wajib');
    }
  }
  return e;
}

function ieWritePlainTextCell_(sheetName,rowNum,columnName,value){
  var sh=sheet_(sheetName),h=headers_(sheetName),idx=h.indexOf(columnName);
  if(idx<0)throw new Error('Kolom '+columnName+' tidak ditemukan pada '+sheetName+'.');
  var cell=sh.getRange(rowNum,idx+1);
  cell.setNumberFormat('@');
  cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value==null?'':String(value)).build());
}

function ieApplyRows_(module,u,ctx,rows,token){
  var out={imported:0,updated:0,skipped:0};
  if(module==='MASTER_PRODI'||module==='MASTER_UNIT'||module==='MASTER_AUDITOR'||module==='MASTER_PIMPINAN'){
    var type=module.replace('MASTER_',''),existing=listMaster(token,type);
    rows.forEach(function(r){
      var old=null,data={Active:ieBool_(ieCell_(r,'Active'),true)};
      if(type==='PRODI'){
        old=existing.find(function(x){return (ieClean_(ieCell_(r,'KodeProdi'))&&ieUpper_(x.KodeProdi)===ieUpper_(ieCell_(r,'KodeProdi')))||ieUpper_(x.NamaProdi)===ieUpper_(ieCell_(r,'NamaProdi'));})||null;
        data={ProdiID:old?old.ProdiID:'',KodeProdi:ieCell_(r,'KodeProdi'),NamaProdi:ieCell_(r,'NamaProdi'),Fakultas:ieCell_(r,'Fakultas'),Jenjang:ieUpper_(ieCell_(r,'Jenjang')),Kaprodi:ieCell_(r,'Kaprodi'),NIDN:ieCell_(r,'NIDN'),Active:ieBool_(ieCell_(r,'Active'),true)};
      }else if(type==='UNIT'){
        old=existing.find(function(x){return (ieClean_(ieCell_(r,'KodeUnit'))&&ieUpper_(x.KodeUnit)===ieUpper_(ieCell_(r,'KodeUnit')))||ieUpper_(x.NamaUnit)===ieUpper_(ieCell_(r,'NamaUnit'));})||null;
        data={UnitID:old?old.UnitID:'',KodeUnit:ieCell_(r,'KodeUnit'),NamaUnit:ieCell_(r,'NamaUnit'),JenisUnit:ieUpper_(ieCell_(r,'JenisUnit')),Pimpinan:ieCell_(r,'Pimpinan'),Active:ieBool_(ieCell_(r,'Active'),true)};
      }else if(type==='AUDITOR'){
        // V24: canonical NIDN/NIK + fallback Nama/Unit. Helper berada di AdminService.gs.
        old=typeof findAuditorMasterMatch_==='function'
          ? findAuditorMasterMatch_(existing,ieCell_(r,'NIDN_NIK'),ieCell_(r,'Nama'),ieCell_(r,'Unit'),'')
          : existing.find(function(x){return ieUpper_(x.NIDN_NIK)===ieUpper_(ieCell_(r,'NIDN_NIK'));})||null;
        data={AuditorID:old?old.AuditorID:'',NIDN_NIK:ieCell_(r,'NIDN_NIK'),Nama:ieCell_(r,'Nama'),Unit:ieCell_(r,'Unit'),Sertifikasi:ieUpper_(ieCell_(r,'Sertifikasi')),Active:ieBool_(ieCell_(r,'Active'),true)};
      }else{
        old=existing.find(function(x){return ieUpper_(x.Nama)===ieUpper_(ieCell_(r,'Nama'))&&ieUpper_(x.Jabatan)===ieUpper_(ieCell_(r,'Jabatan'));})||null;
        data={PimpinanID:old?old.PimpinanID:'',Nama:ieCell_(r,'Nama'),Jabatan:ieCell_(r,'Jabatan'),Level:ieUpper_(ieCell_(r,'Level')),AccessID:ieCell_(r,'AreaAkses'),AccessName:ieCell_(r,'AreaAkses'),Active:ieBool_(ieCell_(r,'Active'),true)};
      }
      var saveResult=saveMaster(token,type,data);
      if(old||(saveResult&&saveResult.updatedExisting))out.updated++;else out.imported++;
      // Penting: tambahkan record baru ke cache batch agar baris duplikat di FILE YANG SAMA
      // juga dianggap update dan tidak menghasilkan AuditorID/ID master baru.
      if(!old&&saveResult&&saveResult.id){
        var created=Object.assign({},data);
        if(type==='PRODI')created.ProdiID=saveResult.id;
        else if(type==='UNIT')created.UnitID=saveResult.id;
        else if(type==='AUDITOR')created.AuditorID=saveResult.id;
        else if(type==='PIMPINAN')created.PimpinanID=saveResult.id;
        existing.push(created);
      }
    });
    return out;
  }
  if(module==='MASTER_STANDAR'){
    var standards=getAllRows_('MASTER_STANDAR');
    rows.forEach(function(r){
      var code=ieCell_(r,'ItemCode'),ver=ieCell_(r,'Versi')||'1.0',old=standards.find(function(x){return ieUpper_(x.ItemCode)===ieUpper_(code)&&ieClean_(x.Versi||'1.0')===ieClean_(ver);})||null;
      saveStandard(token,{StandardID:old?old.StandardID:'',StandardFamilyID:old?old.StandardFamilyID:'',ItemCode:code,Kelompok:ieCell_(r,'Kelompok'),KodeKelompokStandar:ieCell_(r,'KodeKelompokStandar'),NamaStandar:ieCell_(r,'NamaStandar'),NoSumber:ieCell_(r,'NoSumber'),PernyataanStandar:ieCell_(r,'PernyataanStandar'),StrategiPencapaian:ieCell_(r,'StrategiPencapaian'),Indikator:ieCell_(r,'Indikator'),TahunBerlakuMulai:ieCell_(r,'TahunBerlakuMulai'),Versi:ver,StatusStandar:ieUpper_(ieCell_(r,'StatusStandar')),SumberFile:ieCell_(r,'SumberFile'),TahunSumber:ieCell_(r,'TahunSumber'),HalamanPDFMulai:ieCell_(r,'HalamanPDFMulai'),HalamanPDFAkhir:ieCell_(r,'HalamanPDFAkhir'),Notes:ieCell_(r,'Notes')});
      if(old)out.updated++;else out.imported++;
    });
    return out;
  }
  if(module==='SIKLUS'){
    var cycles=getAllRows_('AMI_CYCLE');
    rows.forEach(function(r){var old=cycles.find(function(x){return ieUpper_(x.NamaSiklus)===ieUpper_(ieCell_(r,'NamaSiklus'))&&ieClean_(x.Tahun)===ieClean_(ieCell_(r,'Tahun'));})||null;saveCycle(token,{CycleID:old?old.CycleID:'',NamaSiklus:ieCell_(r,'NamaSiklus'),Tahun:ieCell_(r,'Tahun'),TahunAkademik:ieCell_(r,'TahunAkademik'),TanggalMulai:ieCell_(r,'TanggalMulai'),BatasEvaluasiDiri:ieCell_(r,'BatasEvaluasiDiri'),DeskStart:ieCell_(r,'DeskStart'),DeskEnd:ieCell_(r,'DeskEnd'),VisitStart:ieCell_(r,'VisitStart'),VisitEnd:ieCell_(r,'VisitEnd'),Status:ieCell_(r,'Status')||'DRAFT BPM',Active:ieBool_(ieCell_(r,'Active'),true)});if(old)out.updated++;else out.imported++;});return out;
  }
  if(module==='PENETAPAN_STANDAR')return withLock_(function(){return ieApplyAssignments_(u,ctx.cycleId,rows);});
  if(module==='TIM_AUDITOR')return withLock_(function(){return ieApplyTeams_(u,ctx.cycleId,rows);});
  return withLock_(function(){return ieApplyAuditRows_(module,u,ctx.auditId,rows);});
}

function ieApplyAssignments_(u,cycleId,rows){
  var out={imported:0,updated:0,skipped:0};
  var audits=getAllRows_('AMI_AUDITI'),assigns=getAllRows_('AMI_STANDARD_ASSIGN'),prodis=getAllRows_('MASTER_PRODI'),units=getAllRows_('MASTER_UNIT'),standards=getAllRows_('MASTER_STANDAR');
  var auditMap={},stdMap={};
  audits.forEach(function(a){auditMap[ieUpper_(a.AuditiType)+'|'+ieClean_(a.AuditiID)+'|'+ieClean_(a.CycleID)]=a;});
  standards.forEach(function(x){stdMap[ieUpper_(x.ItemCode)+'|'+ieClean_(x.Versi||'1.0')]=x;});
  function refFor(type,code,name){var list=type==='PRODI'?prodis:units;return list.find(function(r){var c=type==='PRODI'?r.KodeProdi:r.KodeUnit,n=type==='PRODI'?r.NamaProdi:r.NamaUnit;return (ieClean_(code)&&ieUpper_(c)===ieUpper_(code))||(!ieClean_(code)&&ieUpper_(n)===ieUpper_(name));})||null;}
  rows.forEach(function(r){
    var type=ieUpper_(ieCell_(r,'AuditiType')),ref=refFor(type,ieCell_(r,'KodeAuditi'),ieCell_(r,'NamaAuditi')),std=stdMap[ieUpper_(ieCell_(r,'ItemCode'))+'|'+ieClean_(ieCell_(r,'VersiStandar')||'1.0')];
    if(!ref||!std){out.skipped++;return;}
    var rid=ref.ProdiID||ref.UnitID,key=type+'|'+ieClean_(rid)+'|'+ieClean_(cycleId),aud=auditMap[key];
    if(!aud){aud={AuditID:uuid_('AUDIT'),CycleID:cycleId,AuditiType:type,AuditiID:rid,AuditiName:ref.NamaProdi||ref.NamaUnit,Fakultas:ref.Fakultas||'',Jenjang:ref.Jenjang||'',Status:'DRAFT BPM',PublishedAt:'',CreatedAt:now_(),CreatedBy:u.Nama};appendObject_('AMI_AUDITI',aud);aud._row=sheet_('AMI_AUDITI').getLastRow();audits.push(aud);auditMap[key]=aud;}
    if(ieClean_(aud.Status)!=='DRAFT BPM'){out.skipped++;return;}
    var ex=assigns.find(function(a){return a.AuditID===aud.AuditID&&a.StandardID===std.StandardID;}),active=ieBool_(ieCell_(r,'Active'),true),snap=typeof standardSnapshotFromMaster_==='function'?standardSnapshotFromMaster_(std):{};
    if(ex){updateRow_('AMI_STANDARD_ASSIGN',ex._row,Object.assign({Active:active,AssignedAt:now_(),AssignedBy:u.Nama},snap));ex.Active=active;out.updated++;}
    else if(active){var rec=Object.assign({AssignID:uuid_('ASN'),AuditID:aud.AuditID,StandardID:std.StandardID,ItemCode:std.ItemCode,NamaStandar:std.NamaStandar,AssignedAt:now_(),AssignedBy:u.Nama,Active:true},snap);appendObject_('AMI_STANDARD_ASSIGN',rec);rec._row=sheet_('AMI_STANDARD_ASSIGN').getLastRow();assigns.push(rec);out.imported++;}
    else{out.skipped++;}
  });
  return out;
}

function ieApplyTeams_(u,cycleId,rows){var out={imported:0,updated:0,skipped:0},auditors=getAllRows_('MASTER_AUDITOR');var idKey=function(v){return typeof auditorIdentityKey_==='function'?auditorIdentityKey_(v):ieUpper_(v).replace(/[^A-Z0-9]/g,'');};var byNid={};auditors.forEach(function(a){var k=idKey(a.NIDN_NIK);if(k&&!byNid[k])byNid[k]=a;});var records=[];rows.forEach(function(r){var type=ieUpper_(ieCell_(r,'AuditiType')),ref=ieFindAuditiMaster_(type,ieCell_(r,'KodeAuditi'),ieCell_(r,'NamaAuditi')),audit=ref?ieFindAuditInCycle_(cycleId,type,ref.ProdiID||ref.UnitID):null;if(!audit){out.skipped++;return;}function aid(col){var a=byNid[idKey(ieCell_(r,col))];return a?a.AuditorID:'';}var old=findOne_('AMI_TEAM','AuditID',audit.AuditID),rec={TeamID:old?old.TeamID:uuid_('TEAM'),AuditID:audit.AuditID,LeadAuditorID:aid('LeadNIDN_NIK'),Member1ID:aid('Anggota1NIDN_NIK'),Member2ID:aid('Anggota2NIDN_NIK'),AssignedAt:old?old.AssignedAt:now_(),AssignedBy:u.Nama,UpdatedAt:now_()};records.push(rec);if(old)out.updated++;else out.imported++;});if(records.length)batchUpsert_('AMI_TEAM',['AuditID'],records,[]);return out;}


function ieApplyAuditRows_(module,u,auditId,rows){
  var out={imported:0,updated:0,skipped:0,touchedAssignIds:[]},audit=findOne_('AMI_AUDITI','AuditID',auditId);
  var assigns=getAllRows_('AMI_STANDARD_ASSIGN').filter(function(a){return ieClean_(a.AuditID)===ieClean_(auditId)&&bool_(a.Active);});
  var standards=getAllRows_('MASTER_STANDAR'),stdById={},assignByKey={};
  standards.forEach(function(x){stdById[x.StandardID]=x;});
  assigns.forEach(function(a){var s=stdById[a.StandardID]||{},code=a.ItemCode||s.ItemCode,ver=s.Versi||a.VersiStandarSnapshot||'1.0';assignByKey[ieUpper_(code)+'|'+ieClean_(ver)]=a;});
  function asn(r){return assignByKey[ieUpper_(ieCell_(r,'ItemCode'))+'|'+ieClean_(ieCell_(r,'VersiStandar')||'1.0')]||null;}

  if(module==='EVALUASI_DIRI'){
    ensureSheetReady_('SELF_EVAL',SHEET_DEFS.SELF_EVAL);
    var selfs=getAllRows_('SELF_EVAL').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}),selfByAssign={};selfs.forEach(function(x){selfByAssign[x.AssignID]=x;});
    var evidence=getAllRows_('EVIDENCE').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}),evByKey={};evidence.forEach(function(e){evByKey[ieClean_(e.StandardID)+'|'+ieClean_(e.URL)]=e;});
    var touched={};
    var impEvalMap=typeof wfImprovementMap_==='function'?wfImprovementMap_(auditId):{};
    var impEvalRecords=[];
    rows.forEach(function(r){
      var a=asn(r);if(!a){out.skipped++;return;}if(out.touchedAssignIds.indexOf(a.AssignID)<0)out.touchedAssignIds.push(a.AssignID);var se=selfByAssign[a.AssignID];
      if(!se){se={SelfEvalID:uuid_('SE'),AuditID:auditId,AssignID:a.AssignID,StandardID:a.StandardID,Capaian:'',NilaiCapaian:'',EvaluasiDiri:'',Akibat:'',AkarPenyebab:'',Status:'DRAFT',BuktiCount:0,SavedAt:'',SubmittedAt:'',SubmittedBy:''};appendObject_('SELF_EVAL',se);se._row=sheet_('SELF_EVAL').getLastRow();selfByAssign[a.AssignID]=se;out.imported++;}
      var nilaiAktual=ieCell_(r,'NilaiAktual');var capEval=ieNormCategory_(ieCell_(r,'Capaian')),negEval=['MENYIMPANG','BELUM MENCAPAI'].indexOf(capEval)>=0;var patch={Capaian:ieUpper_(ieCell_(r,'Capaian')),EvaluasiDiri:ieCell_(r,'EvaluasiDiri'),Akibat:negEval?ieCell_(r,'Akibat'):'',AkarPenyebab:negEval?ieCell_(r,'AkarPenyebab'):'',Status:'DRAFT',SavedAt:now_()};updateRow_('SELF_EVAL',se._row,patch);ieWritePlainTextCell_('SELF_EVAL',se._row,'NilaiCapaian',nilaiAktual);patch.NilaiCapaian=nilaiAktual;Object.assign(se,patch);out.updated++;touched[se.SelfEvalID]=se;
      if(typeof wfUpsertSelfFollowUp_==='function'){
        var evalNeg=['MENYIMPANG','BELUM MENCAPAI'].indexOf(ieNormCategory_(patch.Capaian))>=0;
        if(evalNeg){
          wfUpsertSelfFollowUp_(u,auditId,a.AssignID,{
            Capaian:patch.Capaian,
            TanggapanAuditi:ieCell_(r,'TanggapanAuditi'),
            RencanaPerbaikan:ieCell_(r,'RencanaPerbaikan'),
            JadwalPerbaikan:ieCell_(r,'JadwalPerbaikan'),
            PJPerbaikan:ieCell_(r,'PJPerbaikan'),
            RencanaPencegahan:ieCell_(r,'RencanaPencegahan'),
            JadwalPencegahan:ieCell_(r,'JadwalPencegahan'),
            PJPencegahan:ieCell_(r,'PJPencegahan')
          },{CapaianAwal:patch.Capaian});
        }else if(typeof wfSelfFollowUpMap_==='function'){
          var priorEvalFollow=wfSelfFollowUpMap_(auditId)[a.AssignID]||null;
          if(priorEvalFollow&&priorEvalFollow._row){
            updateRow_('SELF_FOLLOW_UP',priorEvalFollow._row,{CapaianAwal:patch.Capaian,Status:'TIDAK DIPERLUKAN',UpdatedAt:now_()});
          }
        }
      }
      if(typeof wfMakeSelfImprovementRecord_==='function'){
        var oldImpEval=impEvalMap[a.AssignID]||{};
        var impEvalRec=wfMakeSelfImprovementRecord_(oldImpEval,u,auditId,a,se.SelfEvalID,patch.Capaian,{
          FaktorPendukung:ieCell_(r,'FaktorPendukung'),
          RekomendasiPeningkatanIndikator:ieCell_(r,'RekomendasiPeningkatanIndikator')
        });
        impEvalRecords.push(impEvalRec);
        impEvalMap[a.AssignID]=impEvalRec;
      }
      for(var i=1;i<=5;i++){
        var url=ieCell_(r,'LinkBukti'+i);if(!ieClean_(url))continue;var key=ieClean_(a.StandardID)+'|'+ieClean_(url),ev=evByKey[key],erec={SelfEvalID:se.SelfEvalID,AuditID:auditId,StandardID:a.StandardID,NamaBukti:ieCell_(r,'NamaBukti'+i)||('Bukti Link '+i+' — '+a.ItemCode),JenisBukti:'LINK',URL:url,DriveFileID:'',Keterangan:'Import XLSX',UploadedAt:now_(),UploadedBy:u.Nama};
        if(ev){updateRow_('EVIDENCE',ev._row,erec);Object.assign(ev,erec);}else{ev=Object.assign({EvidenceID:uuid_('EVD')},erec);appendObject_('EVIDENCE',ev);ev._row=sheet_('EVIDENCE').getLastRow();evidence.push(ev);evByKey[key]=ev;}
      }
    });
    if(impEvalRecords.length&&typeof wfBatchUpsert_==='function'){
      wfEnsureImprovement_();
      wfBatchUpsert_(WF_IMPROVEMENT_SHEET_,['AuditID','AssignID'],impEvalRecords,[]);
    }
    var count={};evidence.forEach(function(e){count[e.SelfEvalID]=(count[e.SelfEvalID]||0)+1;});Object.keys(touched).forEach(function(id){var se=touched[id];updateRow_('SELF_EVAL',se._row,{BuktiCount:count[id]||0});});
    if(ieClean_(audit.Status)==='PENUGASAN DITERBITKAN')updateRow_('AMI_AUDITI',audit._row,{Status:'EVALUASI DIRI BERJALAN'});return out;
  }
  if(module==='DESK_EVALUATION'){
    var desks=getAllRows_('DESK_EVAL').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}),deskMap={};
    desks.forEach(function(x){deskMap[x.AssignID]=x;});
    var selfDesk={};getAllRows_('SELF_EVAL').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}).forEach(function(x){selfDesk[x.AssignID]=x;});
    var followDesk=typeof wfSelfFollowUpMap_==='function'?wfSelfFollowUpMap_(auditId):{};
    var findDesk={};getAllRows_('FINDINGS').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}).forEach(function(x){findDesk[x.AssignID]=x;});
    var impDesk=typeof wfImprovementMap_==='function'?wfImprovementMap_(auditId):{};
    var findSeed=[],impSeed=[];
    rows.forEach(function(r){
      var a=asn(r);if(!a){out.skipped++;return;}
      var old=deskMap[a.AssignID],sd2=ieUpper_(ieCell_(r,'StatusDesk'));
      var rec={DeskID:old?old.DeskID:uuid_('DESK'),AuditID:auditId,AssignID:a.AssignID,StandardID:a.StandardID,StatusDesk:sd2,CatatanDesk:ieCell_(r,'CatatanDesk'),ButuhVisitasi:ieBool_(ieCell_(r,'ButuhVisitasi'),false),AuditorID:u.RefID,UpdatedAt:now_()};
      if(old){updateRow_('DESK_EVAL',old._row,rec);Object.assign(old,rec);out.updated++;}
      else{appendObject_('DESK_EVAL',rec);rec._row=sheet_('DESK_EVAL').getLastRow();deskMap[a.AssignID]=rec;out.imported++;}

      if(sd2==='SESUAI'){
        var seD=selfDesk[a.AssignID]||{},catD=ieNormCategory_(seD.Capaian),prior=findDesk[a.AssignID]||{};
        if(catD&&!ieNormCategory_(prior.Kategori)){
          var sfD=followDesk[a.AssignID]||{},negD=['MENYIMPANG','BELUM MENCAPAI'].indexOf(catD)>=0;
          var fr={
            FindingID:prior.FindingID||uuid_('FND'),AuditID:auditId,AssignID:a.AssignID,StandardID:a.StandardID,Kategori:catD,
            Deskripsi:prior.Deskripsi||seD.EvaluasiDiri||'',Kriteria:prior.Kriteria||a.PernyataanStandarSnapshot||'',Akibat:prior.Akibat||(negD?seD.Akibat||'':''),AkarPenyebab:prior.AkarPenyebab||(negD?seD.AkarPenyebab||'':''),Rekomendasi:prior.Rekomendasi||'',
            TanggapanAuditi:negD?(prior.TanggapanAuditi||sfD.TanggapanAuditi||''):'',RencanaPerbaikan:negD?(prior.RencanaPerbaikan||sfD.RencanaPerbaikan||''):'',JadwalPerbaikan:negD?(prior.JadwalPerbaikan||sfD.JadwalPerbaikan||''):'',PJPerbaikan:negD?(prior.PJPerbaikan||sfD.PJPerbaikan||''):'',
            RencanaPencegahan:negD?(prior.RencanaPencegahan||sfD.RencanaPencegahan||''):'',JadwalPencegahan:negD?(prior.JadwalPencegahan||sfD.JadwalPencegahan||''):'',PJPencegahan:negD?(prior.PJPencegahan||sfD.PJPencegahan||''):'',
            CreatedAt:prior.CreatedAt||now_(),CreatedBy:prior.CreatedBy||u.Nama,UpdatedAt:now_(),UpdatedBy:u.Nama
          };
          findSeed.push(fr);findDesk[a.AssignID]=fr;
          if(['MENCAPAI','MELAMPAUI'].indexOf(catD)>=0){
            var oldID=impDesk[a.AssignID]||{};
            var ir={ImprovementID:oldID.ImprovementID||uuid_('IMP'),AuditID:auditId,AssignID:a.AssignID,StandardID:a.StandardID,SelfEvalID:oldID.SelfEvalID||seD.SelfEvalID||'',CapaianAwal:oldID.CapaianAwal||catD,KategoriFinal:catD,FaktorPendukung:oldID.FaktorPendukung||'',RekomendasiPeningkatanIndikator:oldID.RekomendasiPeningkatanIndikator||'',Status:oldID.Status||'DRAFT AUDITI - SESUAI DESK',SavedAt:oldID.SavedAt||now_(),SavedBy:oldID.SavedBy||u.Nama,UpdatedAt:now_(),UpdatedBy:u.Nama};
            impSeed.push(ir);impDesk[a.AssignID]=ir;
          }
        }
      }
    });
    if(findSeed.length)batchUpsert_('FINDINGS',['AuditID','AssignID'],findSeed,['JadwalPerbaikan','JadwalPencegahan']);
    if(impSeed.length&&typeof wfBatchUpsert_==='function'){wfEnsureImprovement_();wfBatchUpsert_(WF_IMPROVEMENT_SHEET_,['AuditID','AssignID'],impSeed,[]);}
    if(ieClean_(audit.Status)==='EVALUASI DIRI DIKIRIM')updateRow_('AMI_AUDITI',audit._row,{Status:'DESK EVALUATION'});
    return out;
  }
  if(module==='VISITASI'){
    var r=rows[0]||{},old=findOne_('VISIT','AuditID',auditId),rec={VisitID:old?old.VisitID:uuid_('VISIT'),AuditID:auditId,Tanggal:ieCell_(r,'Tanggal'),JamMulai:ieVisitTimeText_(ieCell_(r,'JamMulai')),JamSelesai:ieVisitTimeText_(ieCell_(r,'JamSelesai')),Lokasi:ieCell_(r,'Lokasi'),WakilAuditi:ieCell_(r,'WakilAuditi'),CatatanUmum:ieCell_(r,'CatatanUmum'),Status:'DRAFT',UpdatedAt:now_()};var visitRow=0;if(old){updateRow_('VISIT',old._row,rec);visitRow=old._row;out.updated++;}else{visitRow=appendObject_('VISIT',rec);out.imported++;}if(!visitRow){var savedVisit=findOne_('VISIT','AuditID',auditId)||{};visitRow=savedVisit._row||0;}ieWriteVisitTimeText_(visitRow,'JamMulai',rec.JamMulai);ieWriteVisitTimeText_(visitRow,'JamSelesai',rec.JamSelesai);if(ieClean_(audit.Status)==='SIAP VISITASI')updateRow_('AMI_AUDITI',audit._row,{Status:'VISITASI BERJALAN'});return out;
  }
  if(module==='FORM2'){
    var old2=findOne_('FORM2_PROGRAM_KERJA','AuditID',auditId),group2={},order2=[];
    rows.forEach(function(r,i){var no=ieClean_(ieCell_(r,'ProgramNo'))||String(i+1);if(!group2[no]){group2[no]={rowId:'XLSX_F2_'+no,nomorStandar:ieCell_(r,'NomorStandar'),namaStandar:ieCell_(r,'NamaStandar'),tentatifAuditObjektif:ieCell_(r,'TentatifAuditObjektif'),tujuanAudit:ieCell_(r,'TujuanAudit'),langkahKerja:[]};order2.push(no);}else{if(!ieClean_(group2[no].nomorStandar))group2[no].nomorStandar=ieCell_(r,'NomorStandar');if(!ieClean_(group2[no].namaStandar))group2[no].namaStandar=ieCell_(r,'NamaStandar');if(!ieClean_(group2[no].tentatifAuditObjektif))group2[no].tentatifAuditObjektif=ieCell_(r,'TentatifAuditObjektif');if(!ieClean_(group2[no].tujuanAudit))group2[no].tujuanAudit=ieCell_(r,'TujuanAudit');}var hasStep=ieClean_(ieCell_(r,'UraianLangkah'))||ieClean_(ieCell_(r,'Estimasi'))||ieClean_(ieCell_(r,'NoPernyataan'))||ieClean_(ieCell_(r,'Realisasi'))||ieClean_(ieCell_(r,'InisialAuditor'));if(hasStep){var ln=ieClean_(ieCell_(r,'LangkahNo'))||String(group2[no].langkahKerja.length+1);group2[no].langkahKerja.push({rowId:'XLSX_F2L_'+no+'_'+ln,uraian:ieCell_(r,'UraianLangkah'),estimasi:ieCell_(r,'Estimasi'),noPernyataan:ieCell_(r,'NoPernyataan'),realisasi:ieCell_(r,'Realisasi'),inisialAuditor:ieCell_(r,'InisialAuditor'),updatedAt:now_(),updatedBy:u.Nama});}});
    var programs=order2.map(function(k){var p=group2[k];p.updatedAt=now_();p.updatedBy=u.Nama;return p;});
    function ieUniqJoinF2_(arr){var seen={},out2=[];(arr||[]).forEach(function(v){v=ieClean_(v);if(v&&!seen[v]){seen[v]=true;out2.push(v);}});return out2.join('\n');}
    var rec2={Form2ID:old2?old2.Form2ID:uuid_('F2'),AuditID:auditId,TentatifAuditObjektif:ieUniqJoinF2_(programs.map(function(x){return x.tentatifAuditObjektif;})),TujuanAudit:ieUniqJoinF2_(programs.map(function(x){return x.tujuanAudit;})),LangkahJSON:JSON.stringify(programs),UpdatedAt:now_(),UpdatedBy:u.Nama};
    if(old2){updateRow_('FORM2_PROGRAM_KERJA',old2._row,rec2);out.updated++;}else{appendObject_('FORM2_PROGRAM_KERJA',rec2);out.imported++;}return out;
  }
  if(module==='FORM3'){
    var old3=findOne_('FORM3_CATATAN','AuditID',auditId),group3={},order3=[];
    rows.forEach(function(r,i){var no=ieClean_(ieCell_(r,'CatatanNo'))||String(i+1);if(!group3[no]){group3[no]={rowId:'XLSX_F3_'+no,catatan:ieCell_(r,'Catatan'),tanggal:ieCell_(r,'Tanggal'),dokumenReferensi:[]};order3.push(no);}var ref=ieCell_(r,'DokumenRef');if(ieClean_(ref)){var rn=ieClean_(ieCell_(r,'ReferensiNo'))||String(group3[no].dokumenReferensi.length+1);group3[no].dokumenReferensi.push({rowId:'XLSX_F3R_'+no+'_'+rn,dokumenRef:ref,updatedAt:now_(),updatedBy:u.Nama});}});
    var notes=order3.map(function(k){var x=group3[k];x.updatedAt=now_();x.updatedBy=u.Nama;return x;}),rec3={Form3ID:old3?old3.Form3ID:uuid_('F3'),AuditID:auditId,CatatanJSON:JSON.stringify(notes),UpdatedAt:now_(),UpdatedBy:u.Nama};if(old3){updateRow_('FORM3_CATATAN',old3._row,rec3);out.updated++;}else{appendObject_('FORM3_CATATAN',rec3);out.imported++;}return out;
  }
  if(module==='HASIL_AUDIT'){
    var finds=getAllRows_('FINDINGS').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}),findMap={};finds.forEach(function(x){findMap[x.AssignID]=x;});
    ensureSheetReady_('SELF_EVAL',SHEET_DEFS.SELF_EVAL);
    var selfMapH={};getAllRows_('SELF_EVAL').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}).forEach(function(x){selfMapH[x.AssignID]=x;});
    var sfm2=typeof wfSelfFollowUpMap_==='function'?wfSelfFollowUpMap_(auditId):{};
    var impMapH=typeof wfImprovementMap_==='function'?wfImprovementMap_(auditId):{};
    var impRowsH=[];
    rows.forEach(function(r){
      var a=asn(r);if(!a){out.skipped++;return;}
      var old=findMap[a.AssignID]||{},kat2=ieUpper_(ieCell_(r,'Kategori')),sf2=sfm2[a.AssignID]||{},seH=selfMapH[a.AssignID]||{},neg2=['MENYIMPANG','BELUM MENCAPAI'].indexOf(kat2)>=0,posH=['MENCAPAI','MELAMPAUI'].indexOf(kat2)>=0;
      function xlsxOrFallback_(col,oldVal,initialVal){
        var incoming=ieCell_(r,col);
        if(incoming!==''&&incoming!==null&&incoming!==undefined)return String(incoming).trim();
        return ieClean_(oldVal)||ieClean_(initialVal)||'';
      }
      var rec={
        FindingID:old.FindingID||uuid_('FND'),AuditID:auditId,AssignID:a.AssignID,StandardID:a.StandardID,
        Kategori:kat2,Deskripsi:neg2?xlsxOrFallback_('Deskripsi',old.Deskripsi,seH.EvaluasiDiri):ieCell_(r,'Deskripsi'),Kriteria:xlsxOrFallback_('Kriteria',old.Kriteria,a.PernyataanStandarSnapshot),Akibat:neg2?xlsxOrFallback_('Akibat',old.Akibat,seH.Akibat):ieCell_(r,'Akibat'),
        AkarPenyebab:neg2?xlsxOrFallback_('AkarPenyebab',old.AkarPenyebab,seH.AkarPenyebab):ieCell_(r,'AkarPenyebab'),Rekomendasi:ieCell_(r,'Rekomendasi'),
        TanggapanAuditi:neg2?xlsxOrFallback_('TanggapanAuditi',old.TanggapanAuditi,sf2.TanggapanAuditi):'',
        RencanaPerbaikan:neg2?xlsxOrFallback_('RencanaPerbaikan',old.RencanaPerbaikan,sf2.RencanaPerbaikan):'',
        JadwalPerbaikan:neg2?xlsxOrFallback_('JadwalPerbaikan',old.JadwalPerbaikan,sf2.JadwalPerbaikan):'',
        PJPerbaikan:neg2?xlsxOrFallback_('PJPerbaikan',old.PJPerbaikan,sf2.PJPerbaikan):'',
        RencanaPencegahan:neg2?xlsxOrFallback_('RencanaPencegahan',old.RencanaPencegahan,sf2.RencanaPencegahan):'',
        JadwalPencegahan:neg2?xlsxOrFallback_('JadwalPencegahan',old.JadwalPencegahan,sf2.JadwalPencegahan):'',
        PJPencegahan:neg2?xlsxOrFallback_('PJPencegahan',old.PJPencegahan,sf2.PJPencegahan):'',
        CreatedAt:old.CreatedAt||now_(),CreatedBy:old.CreatedBy||u.Nama,UpdatedAt:now_(),UpdatedBy:u.Nama
      };
      if(old._row){updateRow_('FINDINGS',old._row,rec);Object.assign(old,rec);out.updated++;}
      else{appendObject_('FINDINGS',rec);rec._row=sheet_('FINDINGS').getLastRow();findMap[a.AssignID]=rec;out.imported++;}

      if(typeof wfEnsureImprovement_==='function'&&typeof wfBatchUpsert_==='function'){
        var oldImpH=impMapH[a.AssignID]||{};
        var impRecH={
          ImprovementID:oldImpH.ImprovementID||uuid_('IMP'),AuditID:auditId,AssignID:a.AssignID,StandardID:a.StandardID,
          SelfEvalID:oldImpH.SelfEvalID||'',CapaianAwal:oldImpH.CapaianAwal||'',KategoriFinal:kat2,
          FaktorPendukung:posH?xlsxOrFallback_('FaktorPendukung',oldImpH.FaktorPendukung,''):(oldImpH.FaktorPendukung||''),
          RekomendasiPeningkatanIndikator:posH?xlsxOrFallback_('RekomendasiPeningkatanIndikator',oldImpH.RekomendasiPeningkatanIndikator,''):(oldImpH.RekomendasiPeningkatanIndikator||''),
          Status:posH?'DIISI AUDITOR':'TIDAK DIPERLUKAN',SavedAt:oldImpH.SavedAt||now_(),SavedBy:oldImpH.SavedBy||u.Nama,UpdatedAt:now_(),UpdatedBy:u.Nama
        };
        impRowsH.push(impRecH);impMapH[a.AssignID]=impRecH;
      }
    });
    if(impRowsH.length&&typeof wfBatchUpsert_==='function'){wfEnsureImprovement_();wfBatchUpsert_(WF_IMPROVEMENT_SHEET_,['AuditID','AssignID'],impRowsH,[]);}
    if(ieClean_(audit.Status)==='VISITASI BERJALAN')updateRow_('AMI_AUDITI',audit._row,{Status:'HASIL AUDIT DIISI'});
    return out;
  }
  if(module==='TINDAK_LANJ'){
    var fs=getAllRows_('FINDINGS').filter(function(x){return ieClean_(x.AuditID)===ieClean_(auditId);}),fm={};fs.forEach(function(x){fm[x.AssignID]=x;});
    rows.forEach(function(r){
      var a=asn(r);if(!a){out.skipped++;return;}
      var old=fm[a.AssignID]||null;
      var dataTL={
        TanggapanAuditi:ieCell_(r,'TanggapanAuditi'),
        RencanaPerbaikan:ieCell_(r,'RencanaPerbaikan'),
        JadwalPerbaikan:ieCell_(r,'JadwalPerbaikan'),
        PJPerbaikan:ieCell_(r,'PJPerbaikan'),
        RencanaPencegahan:ieCell_(r,'RencanaPencegahan'),
        JadwalPencegahan:ieCell_(r,'JadwalPencegahan'),
        PJPencegahan:ieCell_(r,'PJPencegahan')
      };
      if(old){
        // Setelah finding resmi tersedia, TINDAK_LANJ adalah data final dan hanya
        // mengubah FINDINGS. SELF_FOLLOW_UP tetap menjadi histori awal Auditi.
        updateRow_('FINDINGS',old._row,Object.assign({},dataTL,{UpdatedAt:now_(),UpdatedBy:u.Nama}));
      }else if(typeof wfUpsertSelfFollowUp_==='function'){
        // Sebelum hasil auditor, simpan sebagai tindak lanjut awal Evaluasi Diri.
        wfUpsertSelfFollowUp_(u,auditId,a.AssignID,dataTL,{CapaianAwal:ieCell_(r,'Kategori')});
      }
      out.updated++;
    });
    return out;
  }
  throw new Error('Import belum didukung untuk '+module);
}


  const methods = {getBootstrap,getExecutiveDashboard,getPublicExecutiveDashboard,getImportExportCatalog,getPublicAppInfo};
  if (!Object.hasOwn(methods, method)) throw new Error('Metode dashboard tidak dikenal.');
  return methods[method]();
}