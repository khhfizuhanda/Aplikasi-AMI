/**
 * MaintenanceService.gs — AMI 2026 Final Optimized
 * Reset transaksi audit untuk pengujian pra-launch.
 * Master Prodi/Unit, Master Standar, Master Auditor, Master Pimpinan,
 * Users, dan Siklus TIDAK dihapus.
 */
function maintenanceAuditCounts_(auditId){
  const sheets=['AMI_STANDARD_ASSIGN','AMI_TEAM','SELF_EVAL','SELF_FOLLOW_UP','EVIDENCE','DESK_EVAL','VISIT','FORM2_PROGRAM_KERJA','FORM3_CATATAN','FINDINGS','AMI_IMPROVEMENT','APPROVAL','REPORT_LOG','AUDIT_LOG'];
  const out={};
  sheets.forEach(function(name){
    try{out[name]=getAllRows_(name).filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId);}).length;}catch(ignore){out[name]=0;}
  });
  return out;
}
function getResetAuditPreview(token,auditId){
  requireRole_(token,['ADMIN_BPM']);
  const a=findOne_('AMI_AUDITI','AuditID',auditId);if(!a)throw new Error('Audit tidak ditemukan.');
  return serializeValue_({
    ok:true,
    audit:{AuditID:a.AuditID,AuditiName:a.AuditiName,AuditiType:a.AuditiType,AuditiID:a.AuditiID,Status:a.Status,CycleID:a.CycleID},
    counts:maintenanceAuditCounts_(auditId),
    confirmation:'RESET '+cleanText_(a.AuditiName),
    retained:['MASTER_PRODI / MASTER_UNIT','MASTER_STANDAR','MASTER_AUDITOR','MASTER_PIMPINAN','USERS','AMI_CYCLE','SETTINGS']
  });
}
function trashDriveFileSafe_(id){
  id=cleanText_(id);if(!id)return false;
  try{DriveApp.getFileById(id).setTrashed(true);return true;}catch(ignore){return false;}
}

/**
 * Reset SATU audit uji. Database dihapus di dalam lock, sedangkan operasi Drive
 * dilakukan setelah lock dilepas agar reset tidak memblokir pengguna lain.
 */
function resetAuditForRetest(token,auditId,confirmation){
  var prepared=withLock_(function(){
    const admin=requireRole_(token,['ADMIN_BPM']);
    const a=findOne_('AMI_AUDITI','AuditID',auditId);if(!a)throw new Error('Audit tidak ditemukan atau sudah direset.');
    const expected='RESET '+cleanText_(a.AuditiName);
    if(cleanText_(confirmation)!==expected)throw new Error('Konfirmasi tidak sesuai. Ketik persis: '+expected);

    const evidenceIds=getAllRows_('EVIDENCE').filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId);}).map(function(r){return cleanText_(r.DriveFileID);}).filter(Boolean);
    const reportIds=[];
    getAllRows_('REPORT_LOG').filter(function(r){return cleanText_(r.AuditID)===cleanText_(auditId);}).forEach(function(r){
      [r.GoogleDocID,r.DocxFileID,r.PdfFileID].forEach(function(id){id=cleanText_(id);if(id)reportIds.push(id);});
    });

    const before=maintenanceAuditCounts_(auditId);
    const deleteOrder=['REPORT_LOG','APPROVAL','AMI_IMPROVEMENT','FINDINGS','FORM3_CATATAN','FORM2_PROGRAM_KERJA','VISIT','DESK_EVAL','EVIDENCE','SELF_FOLLOW_UP','SELF_EVAL','AMI_TEAM','AMI_STANDARD_ASSIGN'];
    deleteOrder.forEach(function(name){deleteRowsByPredicate_(name,function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});});
    deleteRowsByPredicate_('AUDIT_LOG',function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});
    deleteRowsByPredicate_('AMI_AUDITI',function(r){return cleanText_(r.AuditID)===cleanText_(auditId);});

    if(typeof auditLog_==='function'){
      try{auditLog_(admin,'RESET_TEST_AUDIT','AMI_AUDITI','',auditId,{AuditiName:a.AuditiName,Status:a.Status,counts:before},{reset:true});}catch(ignoreLog){}
    }
    return{adminName:cleanText_(admin.Nama),auditiName:cleanText_(a.AuditiName),counts:before,evidenceIds:evidenceIds,reportIds:reportIds};
  });

  let trashedEvidence=0,trashedReports=0;
  prepared.evidenceIds.forEach(function(id){if(trashDriveFileSafe_(id))trashedEvidence++;});
  prepared.reportIds.forEach(function(id){if(trashDriveFileSafe_(id))trashedReports++;});
  try{PropertiesService.getScriptProperties().deleteProperty('AMI_V27_EVIDENCE_FOLDER_'+cleanText_(auditId));}catch(ignoreProp){}
  try{CacheService.getScriptCache().remove('AMI_V27_EVIDENCE_FOLDER_'+cleanText_(auditId));}catch(ignoreCache){}
  try{CacheService.getScriptCache().remove('AMI_PUBLIC_DASH_'+AMI_CONFIG.VERSION);}catch(ignoreDash){}

  return serializeValue_({ok:true,message:'Data audit uji '+prepared.auditiName+' berhasil direset. Master auditi tetap tersedia dan dapat ditetapkan ulang.',deleted:prepared.counts,trashedEvidence:trashedEvidence,trashedReports:trashedReports});
}

/* ============================================================
   V27 — RESET DATA UJI KESELURUHAN
   Menghapus seluruh DATA TRANSAKSI AMI, tetapi mempertahankan master,
   akun, siklus, settings, source register, dan struktur sheet.
   ============================================================ */
var V27_RESET_ALL_TRANSACTION_SHEETS_=Object.freeze([
  'REPORT_LOG','APPROVAL','AMI_IMPROVEMENT','FINDINGS','FORM3_CATATAN',
  'FORM2_PROGRAM_KERJA','VISIT','DESK_EVAL','EVIDENCE','SELF_FOLLOW_UP',
  'SELF_EVAL','AMI_TEAM','AMI_STANDARD_ASSIGN','AMI_AUDITI','AUDIT_LOG',
  'SYSTEM_ERROR_LOG'
]);
var V27_RESET_ALL_RETAINED_SHEETS_=Object.freeze([
  'SETTINGS','SOURCE_REGISTER','MASTER_STANDAR','MASTER_PRODI','MASTER_UNIT',
  'MASTER_AUDITOR','MASTER_PIMPINAN','USERS','SESSIONS','AMI_CYCLE'
]);
var V27_RESET_ALL_CONFIRMATION_='RESET SEMUA DATA UJI AMI 2026';

function maintenanceDataRowCount_(sheetName){
  try{var sh=sheet_(sheetName);return Math.max(0,sh.getLastRow()-1);}catch(ignore){return 0;}
}
function maintenanceClearDataRows_(sheetName){
  var sh=sheet_(sheetName),last=sh.getLastRow(),cols=Math.max(1,sh.getLastColumn());
  if(last<2)return 0;
  var n=last-1;
  // clearContent jauh lebih cepat daripada deleteRows satu per satu dan tetap
  // mempertahankan header, format kolom, data validation, serta schema sheet.
  sh.getRange(2,1,n,cols).clearContent();
  invalidateRowsCache_(sheetName);
  return n;
}
function maintenanceResetAllCounts_(){
  var out={},total=0;
  V27_RESET_ALL_TRANSACTION_SHEETS_.forEach(function(name){var n=maintenanceDataRowCount_(name);out[name]=n;total+=n;});
  return{bySheet:out,totalRows:total};
}
function getResetAllTestDataPreview(token){
  requireRole_(token,['ADMIN_BPM']);
  var counts=maintenanceResetAllCounts_();
  var evFiles=0,reportFiles=0;
  try{evFiles=getAllRows_('EVIDENCE').filter(function(r){return !!cleanText_(r.DriveFileID);}).length;}catch(ignoreEv){}
  try{getAllRows_('REPORT_LOG').forEach(function(r){[r.GoogleDocID,r.DocxFileID,r.PdfFileID].forEach(function(id){if(cleanText_(id))reportFiles++;});});}catch(ignoreRpt){}
  return serializeValue_({
    ok:true,
    confirmation:V27_RESET_ALL_CONFIRMATION_,
    counts:counts.bySheet,
    totalRows:counts.totalRows,
    driveFiles:{evidence:evFiles,reports:reportFiles,total:evFiles+reportFiles},
    retained:V27_RESET_ALL_RETAINED_SHEETS_.slice(),
    note:'Reset menghapus seluruh transaksi/uji AMI pada semua Auditi. Master, akun pengguna, siklus AMI, settings, dan struktur database tetap dipertahankan.'
  });
}
function resetAllTestData(token,confirmation){
  if(cleanText_(confirmation)!==V27_RESET_ALL_CONFIRMATION_){
    throw new Error('Konfirmasi tidak sesuai. Ketik persis: '+V27_RESET_ALL_CONFIRMATION_);
  }

  var prepared=withLock_(function(){
    const admin=requireRole_(token,['ADMIN_BPM']);
    if(cleanText_(confirmation)!==V27_RESET_ALL_CONFIRMATION_)throw new Error('Konfirmasi reset tidak sesuai.');

    // Simpan daftar file sebelum record transaksi dibersihkan.
    var evidenceIds=[],reportIds=[];
    try{getAllRows_('EVIDENCE').forEach(function(r){var id=cleanText_(r.DriveFileID);if(id)evidenceIds.push(id);});}catch(ignoreEv){}
    try{getAllRows_('REPORT_LOG').forEach(function(r){[r.GoogleDocID,r.DocxFileID,r.PdfFileID].forEach(function(id){id=cleanText_(id);if(id)reportIds.push(id);});});}catch(ignoreRpt){}

    var before=maintenanceResetAllCounts_(),deleted={};
    V27_RESET_ALL_TRANSACTION_SHEETS_.forEach(function(name){deleted[name]=maintenanceClearDataRows_(name);});

    // Setelah AUDIT_LOG dikosongkan, sisakan satu jejak administratif bahwa
    // reset produksi pernah dilakukan.
    if(typeof auditLog_==='function'){
      try{auditLog_(admin,'RESET_ALL_TEST_DATA','SYSTEM','',uuid_('RESET'),'',{deletedRows:before.totalRows,performedAt:now_()});}catch(ignoreLog){}
    }

    return{adminName:cleanText_(admin.Nama),before:before,deleted:deleted,evidenceIds:evidenceIds,reportIds:reportIds};
  });

  // Operasi Drive dilakukan setelah global lock dilepas.
  let trashedEvidence=0,trashedReports=0;
  prepared.evidenceIds.forEach(function(id){if(trashDriveFileSafe_(id))trashedEvidence++;});
  prepared.reportIds.forEach(function(id){if(trashDriveFileSafe_(id))trashedReports++;});

  // Bersihkan pointer folder per-audit yang sudah tidak mempunyai AuditID.
  try{
    var props=PropertiesService.getScriptProperties(),all=props.getProperties();
    Object.keys(all).forEach(function(k){if(k.indexOf('AMI_V27_EVIDENCE_FOLDER_')===0)try{props.deleteProperty(k);}catch(ignoreDel){}});
  }catch(ignoreProps){}

  // Dashboard berikutnya harus langsung menampilkan database bersih.
  try{CacheService.getScriptCache().remove('AMI_PUBLIC_DASH_'+AMI_CONFIG.VERSION);}catch(ignoreDash){}
  try{resetDbRuntimeCache_();}catch(ignoreDb){}

  return serializeValue_({
    ok:true,
    message:'Seluruh data uji/transaksi AMI berhasil direset. Master, akun, siklus AMI, settings, dan struktur database tetap dipertahankan.',
    deleted:prepared.deleted,
    totalDeleted:prepared.before.totalRows,
    trashedEvidence:trashedEvidence,
    trashedReports:trashedReports,
    retained:V27_RESET_ALL_RETAINED_SHEETS_.slice(),
    reloginRequired:false
  });
}

/** Ubah satu kolom menjadi teks dengan mempertahankan tampilan yang dilihat pengguna. */
function normalizeDisplayedTextColumn_(sheetName,columnName){
  var sh=sheet_(sheetName),h=headers_(sheetName),idx=h.indexOf(columnName),last=sh.getLastRow();
  if(idx<0||last<2)return 0;
  var range=sh.getRange(2,idx+1,last-1,1),display=range.getDisplayValues();
  range.setNumberFormat('@');
  range.setValues(display.map(function(r){return [String(r[0]==null?'':r[0])];}));
  invalidateRowsCache_(sheetName);
  return display.length;
}

/** ApprovedAt disimpan sebagai waktu lokal ISO tanpa offset agar tidak bergeser di browser/Word. */
function normalizeApprovalTimestampColumn_(){
  var sh=sheet_('APPROVAL'),h=headers_('APPROVAL'),idx=h.indexOf('ApprovedAt'),last=sh.getLastRow();
  if(idx<0||last<2)return 0;
  var range=sh.getRange(2,idx+1,last-1,1),raw=range.getValues();
  var values=raw.map(function(r){
    var v=r[0];
    if(v instanceof Date&&!isNaN(v.getTime()))return [Utilities.formatDate(v,AMI_CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss")];
    return [String(v==null?'':v).trim()];
  });
  range.setNumberFormat('@');range.setValues(values);invalidateRowsCache_('APPROVAL');
  return values.length;
}

/**
 * Migrasi histori workflow dari data lama bila sheet final sebelumnya belum tersedia.
 * Tidak menimpa histori SELF_FOLLOW_UP/AMI_IMPROVEMENT yang sudah ada.
 */
function migrateFinalWorkflowData_(){
  var assignments={},selfs={},findings={},followExisting={},impExisting={};
  getAllRows_('AMI_STANDARD_ASSIGN').forEach(function(a){if(bool_(a.Active))assignments[cleanText_(a.AuditID)+'|'+cleanText_(a.AssignID)]=a;});
  getAllRows_('SELF_EVAL').forEach(function(s){selfs[cleanText_(s.AuditID)+'|'+cleanText_(s.AssignID)]=s;});
  getAllRows_('FINDINGS').forEach(function(f){findings[cleanText_(f.AuditID)+'|'+cleanText_(f.AssignID)]=f;});
  getAllRows_('SELF_FOLLOW_UP').forEach(function(x){followExisting[cleanText_(x.AuditID)+'|'+cleanText_(x.AssignID)]=true;});
  getAllRows_('AMI_IMPROVEMENT').forEach(function(x){impExisting[cleanText_(x.AuditID)+'|'+cleanText_(x.AssignID)]=true;});
  var followRows=[],impRows=[],stamp=now_();
  Object.keys(assignments).forEach(function(key){
    var a=assignments[key],se=selfs[key]||{},f=findings[key]||{},selfCat=cleanText_(se.Capaian).toUpperCase(),finalCat=cleanText_(f.Kategori).toUpperCase();
    if(!followExisting[key]&&['MENYIMPANG','BELUM MENCAPAI'].indexOf(selfCat)>=0){
      followRows.push({
        FollowUpID:uuid_('SFU'),AuditID:a.AuditID,AssignID:a.AssignID,StandardID:a.StandardID,SelfEvalID:se.SelfEvalID||'',CapaianAwal:selfCat,
        TanggapanAuditi:f.TanggapanAuditi||'',RencanaPerbaikan:f.RencanaPerbaikan||'',JadwalPerbaikan:f.JadwalPerbaikan||'',PJPerbaikan:f.PJPerbaikan||'',
        RencanaPencegahan:f.RencanaPencegahan||'',JadwalPencegahan:f.JadwalPencegahan||'',PJPencegahan:f.PJPencegahan||'',
        Status:'WAJIB',SavedAt:stamp,SavedBy:'SYSTEM MIGRATION',UpdatedAt:stamp
      });
    }
    if(!impExisting[key]&&['MENCAPAI','MELAMPAUI'].indexOf(finalCat)>=0){
      impRows.push({
        ImprovementID:uuid_('IMP'),AuditID:a.AuditID,AssignID:a.AssignID,StandardID:a.StandardID,SelfEvalID:se.SelfEvalID||'',CapaianAwal:selfCat,KategoriFinal:finalCat,
        FaktorPendukung:'',RekomendasiPeningkatanIndikator:'',Status:'PERLU DILENGKAPI AUDITOR',SavedAt:stamp,SavedBy:'SYSTEM MIGRATION',UpdatedAt:stamp,UpdatedBy:'SYSTEM MIGRATION'
      });
    }
  });
  if(followRows.length)batchUpsert_('SELF_FOLLOW_UP',['AuditID','AssignID'],followRows,['JadwalPerbaikan','JadwalPencegahan']);
  if(impRows.length)batchUpsert_('AMI_IMPROVEMENT',['AuditID','AssignID'],impRows,[]);
  return{followUpInserted:followRows.length,improvementInserted:impRows.length};
}

/**
 * Upgrade skema non-destruktif untuk paket final.
 * Tidak membuat database baru, tidak menghapus data, dan tidak menjalankan setupDatabase().
 */
function upgradeSchemaFinalCore_(){
  resetDbRuntimeCache_();
  var ss=db_(),before={},after={};
  Object.keys(SHEET_DEFS).forEach(function(name){
    var old=ss.getSheetByName(name);before[name]=old?old.getLastColumn():0;
    var sh=ensureSheet_(ss,name,SHEET_DEFS[name]);after[name]=sh.getLastColumn();
  });
  try{ss.setSpreadsheetTimeZone(AMI_CONFIG.TIMEZONE);}catch(ignore){}

  // Pertahankan nilai yang terlihat (mis. 45%, >=80%, rasio, tanggal) sebagai teks literal.
  normalizeDisplayedTextColumn_('SELF_EVAL','NilaiCapaian');
  normalizeDisplayedTextColumn_('SELF_FOLLOW_UP','JadwalPerbaikan');
  normalizeDisplayedTextColumn_('SELF_FOLLOW_UP','JadwalPencegahan');
  normalizeDisplayedTextColumn_('FINDINGS','JadwalPerbaikan');
  normalizeDisplayedTextColumn_('FINDINGS','JadwalPencegahan');
  normalizeApprovalTimestampColumn_();

  // Metadata lama dan snapshot tetap dibuat kompatibel tanpa mengganti substansi standar.
  var standardMigration={updated:0},snapshotMigration={updated:0},workflowMigration={followUpInserted:0,improvementInserted:0};
  try{if(typeof migrateStandardVersionMetadata_==='function')standardMigration=migrateStandardVersionMetadata_()||standardMigration;}catch(ignoreStd){}
  try{if(typeof backfillAssignmentSnapshots_==='function')snapshotMigration=backfillAssignmentSnapshots_()||snapshotMigration;}catch(ignoreSnap){}
  workflowMigration=migrateFinalWorkflowData_();
  try{seedSettings_();}catch(ignoreSettings){}
  try{ensureDefaultAdmin_();}catch(ignoreAdmin){}

  var props=PropertiesService.getScriptProperties();
  props.setProperty('AMI_DB_ID',ss.getId());
  props.setProperty('AMI_SETUP_VERSION',AMI_CONFIG.VERSION);
  props.setProperty('AMI_SETUP_COMPLETE','TRUE');
  props.deleteProperty('AMI_SETUP_LAST_ERROR');

  resetDbRuntimeCache_();
  return serializeValue_({
    ok:true,database:ss.getName(),databaseId:ss.getId(),timezone:ss.getSpreadsheetTimeZone(),
    beforeColumns:before,afterColumns:after,standardMigration:standardMigration,snapshotMigration:snapshotMigration,workflowMigration:workflowMigration,
    message:'Skema final AMI berhasil diselaraskan tanpa menghapus data.'
  });
}
function maintenanceUpgradeSchemaFinal_(){return withLock_(upgradeSchemaFinalCore_);}
function upgradeSchemaFinal(token){requireRole_(token,['ADMIN_BPM']);return withLock_(upgradeSchemaFinalCore_);}

/** Jalankan maintenanceUpgradeSchemaFinal_() sekali dari dropdown editor setelah mengganti project lama dengan paket final.
 * Nama berakhiran _ sengaja dipakai agar fungsi tidak dapat dipanggil dari browser tanpa token. */
