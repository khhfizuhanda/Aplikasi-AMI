
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

