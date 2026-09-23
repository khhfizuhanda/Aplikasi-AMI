function getAccessibleAudits(token){
  const u=session_(token),rows=filterAuditsForUser_(u,getAllRows_('AMI_AUDITI'));
  const allowed={};rows.forEach(function(a){allowed[cleanText_(a.AuditID)]=true;});
  const counts={};rows.forEach(function(a){counts[cleanText_(a.AuditID)]={StandardCount:0,SelfDone:0,DeskDone:0,Assessed:0};});
  getAllRows_('AMI_STANDARD_ASSIGN').forEach(function(x){const id=cleanText_(x.AuditID);if(allowed[id]&&bool_(x.Active))counts[id].StandardCount++;});
  getAllRows_('SELF_EVAL').forEach(function(x){const id=cleanText_(x.AuditID);if(allowed[id]&&cleanText_(x.Capaian))counts[id].SelfDone++;});
  getAllRows_('DESK_EVAL').forEach(function(x){const id=cleanText_(x.AuditID);if(allowed[id]&&cleanText_(x.StatusDesk))counts[id].DeskDone++;});
  getAllRows_('FINDINGS').forEach(function(x){const id=cleanText_(x.AuditID);if(allowed[id]&&cleanText_(x.Kategori))counts[id].Assessed++;});
  return rows.map(function(a){return Object.assign(cleanRow_(a),counts[cleanText_(a.AuditID)]||{StandardCount:0,SelfDone:0,DeskDone:0,Assessed:0});});
}

function assertAuditAccess_(u,auditId,writeMode){const audit=findOne_('AMI_AUDITI','AuditID',auditId);if(!audit)throw new Error('Audit tidak ditemukan.');const role=cleanText_(u.Role);if(role==='ADMIN_BPM')return audit;if(role==='PIMPINAN'&&isAuditInPimpinanScope_(u,audit))return audit;if(role==='AUDITI'&&cleanText_(audit.AuditiType)===cleanText_(u.RefType)&&cleanText_(audit.AuditiID)===cleanText_(u.RefID))return audit;if(role==='AUDITOR'){const team=findOne_('AMI_TEAM','AuditID',auditId);if(team&&[team.LeadAuditorID,team.Member1ID,team.Member2ID].map(cleanText_).indexOf(cleanText_(u.RefID))>=0)return audit;}throw new Error('Anda tidak memiliki akses ke audit ini.');}
function isLeadAuditor_(u,auditId){if(cleanText_(u.Role)!=='AUDITOR')return false;const t=findOne_('AMI_TEAM','AuditID',auditId);return !!t&&cleanText_(t.LeadAuditorID)===cleanText_(u.RefID);}
function assertNotFinal_(audit){if(cleanText_(audit.Status)==='FINAL')throw new Error('Audit sudah FINAL dan dikunci.');}
function assignedStandards_(auditId){
  const assigns=getAllRows_('AMI_STANDARD_ASSIGN').filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId)&&bool_(r.Active);});
  // V27: assignment final menyimpan snapshot standar. MASTER_STANDAR (teks panjang
  // ±130 butir) hanya dibaca bila ada assignment lama yang belum memiliki snapshot
  // inti. Ini memangkas I/O paling mahal saat Auditi/Auditor membuka workspace.
  const needsMaster=assigns.some(function(a){return !cleanText_(a.ItemCode)||!cleanText_(a.NamaStandar)||!cleanText_(a.PernyataanStandarSnapshot)||!cleanText_(a.IndikatorSnapshot);});
  const masters=needsMaster?getAllRows_('MASTER_STANDAR'):[];
  const byId={};masters.forEach(function(m){byId[cleanText_(m.StandardID)]=m;});
  return assigns.map(function(a){
    const m=byId[cleanText_(a.StandardID)]||{};
    const snap={
      StandardID:a.StandardID,
      ItemCode:a.ItemCode||m.ItemCode,
      NamaStandar:a.NamaStandar||m.NamaStandar,
      Kelompok:a.KelompokSnapshot||m.Kelompok,
      KodeKelompokStandar:a.KodeKelompokSnapshot||m.KodeKelompokStandar,
      PernyataanStandar:a.PernyataanStandarSnapshot||m.PernyataanStandar,
      StrategiPencapaian:a.StrategiSnapshot||m.StrategiPencapaian,
      Indikator:a.IndikatorSnapshot||m.Indikator,
      SumberFile:a.SumberFileSnapshot||m.SumberFile,
      TahunSumber:a.TahunSumberSnapshot||m.TahunSumber,
      SourceHash:a.SourceHashSnapshot||m.SourceHash,
      Versi:a.VersiStandarSnapshot||m.Versi,
      TahunBerlakuMulai:a.TahunBerlakuSnapshot||m.TahunBerlakuMulai
    };
    return Object.assign(cleanRow_(a),{standard:cleanRow_(snap)});
  });
}
function teamWithNames_(auditId){const t=findOne_('AMI_TEAM','AuditID',auditId);if(!t)return{};const auds=getAllRows_('MASTER_AUDITOR');function info(id){const a=auds.find(x=>x.AuditorID===id);return a?{id:id,nama:a.Nama,unit:a.Unit,sertifikasi:a.Sertifikasi}:{id:id,nama:id};}return{Lead:info(t.LeadAuditorID),Member1:info(t.Member1ID),Member2:info(t.Member2ID)};}
function formatApprovalTime_(v){
  if(!v)return'-';if(v instanceof Date)return Utilities.formatDate(v,AMI_CONFIG.TIMEZONE,'dd/MM/yyyy HH:mm')+' WIB';
  const s=cleanText_(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]+' '+m[4]+':'+m[5]+' WIB':s;
}

function workflowVisitTimeText_(value) {
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

function workflowVisitView_(visit) {
  var out = cleanRow_(visit || {});
  out.JamMulai = workflowVisitTimeText_(visit && visit.JamMulai);
  out.JamSelesai = workflowVisitTimeText_(visit && visit.JamSelesai);
  return out;
}

function approvalMapFromRows_(rows){const out={};(rows||[]).filter(function(r){return bool_(r.Approved);}).forEach(function(r){const x=cleanRow_(r);x.ApprovedAtDisplay=formatApprovalTime_(r.ApprovedAt);out[cleanText_(r.Stage)]=x;});return out;}
function approvalMap_(auditId){return approvalMapFromRows_(getAllRows_('APPROVAL').filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId);}));}
function getAuditWorkspace(token,auditId){
  const u=session_(token),audit=assertAuditAccess_(u,auditId,false),id=cleanText_(auditId);
  ensureSheetReady_('SELF_FOLLOW_UP',SHEET_DEFS.SELF_FOLLOW_UP);ensureSheetReady_('AMI_IMPROVEMENT',SHEET_DEFS.AMI_IMPROVEMENT);
  const cycle=findOne_('AMI_CYCLE','CycleID',audit.CycleID),assigned=assignedStandards_(id);
  const selfRaw=getAllRows_('SELF_EVAL').filter(function(r){return cleanText_(r.AuditID)===id;});
  const evRaw=getAllRows_('EVIDENCE').filter(function(r){return cleanText_(r.AuditID)===id;});
  const deskRaw=getAllRows_('DESK_EVAL').filter(function(r){return cleanText_(r.AuditID)===id;});
  const findingsRaw=getAllRows_('FINDINGS').filter(function(r){return cleanText_(r.AuditID)===id;});
  const followRaw=getAllRows_('SELF_FOLLOW_UP').filter(function(r){return cleanText_(r.AuditID)===id;});
  const improvementRaw=getAllRows_('AMI_IMPROVEMENT').filter(function(r){return cleanText_(r.AuditID)===id;});
  const visit=findOne_('VISIT','AuditID',id)||{},f2=findOne_('FORM2_PROGRAM_KERJA','AuditID',id)||{},f3=findOne_('FORM3_CATATAN','AuditID',id)||{};
  const approvalRows=getAllRows_('APPROVAL').filter(function(r){return cleanText_(r.AuditID)===id;});
  const reports=getAllRows_('REPORT_LOG').filter(function(r){return cleanText_(r.AuditID)===id;});
  const validationData={audit:audit,assigned:assigned,self:selfRaw,evidence:evRaw,desk:deskRaw,findings:findingsRaw,followUps:followRaw,improvements:improvementRaw,visit:visit,form2:f2,form3:f3,approvals:approvalMapFromRows_(approvalRows),team:findOne_('AMI_TEAM','AuditID',id)||{}};
  const validation=typeof validateAuditForFinalData_==='function'?validateAuditForFinalData_(id,validationData):validateAuditForFinal_(id);
  return serializeValue_({audit:cleanRow_(audit),cycle:cleanRow_(cycle||{}),team:teamWithNames_(id),assigned:assigned,selfEval:selfRaw.map(cleanRow_),evidence:evRaw.map(cleanRow_),desk:deskRaw.map(cleanRow_),findings:findingsRaw.map(cleanRow_),selfFollowUps:followRaw.map(cleanRow_),improvements:improvementRaw.map(cleanRow_),visit:workflowVisitView_(visit),form2:cleanRow_(f2),form3:cleanRow_(f3),approvals:validationData.approvals,reports:reports.map(cleanRow_),validation:validation,permissions:{canSelf:cleanText_(u.Role)==='AUDITI',canAudit:cleanText_(u.Role)==='AUDITOR',isLead:isLeadAuditor_(u,id),canBpm:cleanText_(u.Role)==='ADMIN_BPM',canAuditiApprove:cleanText_(u.Role)==='AUDITI',canPimpinanApprove:canPimpinanApproveAudit_(u,audit),pimpinanProfile:getPimpinanProfile_(u),readOnly:['PIMPINAN','ADMIN_BPM'].indexOf(cleanText_(u.Role))>=0}});
}



var V27_EVIDENCE_FOLDER_PROP_PREFIX_='AMI_V27_EVIDENCE_FOLDER_';
function evidenceFolder_(auditId){
  auditId=cleanText_(auditId);if(!auditId)throw new Error('AuditID bukti tidak tersedia.');
  const props=PropertiesService.getScriptProperties(),propKey=V27_EVIDENCE_FOLDER_PROP_PREFIX_+auditId;
  let folderId='';try{folderId=cleanText_(CacheService.getScriptCache().get(propKey));}catch(ignore){}
  if(!folderId)try{folderId=cleanText_(props.getProperty(propKey));}catch(ignore){}
  if(folderId){try{const ready=DriveApp.getFolderById(folderId);try{CacheService.getScriptCache().put(propKey,folderId,21600);}catch(ignoreCache){}return ready;}catch(ignoreInvalid){try{props.deleteProperty(propKey);}catch(ignoreDelete){}}}

  // Root diperoleh sebelum mengambil lock agar helper root tidak menjadi nested lock.
  const root=getRootFolder_(),lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Folder bukti sedang disiapkan oleh pengguna lain. Tunggu beberapa detik lalu unggah kembali.');
  try{
    invalidateRowsCache_();
    folderId=cleanText_(props.getProperty(propKey));
    if(folderId){try{return DriveApp.getFolderById(folderId);}catch(ignoreStale){props.deleteProperty(propKey);}}
    const audit=findOne_('AMI_AUDITI','AuditID',auditId),cycle=audit?findOne_('AMI_CYCLE','CycleID',audit.CycleID):null;
    const cy=getOrCreateChildFolder_(root,safeFileName_((cycle&&cycle.NamaSiklus)||'AMI 2026'));
    const au=getOrCreateChildFolder_(cy,safeFileName_((audit&&audit.AuditiName)||auditId));
    const ev=getOrCreateChildFolder_(au,'Bukti Pendukung');
    props.setProperty(propKey,ev.getId());
    try{CacheService.getScriptCache().put(propKey,ev.getId(),21600);}catch(ignoreCache2){}
    return ev;
  }finally{try{lock.releaseLock();}catch(ignoreRelease){}}
}
function getOrCreateChildFolder_(parent,name){const it=parent.getFoldersByName(name);return it.hasNext()?it.next():parent.createFolder(name);}
function getRootFolder_(){
  let id=getSetting_('ROOT_FOLDER_ID','');if(id){try{return DriveApp.getFolderById(id);}catch(ignoreInvalid){}}
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Folder utama AMI sedang disiapkan. Tunggu beberapa detik lalu coba kembali.');
  try{
    invalidateRowsCache_('SETTINGS');
    id=getSetting_('ROOT_FOLDER_ID','');if(id){try{return DriveApp.getFolderById(id);}catch(ignoreStale){}}
    const f=DriveApp.createFolder('AMI UMA 2026 - Data dan Laporan');
    setSetting_('ROOT_FOLDER_ID',f.getId(),'Folder utama AMI','SYSTEM');
    return f;
  }finally{try{lock.releaseLock();}catch(ignoreRelease){}}
}
function safeFileName_(s){return String(s||'AMI').replace(/[\\/:*?"<>|#%{}~&]/g,'-').replace(/\s+/g,' ').trim().substring(0,120);}
function updateEvidenceCount_(auditId,assignId){const se=getAllRows_('SELF_EVAL').find(function(r){return cleanText_(r.AuditID)===cleanText_(auditId)&&cleanText_(r.AssignID)===cleanText_(assignId);});if(!se)return;const n=getAllRows_('EVIDENCE').filter(function(e){return cleanText_(e.AuditID)===cleanText_(auditId)&&cleanText_(e.StandardID)===cleanText_(se.StandardID);}).length;updateRow_('SELF_EVAL',se._row,{BuktiCount:n});}

function uploadEvidence(token,auditId,assignId,payload){
  // Validasi/decode/Drive upload berada di luar transaksi sheet agar pengguna
  // berbeda tidak saling menunggu selama transfer file.
  var u=requireRole_(token,['AUDITI']);
  var audit=assertAuditAccess_(u,auditId,true);assertNotFinal_(audit);
  var lockedStatuses=['EVALUASI DIRI DIKIRIM','DESK EVALUATION','SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','MENUNGGU ACC AUDITI','MENUNGGU ACC LEAD','MENUNGGU ACC BPM'];
  if(lockedStatuses.indexOf(cleanText_(audit.Status))>=0)throw new Error('Bukti dikunci setelah Evaluasi Diri dikirim.');
  ensureSheetReady_('EVIDENCE',SHEET_DEFS.EVIDENCE);

  var asn=findOne_('AMI_STANDARD_ASSIGN','AssignID',assignId);
  if(!asn||cleanText_(asn.AuditID)!==cleanText_(auditId))throw new Error('Butir standar tidak valid.');
  var se=getAllRows_('SELF_EVAL').find(function(r){return cleanText_(r.AuditID)===cleanText_(auditId)&&cleanText_(r.AssignID)===cleanText_(assignId);});
  if(!se)throw new Error('Simpan Evaluasi Diri terlebih dahulu sebelum mengunggah bukti.');

  payload=payload||{};
  var clientKey=cleanText_(payload.ClientKey);
  if(clientKey){
    var prior=getAllRows_('EVIDENCE').find(function(e){return cleanText_(e.AuditID)===cleanText_(auditId)&&cleanText_(e.StandardID)===cleanText_(asn.StandardID)&&cleanText_(e.ClientKey)===clientKey&&cleanText_(e.JenisBukti)==='FILE';});
    if(prior)return{ok:true,id:prior.EvidenceID,name:prior.NamaBukti,url:prior.URL,reused:true};
  }

  var base64=cleanText_(payload.base64),name=safeFileName_(payload.name||'bukti');
  if(!base64)throw new Error('File kosong.');
  var ext=(name.split('.').pop()||'').toLowerCase(),allowed=['pdf','doc','docx','xls','xlsx','ppt','pptx','jpg','jpeg','png','webp','txt','csv'];
  if(allowed.indexOf(ext)<0)throw new Error('Jenis file tidak diizinkan. Gunakan PDF, Office, gambar, TXT, atau CSV.');
  var bytes=Utilities.base64Decode(base64);
  if(bytes.length>AMI_CONFIG.MAX_UPLOAD_BYTES)throw new Error('Ukuran file maksimal '+Math.round(AMI_CONFIG.MAX_UPLOAD_BYTES/1024/1024)+' MB.');

  var blob=Utilities.newBlob(bytes,payload.mimeType||'application/octet-stream',name);
  var file=null,recorded=false;
  try{
    file=evidenceFolder_(auditId).createFile(blob);
    return withLock_(function(){
      // Recheck sesudah transfer: status dapat berubah saat file sedang dikirim.
      u=requireRole_(token,['AUDITI']);
      audit=assertAuditAccess_(u,auditId,true);assertNotFinal_(audit);
      if(lockedStatuses.indexOf(cleanText_(audit.Status))>=0)throw new Error('Bukti dikunci karena Evaluasi Diri sudah dikirim.');
      asn=findOne_('AMI_STANDARD_ASSIGN','AssignID',assignId);
      if(!asn||cleanText_(asn.AuditID)!==cleanText_(auditId))throw new Error('Butir standar tidak valid.');
      se=getAllRows_('SELF_EVAL').find(function(r){return cleanText_(r.AuditID)===cleanText_(auditId)&&cleanText_(r.AssignID)===cleanText_(assignId);});
      if(!se)throw new Error('Evaluasi Diri tidak ditemukan.');

      if(clientKey){
        var reused=getAllRows_('EVIDENCE').find(function(e){return cleanText_(e.AuditID)===cleanText_(auditId)&&cleanText_(e.StandardID)===cleanText_(asn.StandardID)&&cleanText_(e.ClientKey)===clientKey&&cleanText_(e.JenisBukti)==='FILE';});
        if(reused){try{file.setTrashed(true);}catch(ignoreTrashDuplicate){}return{ok:true,id:reused.EvidenceID,name:reused.NamaBukti,url:reused.URL,reused:true};}
      }

      var id=uuid_('EVD');
      appendObject_('EVIDENCE',{EvidenceID:id,SelfEvalID:se.SelfEvalID,AuditID:auditId,StandardID:asn.StandardID,NamaBukti:name,JenisBukti:'FILE',URL:file.getUrl(),DriveFileID:file.getId(),Keterangan:cleanText_(payload.Keterangan),ClientKey:clientKey,FileSize:bytes.length,UploadedAt:now_(),UploadedBy:u.Nama});
      // Mulai titik ini record adalah sumber kebenaran. Bila metadata sekunder gagal,
      // file JANGAN ditrash karena akan menghasilkan baris bukti dengan link rusak.
      recorded=true;
      try{updateEvidenceCount_(auditId,assignId);}catch(ignoreCount){}
      try{auditLog_(u,'UPLOAD_EVIDENCE','EVIDENCE',auditId,id,'',{name:name,size:bytes.length,clientKey:clientKey});}catch(ignoreLog){}
      return{ok:true,id:id,name:name,url:file.getUrl(),reused:false};
    });
  }catch(e){
    // Hanya file yang belum tercatat di database yang dibersihkan dari Drive.
    if(file&&!recorded){try{file.setTrashed(true);}catch(ignoreTrash){}}
    throw e;
  }
}
function deleteEvidence(token,evidenceId){
  var driveFileId='';
  var result=withLock_(function(){
    const u=requireRole_(token,['AUDITI']),e=findOne_('EVIDENCE','EvidenceID',evidenceId);
    if(!e)throw new Error('Bukti tidak ditemukan.');
    const audit=assertAuditAccess_(u,e.AuditID,true);assertNotFinal_(audit);
    if(['EVALUASI DIRI DIKIRIM','DESK EVALUATION','SIAP VISITASI','VISITASI BERJALAN','HASIL AUDIT DIISI','MENUNGGU ACC AUDITI','MENUNGGU ACC LEAD','MENUNGGU ACC BPM'].indexOf(cleanText_(audit.Status))>=0)throw new Error('Bukti dikunci setelah Evaluasi Diri dikirim.');
    driveFileId=cleanText_(e.DriveFileID);
    // Database dihapus lebih dahulu. Drive cleanup yang lambat dilakukan setelah
    // lock dilepas sehingga tidak menahan proses Simpan user lain.
    deleteRowByKey_('EVIDENCE','EvidenceID',evidenceId);
    const se=getAllRows_('SELF_EVAL').find(function(r){return cleanText_(r.AuditID)===cleanText_(e.AuditID)&&cleanText_(r.StandardID)===cleanText_(e.StandardID);});
    if(se){try{updateEvidenceCount_(e.AuditID,se.AssignID);}catch(ignoreCount){}}
    try{auditLog_(u,'DELETE_EVIDENCE','EVIDENCE',e.AuditID,evidenceId,e,'');}catch(ignoreLog){}
    return{ok:true};
  });
  if(driveFileId){try{DriveApp.getFileById(driveFileId).setTrashed(true);}catch(err){result.warning='Record bukti sudah dihapus, tetapi pembersihan file Drive tertunda.';}}
  return result;
}
function submitSelfEvaluation(token,auditId){return withLock_(function(){
  const u=requireRole_(token,['AUDITI']),audit=assertAuditAccess_(u,auditId,true);assertNotFinal_(audit),id=cleanText_(auditId);
  ensureSheetReady_('SELF_EVAL',SHEET_DEFS.SELF_EVAL);
  ensureSheetReady_('SELF_FOLLOW_UP',SHEET_DEFS.SELF_FOLLOW_UP);
  ensureSheetReady_('AMI_IMPROVEMENT',SHEET_DEFS.AMI_IMPROVEMENT);
  const assigned=assignedStandards_(id),
    self=getAllRows_('SELF_EVAL').filter(function(r){return cleanText_(r.AuditID)===id;}),
    evidence=getAllRows_('EVIDENCE').filter(function(r){return cleanText_(r.AuditID)===id;}),
    follow=getAllRows_('SELF_FOLLOW_UP').filter(function(r){return cleanText_(r.AuditID)===id;}),
    improvements=getAllRows_('AMI_IMPROVEMENT').filter(function(r){return cleanText_(r.AuditID)===id;}),
    missing=[],missingEvidence=[],missingNegativeAnalysis=[],missingFollow=[],missingImprovement=[];

  assigned.forEach(function(a){
    const se=self.find(function(x){return cleanText_(x.AssignID)===cleanText_(a.AssignID);});
    if(!se||!cleanText_(se.Capaian)||!cleanText_(se.EvaluasiDiri))missing.push(a.ItemCode);
    if(AMI_CONFIG.REQUIRE_EVIDENCE_PER_ITEM!==false&&!evidence.some(function(e){return cleanText_(e.StandardID)===cleanText_(a.StandardID);}))missingEvidence.push(a.ItemCode);

    if(se&&['MENYIMPANG','BELUM MENCAPAI'].indexOf(cleanText_(se.Capaian))>=0){
      if(!cleanText_(se.EvaluasiDiri)||!cleanText_(se.Akibat)||!cleanText_(se.AkarPenyebab))missingNegativeAnalysis.push(a.ItemCode);
      const f=follow.find(function(x){return cleanText_(x.AssignID)===cleanText_(a.AssignID);})||{};
      if(!cleanText_(f.RencanaPerbaikan)||!cleanText_(f.JadwalPerbaikan)||!cleanText_(f.PJPerbaikan))missingFollow.push(a.ItemCode);
    }

    if(se&&['MENCAPAI','MELAMPAUI'].indexOf(cleanText_(se.Capaian))>=0){
      const imp=improvements.find(function(x){return cleanText_(x.AssignID)===cleanText_(a.AssignID);})||{};
      if(!cleanText_(imp.FaktorPendukung)||!cleanText_(imp.RekomendasiPeningkatanIndikator))missingImprovement.push(a.ItemCode);
    }
  });

  if(missing.length)throw new Error('Evaluasi Diri belum lengkap pada '+missing.length+' butir: '+missing.slice(0,8).join(', ')+(missing.length>8?' ...':''));
  if(missingEvidence.length)throw new Error('Bukti pendukung belum tersedia pada '+missingEvidence.length+' butir: '+missingEvidence.slice(0,8).join(', ')+(missingEvidence.length>8?' ...':''));
  if(missingNegativeAnalysis.length)throw new Error('Deskripsi Temuan (Evaluasi Diri/Penjelasan), Akibat, dan Akar Penyebab/Masalah wajib pada '+missingNegativeAnalysis.length+' butir negatif: '+missingNegativeAnalysis.slice(0,8).join(', '));
  if(missingFollow.length)throw new Error('Rencana Perbaikan, Jadwal Perbaikan, dan Penanggung Jawab wajib pada '+missingFollow.length+' butir negatif: '+missingFollow.slice(0,8).join(', '));
  if(missingImprovement.length)throw new Error('Faktor Pendukung dan Rekomendasi Peningkatan Standar wajib pada '+missingImprovement.length+' butir MENCAPAI/MELAMPAUI: '+missingImprovement.slice(0,8).join(', '));

  const stamp=now_(),patches=self.map(function(se){return{AuditID:id,AssignID:se.AssignID,Status:'SUBMITTED',SubmittedAt:stamp,SubmittedBy:u.Nama};});
  if(patches.length)batchUpsert_('SELF_EVAL',['AuditID','AssignID'],patches,['NilaiCapaian']);
  updateRow_('AMI_AUDITI',audit._row,{Status:'EVALUASI DIRI DIKIRIM'});
  auditLog_(u,'SUBMIT_SELF_EVAL','AMI_AUDITI',id,id,audit,{Status:'EVALUASI DIRI DIKIRIM'});
  return{ok:true};
});}
function returnSelfEvaluation(token,auditId,note){return withLock_(function(){
  const u=session_(token),audit=assertAuditAccess_(u,auditId,true);
  if(!(cleanText_(u.Role)==='ADMIN_BPM'||isLeadAuditor_(u,auditId)))throw new Error('Hanya Lead Auditor atau BPM yang dapat mengembalikan Evaluasi Diri.');
  assertNotFinal_(audit);
  const status=cleanText_(audit.Status);
  const allowed=[
    'EVALUASI DIRI DIKIRIM',
    'DESK EVALUATION',
    'SIAP VISITASI',
    'VISITASI BERJALAN',
    'HASIL AUDIT DIISI',
    'PERLU REVISI AUDITOR'
  ];
  if(allowed.indexOf(status)<0){
    throw new Error('Evaluasi Diri tidak dapat dikembalikan pada status '+status+'. Pengembalian hanya diizinkan sebelum hasil audit dikirim untuk persetujuan.');
  }
  const rows=getAllRows_('SELF_EVAL').filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
  if(rows.length)batchUpsert_('SELF_EVAL',['AuditID','AssignID'],rows.map(function(r){return{AuditID:auditId,AssignID:r.AssignID,Status:'RETURNED',SubmittedAt:'',SubmittedBy:''};}),['NilaiCapaian']);
  updateRow_('AMI_AUDITI',audit._row,{Status:'PERLU REVISI AUDITI'});
  deleteRowsByPredicate_('DESK_EVAL',function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
  deleteRowsByPredicate_('FINDINGS',function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
  // Data visitasi dan Form 2/Form 3 sengaja dipertahankan. Hanya hasil penilaian yang
  // bergantung pada Evaluasi Diri lama yang direset agar dapat dinilai ulang setelah revisi Auditi.
  try{
    var impRows=getAllRows_('AMI_IMPROVEMENT').filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
    if(impRows.length)batchUpsert_('AMI_IMPROVEMENT',['AuditID','AssignID'],impRows.map(function(r){return{AuditID:auditId,AssignID:r.AssignID,KategoriFinal:'',Status:['MENCAPAI','MELAMPAUI'].indexOf(cleanText_(r.CapaianAwal))>=0?'DRAFT AUDITI':'TIDAK DIPERLUKAN',UpdatedAt:now_(),UpdatedBy:u.Nama};}),[]);
  }catch(ignoreImpReset){}
  auditLog_(u,'RETURN_SELF_EVAL','AMI_AUDITI',auditId,auditId,audit,{Status:'PERLU REVISI AUDITI',note:cleanText_(note)});
  return{ok:true};
});}


function finishDeskEvaluation(token,auditId){return withLock_(function(){
  const u=requireRole_(token,['AUDITOR']),audit=assertAuditAccess_(u,auditId,true);if(!isLeadAuditor_(u,auditId))throw new Error('Hanya Lead Auditor yang dapat menyelesaikan Desk Evaluation.');assertAuditorEditable_(audit);
  if(['EVALUASI DIRI DIKIRIM','DESK EVALUATION','PERLU REVISI AUDITOR'].indexOf(cleanText_(audit.Status))<0)throw new Error('Tahap audit tidak sesuai untuk menyelesaikan Desk Evaluation.');
  const assigned=assignedStandards_(auditId),desk=getAllRows_('DESK_EVAL').filter(r=>r.AuditID===auditId),missing=assigned.filter(a=>!desk.some(d=>d.AssignID===a.AssignID&&cleanText_(d.StatusDesk)));if(missing.length)throw new Error('Desk Evaluation belum lengkap: '+missing.length+' butir.');
  updateRow_('AMI_AUDITI',audit._row,{Status:'SIAP VISITASI'});auditLog_(u,'FINISH_DESK','AMI_AUDITI',auditId,auditId,audit,{Status:'SIAP VISITASI'});return{ok:true};
});}

function assertAuditorEditable_(audit){assertNotFinal_(audit);if(['MENUNGGU ACC AUDITI','MENUNGGU ACC LEAD','MENUNGGU ACC BPM'].indexOf(cleanText_(audit.Status))>=0)throw new Error('Data audit sedang dalam proses persetujuan. Kembalikan untuk revisi terlebih dahulu.');}






function submitAuditResult(token,auditId){return withLock_(function(){
  const u=session_(token),audit=assertAuditAccess_(u,auditId,true);
  if(!isLeadAuditor_(u,auditId))throw new Error('Hanya Lead Auditor yang dapat mengirim hasil audit untuk persetujuan.');
  assertNotFinal_(audit);
  if(['VISITASI BERJALAN','HASIL AUDIT DIISI','PERLU REVISI AUDITOR'].indexOf(cleanText_(audit.Status))<0)throw new Error('Hasil audit belum berada pada tahap yang dapat dikirim.');
  // Satu validasi resmi: temuan negatif lengkap dan hasil positif memiliki faktor pendukung + rekomendasi peningkatan.
  if(typeof validateAuditResult_==='function'){
    const check=validateAuditResult_(token,auditId);
    if(!check.ok)throw new Error('Hasil Audit belum lengkap. '+check.errors.slice(0,10).join(' | ')+(check.errors.length>10?' | dan '+(check.errors.length-10)+' masalah lainnya.':''));
  }else{
    const assigned=assignedStandards_(auditId),findings=getAllRows_('FINDINGS').filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
    const missing=assigned.filter(function(a){return !findings.some(function(f){return cleanText_(f.AssignID)===cleanText_(a.AssignID)&&cleanText_(f.Kategori);});});
    if(missing.length)throw new Error('Hasil audit belum ditetapkan untuk '+missing.length+' butir standar.');
  }
  const visit=findOne_('VISIT','AuditID',auditId)||{};
  if(!cleanText_(visit.Tanggal)||!cleanText_(visit.Lokasi)||!cleanText_(visit.WakilAuditi))throw new Error('Data visitasi belum lengkap. Isi tanggal, lokasi, dan wakil Auditi.');
  const form2=findOne_('FORM2_PROGRAM_KERJA','AuditID',auditId)||{},rawPrograms=parseJson_(form2.LangkahJSON,[]),programs=(typeof wfNormalizeProgramForms_==='function'?wfNormalizeProgramForms_(rawPrograms,form2):rawPrograms);
  const incompletePrograms=!programs.length||programs.some(function(p){var ls=Array.isArray(p&&p.langkahKerja)?p.langkahKerja:[];if(!ls.length&&p&&p.uraian)ls=[p];return !cleanText_(p&&p.tentatifAuditObjektif)||!cleanText_(p&&p.tujuanAudit)||!ls.some(function(x){return cleanText_(x&&x.uraian);});});
  if(incompletePrograms)throw new Error('Program Kerja Audit belum lengkap. Setiap form wajib memiliki Tentatif Audit Objektif, Tujuan Audit Objektif, dan minimal satu Uraian Langkah Kerja.');
  const form3=findOne_('FORM3_CATATAN','AuditID',auditId)||{},rawNotes=parseJson_(form3.CatatanJSON,[]),notes=(typeof wfNormalizeAuditNotes_==='function'?wfNormalizeAuditNotes_(rawNotes):rawNotes);
  if(!notes.some(function(x){return cleanText_(x&&x.catatan);}))throw new Error('Catatan Auditor belum diisi. Tambahkan minimal satu Catatan Audit sebelum mengirim hasil.');
  deleteRowsByPredicate_('APPROVAL',function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
  updateRow_('AMI_AUDITI',audit._row,{Status:'MENUNGGU ACC AUDITI'});
  auditLog_(u,'SUBMIT_AUDIT_RESULT','AMI_AUDITI',auditId,auditId,audit,{Status:'MENUNGGU ACC AUDITI'});
  return{ok:true};
});}

function approvalHash_(auditId){
  const id=cleanText_(auditId),assigned=assignedStandards_(id).map(function(x){return{AssignID:x.AssignID,StandardID:x.StandardID,ItemCode:x.ItemCode,SourceHash:x.standard&&x.standard.SourceHash||''};}).sort(function(a,b){return String(a.AssignID).localeCompare(String(b.AssignID));});
  function rows(name){try{return getAllRows_(name).filter(function(r){return cleanText_(r.AuditID)===id;}).map(cleanRow_).sort(function(a,b){return String(a.AssignID||a.EvidenceID||'').localeCompare(String(b.AssignID||b.EvidenceID||''));});}catch(ignore){return[];}}
  const evidence=rows('EVIDENCE').map(function(r){return{EvidenceID:r.EvidenceID,StandardID:r.StandardID,NamaBukti:r.NamaBukti,JenisBukti:r.JenisBukti,URL:r.URL,DriveFileID:r.DriveFileID,Keterangan:r.Keterangan,ClientKey:r.ClientKey||''};});
  const data={assigned:assigned,self:rows('SELF_EVAL'),selfFollowUp:rows('SELF_FOLLOW_UP'),desk:rows('DESK_EVAL'),findings:rows('FINDINGS'),improvements:rows('AMI_IMPROVEMENT'),evidence:evidence,visit:cleanRow_(findOne_('VISIT','AuditID',id)||{}),f2:cleanRow_(findOne_('FORM2_PROGRAM_KERJA','AuditID',id)||{}),f3:cleanRow_(findOne_('FORM3_CATATAN','AuditID',id)||{}),team:cleanRow_(findOne_('AMI_TEAM','AuditID',id)||{})};
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(data),Utilities.Charset.UTF_8);return bytes.map(function(b){return('0'+((b<0?b+256:b).toString(16))).slice(-2);}).join('').substring(0,32);
}
function assertApprovalCurrent_(auditId,stage){const ap=getAllRows_('APPROVAL').find(r=>r.AuditID===auditId&&cleanText_(r.Stage)===stage&&bool_(r.Approved));if(!ap)throw new Error('Persetujuan '+stage+' belum tersedia.');if(cleanText_(ap.VersionHash)!==approvalHash_(auditId))throw new Error('Data audit berubah setelah persetujuan '+stage+'. Kembalikan proses persetujuan dan lakukan ACC ulang.');return ap;}
function appendApproval_(u,auditId,stage,note){deleteRowsByPredicate_('APPROVAL',function(r){return cleanText_(r.AuditID)===cleanText_(auditId)&&cleanText_(r.Stage)===cleanText_(stage);});const stamp=now_(),rec={ApprovalID:uuid_('APR'),AuditID:auditId,Stage:stage,Approved:true,ApprovedByUserID:u.UserID,ApprovedByNama:u.Nama,ApprovedByRole:u.Role,ApprovedAt:stamp,VersionHash:approvalHash_(auditId),Note:cleanText_(note)};const row=appendObject_('APPROVAL',rec);writePlainTextCell_('APPROVAL',row,'ApprovedAt',stamp);return rec;}
function approveAudit(token,auditId,stage,note){return withLock_(function(){
  const u=session_(token),audit=assertAuditAccess_(u,auditId,true);assertNotFinal_(audit);stage=cleanText_(stage);
  if(stage==='AUDITI'){
    const firstRole=cleanText_(u.Role),firstAllowed=(firstRole==='AUDITI')||(firstRole==='PIMPINAN'&&canPimpinanApproveAudit_(u,audit));if(!firstAllowed||cleanText_(audit.Status)!=='MENUNGGU ACC AUDITI')throw new Error('Persetujuan Auditi tidak tersedia untuk akun/area akses ini pada tahap sekarang.');
    const neg=getAllRows_('FINDINGS').filter(function(f){return cleanText_(f.AuditID)===cleanText_(auditId)&&['MENYIMPANG','BELUM MENCAPAI'].indexOf(cleanText_(f.Kategori))>=0;}),missing=neg.filter(function(f){return !cleanText_(f.RencanaPerbaikan)||!cleanText_(f.JadwalPerbaikan)||!cleanText_(f.PJPerbaikan);});
    if(missing.length)throw new Error('Lengkapi Rencana Perbaikan, Jadwal Perbaikan, dan Penanggung Jawab pada '+missing.length+' temuan sebelum ACC.');appendApproval_(u,auditId,'AUDITI',note);updateRow_('AMI_AUDITI',audit._row,{Status:'MENUNGGU ACC LEAD'});
  }else if(stage==='LEAD_AUDITOR'){
    if(!isLeadAuditor_(u,auditId)||cleanText_(audit.Status)!=='MENUNGGU ACC LEAD')throw new Error('Persetujuan Lead Auditor tidak tersedia pada tahap ini.');assertApprovalCurrent_(auditId,'AUDITI');appendApproval_(u,auditId,'LEAD_AUDITOR',note);updateRow_('AMI_AUDITI',audit._row,{Status:'MENUNGGU ACC BPM'});
  }else if(stage==='BPM'){
    if(cleanText_(u.Role)!=='ADMIN_BPM'||cleanText_(audit.Status)!=='MENUNGGU ACC BPM')throw new Error('Persetujuan BPM tidak tersedia pada tahap ini.');assertApprovalCurrent_(auditId,'AUDITI');assertApprovalCurrent_(auditId,'LEAD_AUDITOR');const validation=validateAuditForFinal_(auditId);if(!validation.ok)throw new Error('Validasi final belum lolos: '+validation.errors.slice(0,8).join(' | '));
    appendApproval_(u,auditId,'BPM',note);updateRow_('AMI_AUDITI',audit._row,{Status:'FINAL'});auditLog_(u,'FINALIZE_AUDIT','AMI_AUDITI',auditId,auditId,audit,{Status:'FINAL'});return{ok:true,final:true,needsReport:true};
  }else throw new Error('Tahap persetujuan tidak valid.');
  auditLog_(u,'APPROVE_'+stage,'APPROVAL',auditId,'','',{note:note});return{ok:true};
});}
function returnAuditRevision(token,auditId,note){return withLock_(function(){const u=session_(token),audit=assertAuditAccess_(u,auditId,true);assertNotFinal_(audit);const role=cleanText_(u.Role),status=cleanText_(audit.Status);let allowed=false;if((role==='AUDITI'||(role==='PIMPINAN'&&canPimpinanApproveAudit_(u,audit)))&&status==='MENUNGGU ACC AUDITI')allowed=true;if(isLeadAuditor_(u,auditId)&&status==='MENUNGGU ACC LEAD')allowed=true;if(role==='ADMIN_BPM'&&status==='MENUNGGU ACC BPM')allowed=true;if(!allowed)throw new Error('Tidak dapat mengembalikan audit pada tahap ini.');deleteRowsByPredicate_('APPROVAL',r=>r.AuditID===auditId);updateRow_('AMI_AUDITI',audit._row,{Status:'PERLU REVISI AUDITOR'});auditLog_(u,'RETURN_AUDIT_REVISION','AMI_AUDITI',auditId,auditId,audit,{Status:'PERLU REVISI AUDITOR',note:cleanText_(note)});return{ok:true};});}


function downloadEvidenceFile(token,evidenceId){
  const u=session_(token),e=findOne_('EVIDENCE','EvidenceID',evidenceId);if(!e)throw new Error('Bukti tidak ditemukan.');assertAuditAccess_(u,e.AuditID,false);if(cleanText_(e.JenisBukti)!=='FILE'||!cleanText_(e.DriveFileID))throw new Error('Bukti ini berupa link eksternal.');
  try{const file=DriveApp.getFileById(e.DriveFileID),blob=file.getBlob();return{ok:true,fileName:file.getName(),mimeType:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())};}catch(err){logSystemError_('downloadEvidenceFile',err,u,{evidenceId:evidenceId,auditId:e.AuditID});throw new Error('File bukti tidak dapat dibuka. Hubungi BPM untuk memeriksa file di Google Drive.');}
}

function getRecentAuditLog(token,auditId){const u=session_(token);assertAuditAccess_(u,auditId,false);return getAllRows_('AUDIT_LOG').filter(r=>r.AuditID===auditId).slice(-30).reverse().map(cleanRow_);}
