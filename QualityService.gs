function logSystemError_(functionName,error,user,context){
  try{
    appendObject_('SYSTEM_ERROR_LOG',{
      ErrorID:uuid_('ERR'),Timestamp:now_(),UserID:user&&user.UserID?user.UserID:'',Username:user&&user.Username?user.Username:'',Role:user&&user.Role?user.Role:'',
      FunctionName:cleanText_(functionName),Message:cleanText_(error&&error.message?error.message:error),Stack:cleanText_(error&&error.stack?error.stack:''),ContextJSON:JSON.stringify(serializeValue_(context||{})).substring(0,45000)
    });
  }catch(ignore){}
}

function reportClientError(token,functionName,message,stack,context){
  if(!token)return{ok:false};let u=null;try{u=session_(token);}catch(ignore){return{ok:false};}
  // V27: cegah badai log ketika browser yang sama menerima error identik berulang.
  // Logging adalah observability, bukan transaksi utama, jadi duplikat 60 detik aman ditekan.
  try{
    const raw=[cleanText_(u.UserID),cleanText_(functionName),cleanText_(message)].join('|');
    const digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw)).replace(/=+$/,'').substring(0,32);
    const cache=CacheService.getScriptCache(),key='AMI_ERR_V27_'+digest;
    if(cache.get(key))return{ok:true,suppressed:true};
    cache.put(key,'1',60);
  }catch(ignoreThrottle){}
  logSystemError_(functionName,{message:message||'Client error',stack:stack||''},u,context||{});return{ok:true};
}

function dataIntegrityChecks_(){
  const checks=[];function add(name,ok,detail){checks.push({name:name,ok:!!ok,detail:detail||''});}
  try{
    const standards=getAllRows_('MASTER_STANDAR'),stdIds=new Set(standards.map(r=>cleanText_(r.StandardID))),standardKeys=standards.map(r=>normalizeUsername_(r.ItemCode)+'|'+normalizeUsername_(r.Versi||'1.0')).filter(x=>x!=='|');
    const berlaku=standards.filter(r=>bool_(r.Active)&&cleanText_(r.StatusStandar)==='BERLAKU');
    add('Master standar tersedia minimal 130 versi/rekaman',standards.length>=130,'Total: '+standards.length+' · Berlaku: '+berlaku.length);
    add('Kombinasi ItemCode + Versi unik',new Set(standardKeys).size===standardKeys.length,'Duplikat: '+(standardKeys.length-new Set(standardKeys).size));
    const badVersionMeta=standards.filter(r=>!cleanText_(r.StandardFamilyID)||!cleanText_(r.Versi)||AMI_CONFIG.STANDARD_STATUSES.indexOf(cleanText_(r.StatusStandar))<0);
    add('Metadata versi Master Standar lengkap',badVersionMeta.length===0,badVersionMeta.length+' standar perlu migrasi metadata versi');
    const audits=getAllRows_('AMI_AUDITI'),auditIds=new Set(audits.map(r=>cleanText_(r.AuditID)));
    const assigns=getAllRows_('AMI_STANDARD_ASSIGN'),assignIds=new Set(assigns.map(r=>cleanText_(r.AssignID)));
    const badAssign=assigns.filter(r=>!auditIds.has(cleanText_(r.AuditID))||!stdIds.has(cleanText_(r.StandardID)));
    add('Relasi penetapan standar valid',badAssign.length===0,badAssign.length+' relasi bermasalah');
    const noSnapshot=assigns.filter(r=>bool_(r.Active)&&(!cleanText_(r.PernyataanStandarSnapshot)||!cleanText_(r.IndikatorSnapshot)||!cleanText_(r.VersiStandarSnapshot)));
    add('Snapshot standar historis lengkap',noSnapshot.length===0,noSnapshot.length+' penetapan belum memiliki snapshot lengkap');
    const allAuditors=getAllRows_('MASTER_AUDITOR'),auditors=allAuditors.filter(r=>bool_(r.Active)),auditorIds=new Set(auditors.map(r=>cleanText_(r.AuditorID)));
    const auditorIdentitySeen={},duplicateAuditorIds=[];
    allAuditors.forEach(function(a){
      const nid=typeof auditorIdentityKey_==='function'?auditorIdentityKey_(a.NIDN_NIK):normalizeUsername_(a.NIDN_NIK).replace(/[^a-z0-9]/g,'');
      const fallback='NAME|'+normalizeUsername_(a.Nama)+'|'+normalizeUsername_(a.Unit);
      const key=nid?'NID|'+nid:fallback;
      if(!key||key==='NAME||')return;
      if(auditorIdentitySeen[key])duplicateAuditorIds.push([auditorIdentitySeen[key],cleanText_(a.AuditorID)].join(' / '));
      else auditorIdentitySeen[key]=cleanText_(a.AuditorID);
    });
    add('Identitas Master Auditor unik',duplicateAuditorIds.length===0,duplicateAuditorIds.length+' duplikat identitas auditor'+(duplicateAuditorIds.length?': '+duplicateAuditorIds.slice(0,5).join(', '):''));
    const teams=getAllRows_('AMI_TEAM'),badTeams=teams.filter(t=>{const ids=[t.LeadAuditorID,t.Member1ID,t.Member2ID].map(cleanText_);return !auditIds.has(cleanText_(t.AuditID))||ids.some(x=>!auditorIds.has(x))||new Set(ids).size!==3;});
    add('Tim auditor valid (1 Lead + 2 anggota unik)',badTeams.length===0,badTeams.length+' tim bermasalah');
    const assignCount={};assigns.filter(function(r){return bool_(r.Active);}).forEach(function(r){const id=cleanText_(r.AuditID);assignCount[id]=(assignCount[id]||0)+1;});
    const teamByAudit={};teams.forEach(function(t){teamByAudit[cleanText_(t.AuditID)]=t;});
    const publishedAuditsCore=audits.filter(function(a){return cleanText_(a.Status)!=='DRAFT BPM';});
    const publishedWithoutStandard=publishedAuditsCore.filter(function(a){return !(assignCount[cleanText_(a.AuditID)]||0);});
    const publishedWithoutTeam=publishedAuditsCore.filter(function(a){const t=teamByAudit[cleanText_(a.AuditID)];if(!t)return true;const ids=[t.LeadAuditorID,t.Member1ID,t.Member2ID].map(cleanText_);return ids.some(function(x){return !auditorIds.has(x);})||new Set(ids).size!==3;});
    add('Audit terbit memiliki standar aktif',publishedWithoutStandard.length===0,publishedWithoutStandard.length+' audit terbit tanpa standar aktif');
    add('Audit terbit memiliki tim auditor aktif lengkap',publishedWithoutTeam.length===0,publishedWithoutTeam.length+' audit terbit tanpa tim aktif lengkap');
    const self=getAllRows_('SELF_EVAL'),badSelf=self.filter(r=>!auditIds.has(cleanText_(r.AuditID))||!assignIds.has(cleanText_(r.AssignID))||!stdIds.has(cleanText_(r.StandardID)));
    add('Relasi Evaluasi Diri valid',badSelf.length===0,badSelf.length+' baris bermasalah');
    const desk=getAllRows_('DESK_EVAL'),badDesk=desk.filter(r=>!auditIds.has(cleanText_(r.AuditID))||!assignIds.has(cleanText_(r.AssignID)));
    add('Relasi Desk Evaluation valid',badDesk.length===0,badDesk.length+' baris bermasalah');
    const findings=getAllRows_('FINDINGS'),badFind=findings.filter(r=>!auditIds.has(cleanText_(r.AuditID))||!assignIds.has(cleanText_(r.AssignID)));
    add('Relasi Hasil/Temuan Audit valid',badFind.length===0,badFind.length+' baris bermasalah');
    const evid=getAllRows_('EVIDENCE'),badEv=evid.filter(r=>!auditIds.has(cleanText_(r.AuditID))||!stdIds.has(cleanText_(r.StandardID)));
    add('Relasi Bukti Pendukung valid',badEv.length===0,badEv.length+' bukti bermasalah');
    const follows=getAllRows_('SELF_FOLLOW_UP'),badFollow=follows.filter(function(r){return !auditIds.has(cleanText_(r.AuditID))||!assignIds.has(cleanText_(r.AssignID))||!stdIds.has(cleanText_(r.StandardID));});
    add('Relasi Tindak Lanjut Evaluasi Diri valid',badFollow.length===0,badFollow.length+' baris bermasalah');
    const improvements=getAllRows_('AMI_IMPROVEMENT'),badImp=improvements.filter(function(r){return !auditIds.has(cleanText_(r.AuditID))||!assignIds.has(cleanText_(r.AssignID))||!stdIds.has(cleanText_(r.StandardID));});
    add('Relasi Rekomendasi Peningkatan valid',badImp.length===0,badImp.length+' baris bermasalah');
    const users=getAllRows_('USERS'),usernames=users.map(r=>normalizeUsername_(r.Username)).filter(Boolean),dupUsers=usernames.length-new Set(usernames).size;
    add('Username unik',dupUsers===0,dupUsers+' username duplikat');
    const badCredentials=users.filter(function(r){return bool_(r.Active)&&(!cleanText_(r.Username)||!cleanText_(r.Salt)||!cleanText_(r.PasswordHash));});
    add('Credential akun aktif lengkap',badCredentials.length===0,badCredentials.length+' akun aktif belum memiliki username/salt/password hash lengkap');
    const refKeys=users.filter(function(r){return bool_(r.Active)&&cleanText_(r.Role)!=='ADMIN_BPM'&&cleanText_(r.RefID);}).map(function(r){return cleanText_(r.Role)+'|'+cleanText_(r.RefType)+'|'+cleanText_(r.RefID);});
    const dupRefs=refKeys.length-new Set(refKeys).size;
    add('Satu master aktif tidak memiliki akun ganda',dupRefs===0,dupRefs+' akun aktif memakai referensi master yang sama');
    const prodiIds=new Set(getAllRows_('MASTER_PRODI').map(r=>cleanText_(r.ProdiID))),unitIds=new Set(getAllRows_('MASTER_UNIT').map(r=>cleanText_(r.UnitID))),pimIds=new Set(getAllRows_('MASTER_PIMPINAN').map(r=>cleanText_(r.PimpinanID)));
    const badUserRef=users.filter(u=>{if(cleanText_(u.Role)==='ADMIN_BPM')return false;if(u.Role==='AUDITOR')return cleanText_(u.RefType)!=='AUDITOR'||!auditorIds.has(cleanText_(u.RefID));if(u.Role==='AUDITI')return !((u.RefType==='PRODI'&&prodiIds.has(cleanText_(u.RefID)))||(u.RefType==='UNIT'&&unitIds.has(cleanText_(u.RefID))));if(u.Role==='PIMPINAN')return cleanText_(u.RefType)!=='PIMPINAN'||!pimIds.has(cleanText_(u.RefID));return true;});
    add('Role dan referensi akun pengguna valid',badUserRef.length===0,badUserRef.length+' akun perlu diperbaiki');
    const pims=getAllRows_('MASTER_PIMPINAN').filter(r=>bool_(r.Active)),badPims=pims.filter(function(p){const level=normalizePimpinanLevel_(p.Level),aid=cleanText_(p.AccessID)||(level==='UNIT'?cleanText_(p.UnitID):'');if(AMI_CONFIG.PIMPINAN_LEVELS.indexOf(level)<0)return true;if(level==='PRODI')return !prodiIds.has(aid);if(level==='UNIT')return !unitIds.has(aid);if(level==='FAKULTAS')return !cleanText_(p.AccessName||p.AccessID);return false;});
    add('Level dan Area Akses Master Pimpinan valid',badPims.length===0,badPims.length+' pimpinan perlu diperbaiki');
    const publishedAudits=audits.filter(a=>cleanText_(a.Status)!=='DRAFT BPM'),noApprover=publishedAudits.filter(a=>getPimpinanApproversForAudit_(a).length===0),noApproverUser=publishedAudits.filter(a=>getPimpinanApproversForAudit_(a).length>0&&getPimpinanApproverUsersForAudit_(a).length===0);
    add('Audit diterbitkan memiliki Pimpinan Auditi',noApprover.length===0,noApprover.length+' audit tanpa Pimpinan Auditi');
    add('Pimpinan Auditi memiliki akun aktif',noApproverUser.length===0,noApproverUser.length+' audit tanpa akun Pimpinan Auditi');
    const activeCycles=getAllRows_('AMI_CYCLE').filter(r=>bool_(r.Active)||cleanText_(r.Status)==='AKTIF');
    add('Maksimal satu siklus aktif',activeCycles.length<=1,activeCycles.length+' siklus ditandai aktif');
  }catch(e){add('Pemeriksaan integritas database',false,e.message);}
  return {ok:checks.every(x=>x.ok),checks:checks};
}

function getLaunchReadiness(token){
  requireRole_(token,['ADMIN_BPM']);
  const health=getDatabaseHealth(token),integrity=dataIntegrityChecks_(),checks=[];
  health.checks.forEach(x=>checks.push({name:'Struktur '+x.name,ok:x.ok,detail:x.ok?(x.rows+' baris'):('Kolom hilang: '+(x.missing||[]).join(', '))}));
  integrity.checks.forEach(x=>checks.push(x));
  const props=PropertiesService.getScriptProperties();
  const setupVersion=props.getProperty('AMI_SETUP_VERSION')||'';
  checks.unshift({name:'Struktur database kompatibel dengan versi final',ok:health.ok,detail:health.ok?'Semua sheet/header wajib tersedia.': 'Jalankan maintenanceUpgradeSchemaFinal_() sekali dari editor Apps Script.'});
  checks.push({name:'ID database tersimpan',ok:!!PropertiesService.getScriptProperties().getProperty('AMI_DB_ID')||!!AMI_CONFIG.DB_SPREADSHEET_ID,detail:db_().getId()});
  const prodi=getAllRows_('MASTER_PRODI').filter(r=>bool_(r.Active)),auditor=getAllRows_('MASTER_AUDITOR').filter(r=>bool_(r.Active)),pimpinan=getAllRows_('MASTER_PIMPINAN').filter(r=>bool_(r.Active)),cycles=getAllRows_('AMI_CYCLE').filter(r=>bool_(r.Active)||cleanText_(r.Status)==='AKTIF'),users=getAllRows_('USERS').filter(r=>bool_(r.Active));
  checks.push({name:'Master Program Studi telah diisi',ok:prodi.length>0,detail:prodi.length+' prodi aktif'});
  checks.push({name:'Master Auditor mencukupi satu tim',ok:auditor.length>=3,detail:auditor.length+' auditor aktif'});
  checks.push({name:'Master Pimpinan telah diisi',ok:pimpinan.length>0,detail:pimpinan.length+' pimpinan aktif'});
  checks.push({name:'Tepat satu Siklus AMI aktif',ok:cycles.length===1,detail:cycles.length+' siklus aktif'});
  const expectedRefs=auditor.length+prodi.length+getAllRows_('MASTER_UNIT').filter(r=>bool_(r.Active)).length+pimpinan.length,actualRefs=users.filter(u=>cleanText_(u.Role)!=='ADMIN_BPM'&&cleanText_(u.RefID)).length;
  checks.push({name:'Akun pengguna telah disinkronkan dari master',ok:expectedRefs===0||actualRefs>=expectedRefs,detail:actualRefs+' akun referensi / '+expectedRefs+' master aktif'});
  if(cycles.length===1){const c=cycles[0],dates=[c.TanggalMulai,c.BatasEvaluasiDiri,c.DeskStart,c.DeskEnd,c.VisitStart,c.VisitEnd].map(x=>cleanText_(x)).filter(Boolean);checks.push({name:'Jadwal siklus terisi',ok:dates.length>=6,detail:dates.length+'/6 tanggal utama terisi'});}
  // Endpoint yang benar-benar dipanggil UI produksi harus tersedia pada deployment aktif.
  const explicitApiOk=typeof saveAuditTeamsBatch==='function'&&typeof saveTeamsAndPublishBatch==='function'&&typeof saveAllSelfEvaluation==='function'&&typeof saveAllDeskEvaluation==='function'&&typeof saveAllVisitForms==='function'&&typeof saveAllFindings==='function'&&typeof saveAllAuditiFollowUps==='function'&&typeof resumeSession==='function';
  checks.push({name:'API workflow produksi lengkap',ok:explicitApiOk,detail:explicitApiOk?'Endpoint assignment, workflow, dan session tersedia.':'Ada endpoint workflow produksi yang belum terpasang. Gunakan paket V27 lengkap.'});
  try{const sh=maintenanceSessionHealthV26_();checks.push({name:'Session store sehat',ok:Number(sh.expiredSessions||0)<100,detail:(sh.activeSessions||0)+' aktif · '+(sh.expiredSessions||0)+' kedaluwarsa · engine '+(sh.engine||'-')});}catch(e){checks.push({name:'Session store sehat',ok:false,detail:e&&e.message?e.message:String(e)});}
  const critical=checks.filter(x=>!x.ok).length;
  return serializeValue_({ok:critical===0,version:AMI_CONFIG.VERSION,critical:critical,checks:checks,databaseId:db_().getId(),databaseName:db_().getName()});
}

function getRecentSystemErrors(token,limit){
  requireRole_(token,['ADMIN_BPM']);limit=Math.max(1,Math.min(100,Number(limit)||30));return getAllRows_('SYSTEM_ERROR_LOG').slice(-limit).reverse().map(cleanRow_);
}

function validateAuditForFinalData_(auditId,data){
  const errors=[],warnings=[],id=cleanText_(auditId),audit=(data&&data.audit)||findOne_('AMI_AUDITI','AuditID',id);
  function req(ok,msg){if(!ok)errors.push(msg);}function warn(ok,msg){if(!ok)warnings.push(msg);}
  if(!audit)return{ok:false,errors:['Audit tidak ditemukan.'],warnings:[],hash:''};
  const assigned=(data&&data.assigned)||assignedStandards_(id);
  const self=(data&&data.self)||getAllRows_('SELF_EVAL').filter(function(r){return cleanText_(r.AuditID)===id;});
  const desk=(data&&data.desk)||getAllRows_('DESK_EVAL').filter(function(r){return cleanText_(r.AuditID)===id;});
  const findings=(data&&data.findings)||getAllRows_('FINDINGS').filter(function(r){return cleanText_(r.AuditID)===id;});
  const evidence=(data&&data.evidence)||getAllRows_('EVIDENCE').filter(function(r){return cleanText_(r.AuditID)===id;});
  const improvements=(data&&data.improvements)||getAllRows_('AMI_IMPROVEMENT').filter(function(r){return cleanText_(r.AuditID)===id;});
  const team=(data&&data.team)||findOne_('AMI_TEAM','AuditID',id),visit=(data&&data.visit)||findOne_('VISIT','AuditID',id),f2=(data&&data.form2)||findOne_('FORM2_PROGRAM_KERJA','AuditID',id),f3=(data&&data.form3)||findOne_('FORM3_CATATAN','AuditID',id),ap=(data&&data.approvals)||approvalMap_(id);
  req(assigned.length>0,'Belum ada standar/indikator yang ditetapkan.');
  const tids=team?[team.LeadAuditorID,team.Member1ID,team.Member2ID].map(cleanText_):[];req(team&&tids.every(Boolean)&&new Set(tids).size===3,'Tim auditor harus lengkap: 1 Lead + 2 anggota berbeda.');
  const auditiApproval=ap.AUDITI||null,auditiApprovalUser=auditiApproval?findOne_('USERS','UserID',auditiApproval.ApprovedByUserID):null;
  const auditiApprovalRole=auditiApproval?cleanText_(auditiApproval.ApprovedByRole):'';
  req(!!auditiApproval&&['AUDITI','PIMPINAN'].indexOf(auditiApprovalRole)>=0,'ACC Auditi belum tersedia atau berasal dari alur yang tidak dikenali.');
  if(auditiApproval&&auditiApprovalUser){
    if(auditiApprovalRole==='AUDITI'){
      req(cleanText_(auditiApprovalUser.RefType)===cleanText_(audit.AuditiType)&&cleanText_(auditiApprovalUser.RefID)===cleanText_(audit.AuditiID),'ACC Auditi tidak berasal dari akun Auditi yang sesuai dengan audit ini.');
    }else if(auditiApprovalRole==='PIMPINAN'){
      req(canPimpinanApproveAudit_(auditiApprovalUser,audit),'ACC Pimpinan Auditi tidak sesuai lagi dengan Area Akses auditi.');
    }
  }else if(auditiApproval){
    req(false,'Akun yang memberikan ACC Auditi tidak ditemukan atau tidak aktif.');
  }
  const missingSelf=assigned.filter(function(a){const x=self.find(function(s){return cleanText_(s.AssignID)===cleanText_(a.AssignID);});return !x||!cleanText_(x.Capaian)||!cleanText_(x.EvaluasiDiri);});req(!missingSelf.length,'Evaluasi Diri belum lengkap pada '+missingSelf.length+' butir.');
  if(AMI_CONFIG.REQUIRE_EVIDENCE_PER_ITEM!==false){const missingEv=assigned.filter(function(a){return !evidence.some(function(e){return cleanText_(e.StandardID)===cleanText_(a.StandardID);});});req(!missingEv.length,'Bukti pendukung belum tersedia pada '+missingEv.length+' butir.');}
  const missingDesk=assigned.filter(function(a){return !desk.some(function(d){return cleanText_(d.AssignID)===cleanText_(a.AssignID)&&cleanText_(d.StatusDesk);});});req(!missingDesk.length,'Desk Evaluation belum lengkap pada '+missingDesk.length+' butir.');
  req(visit&&cleanText_(visit.Tanggal)&&cleanText_(visit.Lokasi)&&cleanText_(visit.WakilAuditi),'Data visitasi wajib memuat tanggal, lokasi, dan wakil auditi.');
  const rawProgram=f2?parseJson_(f2.LangkahJSON,[]):[],programs=(typeof wfNormalizeProgramForms_==='function'?wfNormalizeProgramForms_(rawProgram,f2||{}):rawProgram);
  const programOk=!!f2&&programs.length>0&&!programs.some(function(p){var ls=Array.isArray(p&&p.langkahKerja)?p.langkahKerja:[];if(!ls.length&&p&&p.uraian)ls=[p];return !cleanText_(p&&p.nomorStandar)||!cleanText_(p&&p.namaStandar)||!cleanText_(p&&p.tentatifAuditObjektif)||!cleanText_(p&&p.tujuanAudit)||!ls.some(function(x){return cleanText_(x&&x.uraian);});});
  req(programOk,'Form 2 belum lengkap (setiap Program Kerja wajib memuat Nomor Standar, Nama Standar, tentatif objektif, tujuan objektif, dan minimal satu uraian langkah kerja).');
  const rawCat=f3?parseJson_(f3.CatatanJSON,[]):[],cat=(typeof wfNormalizeAuditNotes_==='function'?wfNormalizeAuditNotes_(rawCat):rawCat);req(f3&&cat.some(function(x){return cleanText_(x.catatan);}), 'Form 3 belum memiliki minimal satu catatan audit.');
  const missingResult=assigned.filter(function(a){return !findings.some(function(f){return cleanText_(f.AssignID)===cleanText_(a.AssignID)&&AMI_CONFIG.CAPAIAN.indexOf(cleanText_(f.Kategori))>=0;});});req(!missingResult.length,'Hasil audit belum ditetapkan pada '+missingResult.length+' butir.');
  const neg=findings.filter(function(f){return ['MENYIMPANG','BELUM MENCAPAI'].indexOf(cleanText_(f.Kategori))>=0;});
  const badNeg=neg.filter(function(f){return !cleanText_(f.Deskripsi)||!cleanText_(f.Kriteria)||!cleanText_(f.Akibat)||!cleanText_(f.AkarPenyebab)||!cleanText_(f.Rekomendasi);});req(!badNeg.length,'Rincian temuan auditor belum lengkap pada '+badNeg.length+' temuan.');
  const badFu=neg.filter(function(f){return !cleanText_(f.RencanaPerbaikan)||!cleanText_(f.JadwalPerbaikan)||!cleanText_(f.PJPerbaikan);});req(!badFu.length,'Tindak lanjut wajib (Rencana Perbaikan, Jadwal, Penanggung Jawab) belum lengkap pada '+badFu.length+' temuan.');
  const pos=findings.filter(function(f){return ['MENCAPAI','MELAMPAUI'].indexOf(cleanText_(f.Kategori))>=0;});
  const badPos=pos.filter(function(f){const imp=improvements.find(function(x){return cleanText_(x.AssignID)===cleanText_(f.AssignID);})||{};return !cleanText_(imp.FaktorPendukung)||!cleanText_(imp.RekomendasiPeningkatanIndikator);});req(!badPos.length,'Faktor Pendukung dan Rekomendasi Peningkatan Indikator belum lengkap pada '+badPos.length+' butir positif.');
  warn(evidence.length>0,'Belum ada bukti pendukung tercatat.');
  return {ok:errors.length===0,errors:errors,warnings:warnings,hash:approvalHash_(id),counts:{standards:assigned.length,self:self.length,evidence:evidence.length,desk:desk.length,results:findings.length,negative:neg.length,positive:pos.length},approvals:ap};
}
function validateAuditForFinal_(auditId){
  ensureSheetReady_('AMI_IMPROVEMENT',SHEET_DEFS.AMI_IMPROVEMENT);
  return validateAuditForFinalData_(auditId,null);
}

function getAuditValidation(token,auditId){const u=session_(token);assertAuditAccess_(u,auditId,false);return serializeValue_(validateAuditForFinal_(auditId));}
