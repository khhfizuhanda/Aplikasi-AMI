/**
 * WorkflowBatchService.gs — FINAL OPTIMIZED
 * AMI 2026 — Batch Save + Positive Improvement Workflow.
 *
 * Tujuan:
 * 1) Satu klik Simpan per bagian, bukan satu server request per butir.
 * 2) Capaian negatif -> Tindak Lanjut Auditi.
 * 3) Capaian positif -> Rekomendasi Peningkatan.
 * 4) Hasil Auditor positif memakai Faktor Pendukung + Rekomendasi Peningkatan Indikator.
 *
 * Tidak membuat spreadsheet baru.
 * Hanya menambah sheet AMI_IMPROVEMENT pada database AMI yang sama.
 */

var WF_IMPROVEMENT_SHEET_ = 'AMI_IMPROVEMENT';

function wfClean_(v) {
  return cleanText_(v);
}

function wfUpper_(v) {
  return wfClean_(v).toUpperCase();
}

function wfNormCategory_(v) {
  var x = wfUpper_(v).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  if (x === 'MENYIMPANG') return 'MENYIMPANG';
  if (x === 'BELUM MENCAPAI') return 'BELUM MENCAPAI';
  if (x === 'MENCAPAI') return 'MENCAPAI';
  if (x === 'MELAMPAUI') return 'MELAMPAUI';

  return '';
}

function wfIsNegative_(v) {
  var x = wfNormCategory_(v);
  return x === 'MENYIMPANG' || x === 'BELUM MENCAPAI';
}

function wfIsPositive_(v) {
  var x = wfNormCategory_(v);
  return x === 'MENCAPAI' || x === 'MELAMPAUI';
}

function wfEnsureImprovement_(){return ensureSheetReady_(WF_IMPROVEMENT_SHEET_,SHEET_DEFS.AMI_IMPROVEMENT);}

/**
 * Upsert banyak baris dengan satu setValues().
 * Ini jauh lebih cepat dibanding memanggil save per butir dari browser.
 */
function wfBatchUpsert_(sheetName,keyFields,records,textColumns){return batchUpsert_(sheetName,keyFields,records,textColumns);}

function wfAudit_(auditId) {
  var audit = findOne_('AMI_AUDITI', 'AuditID', auditId);

  if (!audit) {
    throw new Error('Audit tidak ditemukan.');
  }

  return audit;
}

function wfTeamAccess_(u, auditId) {
  var team = findOne_('AMI_TEAM', 'AuditID', auditId);

  if (!team) return false;

  return [
    team.LeadAuditorID,
    team.Member1ID,
    team.Member2ID
  ].map(wfClean_).indexOf(wfClean_(u.RefID)) >= 0;
}

function wfAssertAccess_(u, auditId, roles) {
  var audit = wfAudit_(auditId);
  var role = wfUpper_(u.Role);

  if (roles && roles.length && roles.indexOf(role) < 0) {
    throw new Error('Role Anda tidak dapat mengubah bagian ini.');
  }

  if (role === 'ADMIN_BPM') {
    return audit;
  }

  if (role === 'AUDITI') {
    if (
      wfClean_(u.RefType) !== wfClean_(audit.AuditiType) ||
      wfClean_(u.RefID) !== wfClean_(audit.AuditiID)
    ) {
      throw new Error('Anda tidak memiliki akses ke audit ini.');
    }

    return audit;
  }

  if (role === 'AUDITOR') {
    if (!wfTeamAccess_(u, auditId)) {
      throw new Error('Anda bukan anggota tim auditor pada audit ini.');
    }

    return audit;
  }

  throw new Error('Anda tidak memiliki akses untuk mengubah audit ini.');
}

function wfActiveAssignments_(auditId) {
  return getAllRows_('AMI_STANDARD_ASSIGN').filter(function(a) {
    return wfClean_(a.AuditID) === wfClean_(auditId) &&
      bool_(a.Active);
  });
}

function wfAssignmentMap_(auditId) {
  var out = {};

  wfActiveAssignments_(auditId).forEach(function(a) {
    out[wfClean_(a.AssignID)] = a;
  });

  return out;
}

function wfExistingMap_(sheetName, auditId, idField) {
  var out = {};

  getAllRows_(sheetName).forEach(function(r) {
    if (wfClean_(r.AuditID) === wfClean_(auditId)) {
      out[wfClean_(r[idField])] = r;
    }
  });

  return out;
}


function wfImprovementMap_(auditId) {
  wfEnsureImprovement_();
  return wfExistingMap_(
    WF_IMPROVEMENT_SHEET_,
    auditId,
    'AssignID'
  );
}

function wfMakeSelfImprovementRecord_(old,u,auditId,a,selfId,category,data){
  data=data||{};
  old=old||{};
  var positive=wfIsPositive_(category);
  return {
    ImprovementID:old.ImprovementID||uuid_('IMP'),
    AuditID:auditId,
    AssignID:a.AssignID,
    StandardID:a.StandardID,
    SelfEvalID:selfId||old.SelfEvalID||'',
    CapaianAwal:category,
    // Selama masih isian Auditi, kategori final belum ditetapkan Auditor.
    KategoriFinal:'',
    FaktorPendukung:positive
      ? String(data.FaktorPendukung==null?'':data.FaktorPendukung).trim()
      : String(old.FaktorPendukung||''),
    RekomendasiPeningkatanIndikator:positive
      ? String(data.RekomendasiPeningkatanIndikator==null?'':data.RekomendasiPeningkatanIndikator).trim()
      : String(old.RekomendasiPeningkatanIndikator||''),
    Status:positive?'DRAFT AUDITI':'TIDAK DIPERLUKAN',
    SavedAt:old.SavedAt||now_(),
    SavedBy:old.SavedBy||u.Nama,
    UpdatedAt:now_(),
    UpdatedBy:u.Nama
  };
}

function wfSharedRowId_(prefix,index){
  return 'LEGACY_'+String(prefix||'ROW')+'_'+String(index+1);
}
function wfNormalizeSharedRows_(rows,prefix){
  return (Array.isArray(rows)?rows:[]).map(function(x,i){
    x=x||{};
    var out={};
    Object.keys(x).forEach(function(k){out[k]=x[k];});
    out.rowId=wfClean_(out.rowId)||wfSharedRowId_(prefix,i);
    return out;
  });
}
function wfMergeSharedRows_(oldRows,incomingRows,deletedIds,prefix,u){
  var old=wfNormalizeSharedRows_(oldRows,prefix),map={},order=[];
  old.forEach(function(x){
    var id=wfClean_(x.rowId);
    if(!id)return;
    map[id]=x;
    order.push(id);
  });
  var deleted={};
  (Array.isArray(deletedIds)?deletedIds:[]).forEach(function(id){deleted[wfClean_(id)]=true;});
  Object.keys(deleted).forEach(function(id){delete map[id];});
  order=order.filter(function(id){return !deleted[id];});
  (Array.isArray(incomingRows)?incomingRows:[]).forEach(function(x){
    x=x||{};
    var id=wfClean_(x.rowId)||uuid_(prefix||'ROW');
    if(deleted[id])return;
    var rec=map[id]||{rowId:id};
    Object.keys(x).forEach(function(k){
      if(k!=='_delete')rec[k]=x[k];
    });
    rec.rowId=id;
    rec.updatedAt=now_();
    rec.updatedBy=u&&u.Nama?u.Nama:'';
    map[id]=rec;
    if(order.indexOf(id)<0)order.push(id);
  });
  return order.filter(function(id){return !!map[id];}).map(function(id){return map[id];});
}

function wfNormalizeProgramForms_(raw, legacyForm){
  raw=Array.isArray(raw)?raw:[]; legacyForm=legacyForm||{}; var out=[];
  raw.forEach(function(x,i){
    x=x||{}; var pid=wfClean_(x.rowId)||('LEGACY_F2_'+String(i+1)),steps=[];
    if(Array.isArray(x.langkahKerja)){
      steps=x.langkahKerja.map(function(st,j){st=st||{};return {rowId:wfClean_(st.rowId)||('LEGACY_F2L_'+String(i+1)+'_'+String(j+1)),uraian:wfClean_(st.uraian),estimasi:wfClean_(st.estimasi),noPernyataan:wfClean_(st.noPernyataan),realisasi:wfClean_(st.realisasi),inisialAuditor:wfClean_(st.inisialAuditor),updatedAt:st.updatedAt||'',updatedBy:st.updatedBy||''};});
    }else if(wfClean_(x.uraian)||wfClean_(x.estimasi)||wfClean_(x.noPernyataan)||wfClean_(x.realisasi)||wfClean_(x.inisialAuditor)){
      steps=[{rowId:wfClean_(x.stepRowId)||('LEGACY_F2L_'+String(i+1)+'_1'),uraian:wfClean_(x.uraian),estimasi:wfClean_(x.estimasi),noPernyataan:wfClean_(x.noPernyataan),realisasi:wfClean_(x.realisasi),inisialAuditor:wfClean_(x.inisialAuditor),updatedAt:x.updatedAt||'',updatedBy:x.updatedBy||''}];
    }
    out.push({rowId:pid,nomorStandar:wfClean_(x.nomorStandar),namaStandar:wfClean_(x.namaStandar),tentatifAuditObjektif:wfClean_(x.tentatifAuditObjektif)||(i===0?wfClean_(legacyForm.TentatifAuditObjektif):''),tujuanAudit:wfClean_(x.tujuanAudit)||(i===0?wfClean_(legacyForm.TujuanAudit):''),langkahKerja:steps,updatedAt:x.updatedAt||'',updatedBy:x.updatedBy||''});
  });
  if(!out.length&&(wfClean_(legacyForm.TentatifAuditObjektif)||wfClean_(legacyForm.TujuanAudit)))out=[{rowId:'LEGACY_F2_1',nomorStandar:'',namaStandar:'',tentatifAuditObjektif:wfClean_(legacyForm.TentatifAuditObjektif),tujuanAudit:wfClean_(legacyForm.TujuanAudit),langkahKerja:[]}];
  return out;
}
function wfMergeProgramForms_(oldRows,incomingRows,deletedIds,u,legacyForm){
  var old=wfNormalizeProgramForms_(oldRows,legacyForm),map={},order=[],deleted={};
  old.forEach(function(x){map[x.rowId]=x;order.push(x.rowId);});
  (Array.isArray(deletedIds)?deletedIds:[]).forEach(function(id){id=wfClean_(id);if(id)deleted[id]=true;});
  Object.keys(deleted).forEach(function(id){delete map[id];}); order=order.filter(function(id){return !deleted[id];});
  (Array.isArray(incomingRows)?incomingRows:[]).forEach(function(x){x=x||{};var id=wfClean_(x.rowId)||uuid_('F2'),rec=map[id]||{rowId:id,nomorStandar:'',namaStandar:'',tentatifAuditObjektif:'',tujuanAudit:'',langkahKerja:[]};if(deleted[id])return;
    if(Object.prototype.hasOwnProperty.call(x,'nomorStandar'))rec.nomorStandar=wfClean_(x.nomorStandar);
    if(Object.prototype.hasOwnProperty.call(x,'namaStandar'))rec.namaStandar=wfClean_(x.namaStandar);
    if(Object.prototype.hasOwnProperty.call(x,'tentatifAuditObjektif'))rec.tentatifAuditObjektif=wfClean_(x.tentatifAuditObjektif);
    if(Object.prototype.hasOwnProperty.call(x,'tujuanAudit'))rec.tujuanAudit=wfClean_(x.tujuanAudit);
    rec.langkahKerja=wfMergeSharedRows_(rec.langkahKerja||[],Array.isArray(x.LangkahKerja)?x.LangkahKerja:(Array.isArray(x.langkahKerja)?x.langkahKerja:[]),Array.isArray(x.DeletedLangkahIDs)?x.DeletedLangkahIDs:[],'F2L',u);
    rec.updatedAt=now_();rec.updatedBy=u&&u.Nama?u.Nama:'';map[id]=rec;if(order.indexOf(id)<0)order.push(id);
  });
  return order.filter(function(id){return !!map[id];}).map(function(id){return map[id];});
}
function wfNormalizeAuditNotes_(raw){
  raw=Array.isArray(raw)?raw:[];return raw.map(function(x,i){x=x||{};var refs=[];if(Array.isArray(x.dokumenReferensi)){refs=x.dokumenReferensi.map(function(r,j){r=r||{};return {rowId:wfClean_(r.rowId)||('LEGACY_F3R_'+String(i+1)+'_'+String(j+1)),dokumenRef:wfClean_(r.dokumenRef||r.referensi),updatedAt:r.updatedAt||'',updatedBy:r.updatedBy||''};});}else if(wfClean_(x.dokumenRef)){refs=[{rowId:'LEGACY_F3R_'+String(i+1)+'_1',dokumenRef:wfClean_(x.dokumenRef)}];}return {rowId:wfClean_(x.rowId)||('LEGACY_F3_'+String(i+1)),catatan:wfClean_(x.catatan),tanggal:wfClean_(x.tanggal),dokumenReferensi:refs,updatedAt:x.updatedAt||'',updatedBy:x.updatedBy||''};});
}
function wfMergeAuditNotes_(oldRows,incomingRows,deletedIds,u){
  var old=wfNormalizeAuditNotes_(oldRows),map={},order=[],deleted={};old.forEach(function(x){map[x.rowId]=x;order.push(x.rowId);});
  (Array.isArray(deletedIds)?deletedIds:[]).forEach(function(id){id=wfClean_(id);if(id)deleted[id]=true;});Object.keys(deleted).forEach(function(id){delete map[id];});order=order.filter(function(id){return !deleted[id];});
  (Array.isArray(incomingRows)?incomingRows:[]).forEach(function(x){x=x||{};var id=wfClean_(x.rowId)||uuid_('F3'),rec=map[id]||{rowId:id,catatan:'',tanggal:'',dokumenReferensi:[]};if(deleted[id])return;
    if(Object.prototype.hasOwnProperty.call(x,'catatan'))rec.catatan=wfClean_(x.catatan);if(Object.prototype.hasOwnProperty.call(x,'tanggal'))rec.tanggal=wfClean_(x.tanggal);
    rec.dokumenReferensi=wfMergeSharedRows_(rec.dokumenReferensi||[],Array.isArray(x.DokumenReferensi)?x.DokumenReferensi:(Array.isArray(x.dokumenReferensi)?x.dokumenReferensi:[]),Array.isArray(x.DeletedReferensiIDs)?x.DeletedReferensiIDs:[],'F3R',u);
    rec.updatedAt=now_();rec.updatedBy=u&&u.Nama?u.Nama:'';map[id]=rec;if(order.indexOf(id)<0)order.push(id);
  });return order.filter(function(id){return !!map[id];}).map(function(id){return map[id];});
}

function wfEnsureFollowUp_(){return ensureSheetReady_('SELF_FOLLOW_UP',SHEET_DEFS.SELF_FOLLOW_UP);}
function wfSelfFollowUpMap_(auditId){wfEnsureFollowUp_();return wfExistingMap_('SELF_FOLLOW_UP',auditId,'AssignID');}
function wfUpsertSelfFollowUp_(u,auditId,assignId,data,options){
  options=options||{};wfEnsureFollowUp_();
  const a=wfAssignmentMap_(auditId)[wfClean_(assignId)];if(!a)throw new Error('Butir standar tidak ditemukan pada audit ini.');
  const self=wfExistingMap_('SELF_EVAL',auditId,'AssignID')[wfClean_(assignId)]||{};
  const old=wfSelfFollowUpMap_(auditId)[wfClean_(assignId)]||null;
  const category=wfNormCategory_(options.CapaianAwal||(data||{}).CapaianAwal||(data||{}).Capaian||self.Capaian);
  const rec=wfMakeFollowRecord_(old,u||{Nama:'SYSTEM'},auditId,a,self.SelfEvalID||'',category,data||{});
  wfBatchUpsert_('SELF_FOLLOW_UP',['AuditID','AssignID'],[rec],['JadwalPerbaikan','JadwalPencegahan']);
  return rec;
}

function wfMakeFollowRecord_(old, u, auditId, a, selfId, category, data) {
  data = data || {};

  return {
    FollowUpID: old ? old.FollowUpID : uuid_('SFU'),
    AuditID: auditId,
    AssignID: a.AssignID,
    StandardID: a.StandardID,
    SelfEvalID: selfId,
    CapaianAwal: category,

    TanggapanAuditi:
      String(data.TanggapanAuditi == null ? '' : data.TanggapanAuditi).trim(),

    RencanaPerbaikan:
      String(data.RencanaPerbaikan == null ? '' : data.RencanaPerbaikan).trim(),

    JadwalPerbaikan:
      String(data.JadwalPerbaikan == null ? '' : data.JadwalPerbaikan).trim(),

    PJPerbaikan:
      String(data.PJPerbaikan == null ? '' : data.PJPerbaikan).trim(),

    RencanaPencegahan:
      String(data.RencanaPencegahan == null ? '' : data.RencanaPencegahan).trim(),

    JadwalPencegahan:
      String(data.JadwalPencegahan == null ? '' : data.JadwalPencegahan).trim(),

    PJPencegahan:
      String(data.PJPencegahan == null ? '' : data.PJPencegahan).trim(),

    Status: wfIsNegative_(category) ? 'WAJIB' : 'TIDAK DIPERLUKAN',
    SavedAt: old && old.SavedAt ? old.SavedAt : now_(),
    SavedBy: old && old.SavedBy ? old.SavedBy : u.Nama,
    UpdatedAt: now_()
  };
}



/* ==================== EVALUASI DIRI — FINAL ==================== */

/**
 * Auditi mengisi:
 * - Capaian
 * - Nilai/Capaian Aktual
 * - Evaluasi Diri
 * - Jika negatif: Rencana Tindak Lanjut
 *
 * Jika positif: Auditi mengisi Faktor Pendukung + Rekomendasi Peningkatan sebagai draft awal.
 * Auditor dapat merevisi dan menetapkan versi final pada Hasil Audit.
 */
function saveAllSelfEvaluation(token, auditId, items) {
  return withLock_(function() {
    var u = requireRole_(token, ['AUDITI']);
    var audit = wfAssertAccess_(u, auditId, ['AUDITI']);
    var status = wfClean_(audit.Status);

    if ([
      'PENUGASAN DITERBITKAN',
      'EVALUASI DIRI BERJALAN',
      'PERLU REVISI AUDITI'
    ].indexOf(status) < 0) {
      throw new Error('Evaluasi Diri terkunci pada status ' + status + '.');
    }

    if (!Array.isArray(items)) {
      throw new Error('Data Evaluasi Diri tidak valid.');
    }

    ensureSheetReady_('SELF_EVAL', SHEET_DEFS.SELF_EVAL);
    wfEnsureFollowUp_();
    wfEnsureImprovement_();

    var assignments = wfAssignmentMap_(auditId);
    var selfs = wfExistingMap_('SELF_EVAL', auditId, 'AssignID');
    var follows = wfExistingMap_('SELF_FOLLOW_UP', auditId, 'AssignID');
    var improvements = wfImprovementMap_(auditId);

    var selfRecords = [];
    var followRecords = [];
    var improvementRecords = [];
    var stamp = now_();

    items.forEach(function(data) {
      data = data || {};
      var id = wfClean_(data.AssignID);
      var a = assignments[id];

      if (!a) throw new Error('Butir audit tidak ditemukan: ' + id);

      var category = wfNormCategory_(data.Capaian);
      if (category && (AMI_CONFIG.CAPAIAN || []).indexOf(category) < 0) {
        throw new Error('Capaian tidak valid pada ' + (a.ItemCode || a.NamaStandar || id));
      }

      var oldSelf = selfs[id] || {};
      var selfId = oldSelf.SelfEvalID || uuid_('SELF');

      var selfRec = {
        SelfEvalID:selfId,
        AuditID:auditId,
        AssignID:id,
        StandardID:a.StandardID,
        Capaian:category,
        NilaiCapaian:String(data.NilaiCapaian == null ? '' : data.NilaiCapaian),
        EvaluasiDiri:String(data.EvaluasiDiri == null ? '' : data.EvaluasiDiri).trim(),
        Akibat:wfIsNegative_(category) ? String(data.Akibat == null ? '' : data.Akibat).trim() : '',
        AkarPenyebab:wfIsNegative_(category) ? String(data.AkarPenyebab == null ? '' : data.AkarPenyebab).trim() : '',
        Status:'DRAFT',
        BuktiCount:oldSelf.BuktiCount !== undefined && oldSelf.BuktiCount !== '' ? oldSelf.BuktiCount : 0,
        SavedAt:stamp,
        SubmittedAt:oldSelf.SubmittedAt || '',
        SubmittedBy:oldSelf.SubmittedBy || ''
      };
      selfRecords.push(selfRec);
      selfs[id] = selfRec;

      var oldFollow = follows[id] || null;
      if (wfIsNegative_(category)) {
        followRecords.push(wfMakeFollowRecord_(oldFollow,u,auditId,a,selfId,category,data));
      } else if (oldFollow) {
        var hist = {};
        Object.keys(oldFollow).forEach(function(k){if(k!=='_row')hist[k]=oldFollow[k];});
        hist.CapaianAwal = category;
        hist.Status = 'TIDAK DIPERLUKAN';
        hist.UpdatedAt = stamp;
        followRecords.push(hist);
      }

      var oldImp = improvements[id] || null;
      if (wfIsPositive_(category)) {
        improvementRecords.push(
          wfMakeSelfImprovementRecord_(oldImp,u,auditId,a,selfId,category,data)
        );
      } else if (oldImp) {
        var oldImpHist = {};
        Object.keys(oldImp).forEach(function(k){if(k!=='_row')oldImpHist[k]=oldImp[k];});
        oldImpHist.CapaianAwal = category;
        oldImpHist.KategoriFinal = '';
        oldImpHist.Status = 'TIDAK DIPERLUKAN';
        oldImpHist.UpdatedAt = stamp;
        oldImpHist.UpdatedBy = u.Nama;
        improvementRecords.push(oldImpHist);
      }
    });

    wfBatchUpsert_('SELF_EVAL',['AuditID','AssignID'],selfRecords,['NilaiCapaian']);
    if (followRecords.length) {
      wfBatchUpsert_('SELF_FOLLOW_UP',['AuditID','AssignID'],followRecords,['JadwalPerbaikan','JadwalPencegahan']);
    }
    if (improvementRecords.length) {
      wfBatchUpsert_(WF_IMPROVEMENT_SHEET_,['AuditID','AssignID'],improvementRecords,[]);
    }

    if (status === 'PENUGASAN DITERBITKAN') {
      updateRow_('AMI_AUDITI',audit._row,{Status:'EVALUASI DIRI BERJALAN'});
    }

    if (typeof auditLog_ === 'function') {
      auditLog_(u,'SAVE_ALL_SELF_EVALUATION','SELF_EVAL',auditId,'','',{
        items:items.length,
        negative:items.filter(function(x){return wfIsNegative_(x.Capaian);}).length,
        positive:items.filter(function(x){return wfIsPositive_(x.Capaian);}).length
      });
    }

    return {
      ok:true,
      saved:items.length,
      message:'Seluruh Evaluasi Diri, tindak lanjut, dan rekomendasi peningkatan tersimpan.'
    };
  });
}



/**
 * Simpan semua LINK bukti dari seluruh butir dalam satu request server.
 * File fisik tetap diunggah oleh satu tombol "Simpan Semua" pada frontend,
 * tetapi per-file agar aman terhadap batas payload Apps Script.
 */
function saveEvidenceLinksBatch(token, auditId, links) {
  return withLock_(function() {
    var u = requireRole_(token, ['AUDITI']);
    var audit = wfAssertAccess_(u, auditId, ['AUDITI']);
    var status = wfClean_(audit.Status);

    if (['PENUGASAN DITERBITKAN','EVALUASI DIRI BERJALAN','PERLU REVISI AUDITI'].indexOf(status) < 0) {
      throw new Error('Bukti Evaluasi Diri terkunci pada status ' + status + '.');
    }

    if (!Array.isArray(links) || !links.length) {
      return {ok:true,saved:0,message:'Tidak ada link bukti baru.'};
    }

    ensureSheetReady_('EVIDENCE',SHEET_DEFS.EVIDENCE);
    var assignments = wfAssignmentMap_(auditId);
    var selfs = wfExistingMap_('SELF_EVAL', auditId, 'AssignID');
    var evidenceRows = getAllRows_('EVIDENCE').filter(function(e){
      return wfClean_(e.AuditID) === wfClean_(auditId);
    });
    var existing = {};
    evidenceRows.forEach(function(e){
      var url=wfClean_(e.URL);
      if(url) existing[wfClean_(e.StandardID)+'|'+url]=e;
    });

    var records=[];
    var touchedSelf={};
    var seenInRequest={};

    links.forEach(function(x,index){
      x=x||{};
      var assignId=wfClean_(x.AssignID);
      var a=assignments[assignId];
      if(!a) throw new Error('Butir bukti tidak ditemukan: '+assignId);

      var url=String(x.URL||'').trim();
      if(!url) return;
      if(!/^https?:\/\//i.test(url)) {
        throw new Error((a.ItemCode||a.NamaStandar)+': URL bukti harus diawali http:// atau https://');
      }

      var se=selfs[assignId];
      if(!se) throw new Error((a.ItemCode||a.NamaStandar)+': simpan Evaluasi Diri sebelum bukti.');

      var mapKey=wfClean_(a.StandardID)+'|'+url;
      if(seenInRequest[mapKey]) return; // hindari duplikat dalam sekali Simpan Semua
      seenInRequest[mapKey]=true;
      var old=existing[mapKey]||null;
      var clientKey='LINK|'+wfClean_(a.StandardID)+'|'+url;
      records.push({
        EvidenceID:old&&old.EvidenceID?old.EvidenceID:uuid_('EVD'),
        SelfEvalID:se.SelfEvalID,
        AuditID:auditId,
        StandardID:a.StandardID,
        NamaBukti:String(x.NamaBukti||('Bukti Link '+(index+1)+' - '+(a.ItemCode||a.NamaStandar))).trim(),
        JenisBukti:'LINK',
        URL:url,
        DriveFileID:'',
        Keterangan:String(x.Keterangan||'').trim(),
        UploadedAt:old&&old.UploadedAt?old.UploadedAt:now_(),
        UploadedBy:old&&old.UploadedBy?old.UploadedBy:u.Nama,
        ClientKey:clientKey,
        FileSize:''
      });
      touchedSelf[wfClean_(se.SelfEvalID)]=true;
    });

    if(records.length){
      wfBatchUpsert_('EVIDENCE',['EvidenceID'],records,[]);

      // Hitung ulang BuktiCount sekali, lalu tulis semua SELF_EVAL terkait secara batch.
      var counts={};
      getAllRows_('EVIDENCE').forEach(function(e){
        if(wfClean_(e.AuditID)!==wfClean_(auditId)) return;
        var sid=wfClean_(e.SelfEvalID);
        if(sid) counts[sid]=(counts[sid]||0)+1;
      });
      var selfRecords=[];
      getAllRows_('SELF_EVAL').forEach(function(se){
        if(wfClean_(se.AuditID)!==wfClean_(auditId)) return;
        var sid=wfClean_(se.SelfEvalID);
        if(!touchedSelf[sid]) return;
        var rec={};
        Object.keys(se).forEach(function(k){if(k!=='_row')rec[k]=se[k];});
        rec.BuktiCount=counts[sid]||0;
        selfRecords.push(rec);
      });
      if(selfRecords.length) wfBatchUpsert_('SELF_EVAL',['AuditID','AssignID'],selfRecords,['NilaiCapaian']);
    }

    return {ok:true,saved:records.length,message:records.length+' link bukti tersimpan.'};
  });
}

/* ==================== DESK EVALUATION ==================== */

function saveAllDeskEvaluation(token, auditId, items) {
  return withLock_(function() {
    var u = requireRole_(token, ['AUDITOR']);
    var audit = wfAssertAccess_(u, auditId, ['AUDITOR']);
    var status = wfClean_(audit.Status);

    if ([
      'EVALUASI DIRI DIKIRIM',
      'DESK EVALUATION',
      'SIAP VISITASI',
      'VISITASI BERJALAN',
      'HASIL AUDIT DIISI',
      'PERLU REVISI AUDITOR'
    ].indexOf(status) < 0) {
      throw new Error('Desk Evaluation terkunci pada status ' + status + '.');
    }

    var assignments = wfAssignmentMap_(auditId);
    var olds = wfExistingMap_('DESK_EVAL', auditId, 'AssignID');
    var selfs = wfExistingMap_('SELF_EVAL', auditId, 'AssignID');
    var follows = wfSelfFollowUpMap_(auditId);
    var findings = wfExistingMap_('FINDINGS', auditId, 'AssignID');
    var improvements = wfImprovementMap_(auditId);
    var records = [];
    var seededFindings = [];
    var seededImprovements = [];

    (items || []).forEach(function(data) {
      data = data || {};
      var id = wfClean_(data.AssignID);
      var a = assignments[id];

      if (!a) throw new Error('Butir Desk tidak ditemukan: ' + id);

      var sd = wfUpper_(data.StatusDesk);
      if (sd && (AMI_CONFIG.DESK_STATUSES || []).indexOf(sd) < 0) {
        throw new Error('Status Desk tidak valid pada ' + (a.ItemCode || a.NamaStandar || id));
      }

      var old = olds[id];
      records.push({
        DeskID:old ? old.DeskID : uuid_('DESK'),
        AuditID:auditId,
        AssignID:id,
        StandardID:a.StandardID,
        StatusDesk:sd,
        CatatanDesk:String(data.CatatanDesk == null ? '' : data.CatatanDesk).trim(),
        ButuhVisitasi:!!data.ButuhVisitasi,
        AuditorID:u.RefID,
        UpdatedAt:now_()
      });

      // Bila auditor menyatakan SESUAI, Hasil Audit langsung mewarisi capaian Auditi.
      // Seed hanya dilakukan bila kategori final belum pernah ditetapkan, agar revisi
      // manual auditor pada Hasil Audit tidak tertimpa oleh penyimpanan Desk berikutnya.
      if (sd === 'SESUAI') {
        var se = selfs[id] || {};
        var selfCategory = wfNormCategory_(se.Capaian);
        var priorFinding = findings[id] || {};

        if (selfCategory && !wfNormCategory_(priorFinding.Kategori)) {
          var fu = follows[id] || {};
          var negative = wfIsNegative_(selfCategory);
          var seeded = {
            FindingID:priorFinding.FindingID || uuid_('FND'),
            AuditID:auditId,
            AssignID:id,
            StandardID:a.StandardID,
            Kategori:selfCategory,
            Deskripsi:priorFinding.Deskripsi || String(se.EvaluasiDiri || '').trim(),
            Kriteria:priorFinding.Kriteria || String(a.PernyataanStandarSnapshot || '').trim(),
            Akibat:priorFinding.Akibat || (negative ? String(se.Akibat || '').trim() : ''),
            AkarPenyebab:priorFinding.AkarPenyebab || (negative ? String(se.AkarPenyebab || '').trim() : ''),
            Rekomendasi:priorFinding.Rekomendasi || '',
            TanggapanAuditi:negative ? (priorFinding.TanggapanAuditi || fu.TanggapanAuditi || '') : '',
            RencanaPerbaikan:negative ? (priorFinding.RencanaPerbaikan || fu.RencanaPerbaikan || '') : '',
            JadwalPerbaikan:negative ? (priorFinding.JadwalPerbaikan || fu.JadwalPerbaikan || '') : '',
            PJPerbaikan:negative ? (priorFinding.PJPerbaikan || fu.PJPerbaikan || '') : '',
            RencanaPencegahan:negative ? (priorFinding.RencanaPencegahan || fu.RencanaPencegahan || '') : '',
            JadwalPencegahan:negative ? (priorFinding.JadwalPencegahan || fu.JadwalPencegahan || '') : '',
            PJPencegahan:negative ? (priorFinding.PJPencegahan || fu.PJPencegahan || '') : '',
            CreatedAt:priorFinding.CreatedAt || now_(),
            CreatedBy:priorFinding.CreatedBy || u.Nama,
            UpdatedAt:now_(),
            UpdatedBy:u.Nama
          };
          seededFindings.push(seeded);
          findings[id]=seeded;

          if (wfIsPositive_(selfCategory)) {
            var oldImp = improvements[id] || {};
            var imp = {
              ImprovementID:oldImp.ImprovementID || uuid_('IMP'),
              AuditID:auditId,
              AssignID:id,
              StandardID:a.StandardID,
              SelfEvalID:oldImp.SelfEvalID || se.SelfEvalID || '',
              CapaianAwal:oldImp.CapaianAwal || selfCategory,
              KategoriFinal:selfCategory,
              FaktorPendukung:oldImp.FaktorPendukung || '',
              RekomendasiPeningkatanIndikator:oldImp.RekomendasiPeningkatanIndikator || '',
              Status:oldImp.Status === 'DRAFT AUDITI' ? 'DRAFT AUDITI - SESUAI DESK' : (oldImp.Status || 'DRAFT AUDITI - SESUAI DESK'),
              SavedAt:oldImp.SavedAt || now_(),
              SavedBy:oldImp.SavedBy || u.Nama,
              UpdatedAt:now_(),
              UpdatedBy:u.Nama
            };
            seededImprovements.push(imp);
            improvements[id]=imp;
          }
        }
      }
    });

    wfBatchUpsert_('DESK_EVAL',['AuditID','AssignID'],records,[]);
    if (seededFindings.length) {
      wfBatchUpsert_('FINDINGS',['AuditID','AssignID'],seededFindings,['JadwalPerbaikan','JadwalPencegahan']);
    }
    if (seededImprovements.length) {
      wfBatchUpsert_(WF_IMPROVEMENT_SHEET_,['AuditID','AssignID'],seededImprovements,[]);
    }

    if (status === 'EVALUASI DIRI DIKIRIM') {
      updateRow_('AMI_AUDITI',audit._row,{Status:'DESK EVALUATION'});
    }

    if (typeof auditLog_ === 'function') {
      auditLog_(u,'SAVE_ALL_DESK','DESK_EVAL',auditId,'','',{
        items:records.length,
        autoAssessed:seededFindings.length
      });
    }

    return {
      ok:true,
      saved:records.length,
      autoAssessed:seededFindings.length,
      message:'Seluruh Desk Evaluation tersimpan.' + (seededFindings.length ? ' '+seededFindings.length+' butir SESUAI otomatis diberi hasil awal mengikuti Evaluasi Diri.' : '')
    };
  });
}

/* ==================== VISITASI + FORM 2 + FORM 3 ==================== */


function wfVisitTimeText_(value) {
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

  var hh = Math.max(0, Math.min(23, Number(m[1])));
  var mm = Math.max(0, Math.min(59, Number(m[2])));
  return ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
}

function wfWriteVisitTimeText_(rowNumber, fieldName, value) {
  if (!rowNumber) return;
  var h = headers_('VISIT');
  var idx = h.indexOf(fieldName);
  if (idx < 0) return;

  var cell = sheet_('VISIT').getRange(Number(rowNumber), idx + 1);
  cell.setNumberFormat('@');
  var text = wfVisitTimeText_(value);

  if (!text) {
    cell.clearContent();
    return;
  }

  // RichTextValue mencegah Google Sheets mengubah "08:30" menjadi
  // serial waktu/Date 30-12-1899.
  cell.setRichTextValue(
    SpreadsheetApp.newRichTextValue().setText(text).build()
  );
}

function saveAllVisitForms(token, auditId, data) {
  return withLock_(function() {
    var u = requireRole_(token, ['AUDITOR']);
    var audit = wfAssertAccess_(u, auditId, ['AUDITOR']);
    var status = wfClean_(audit.Status);
    data = data || {};

    var editableStatuses = [
      'EVALUASI DIRI DIKIRIM',
      'DESK EVALUATION',
      'SIAP VISITASI',
      'VISITASI BERJALAN',
      'HASIL AUDIT DIISI',
      'PERLU REVISI AUDITOR'
    ];

    if (editableStatuses.indexOf(status) < 0) {
      throw new Error('Form Auditor terkunci pada status ' + status + '.');
    }

    if (data.visit) {
      var v = data.visit || {};
      var oldV = findOne_('VISIT','AuditID',auditId) || {};
      function visitField_(name) {
        if (Object.prototype.hasOwnProperty.call(v,name)) {
          return String(v[name] == null ? '' : v[name]).trim();
        }
        return String(oldV[name] == null ? '' : oldV[name]).trim();
      }
      var recV = {
        VisitID:oldV.VisitID || uuid_('VISIT'),
        AuditID:auditId,
        Tanggal:visitField_('Tanggal'),
        JamMulai:wfVisitTimeText_(
          Object.prototype.hasOwnProperty.call(v,'JamMulai') ? v.JamMulai : oldV.JamMulai
        ),
        JamSelesai:wfVisitTimeText_(
          Object.prototype.hasOwnProperty.call(v,'JamSelesai') ? v.JamSelesai : oldV.JamSelesai
        ),
        Lokasi:visitField_('Lokasi'),
        WakilAuditi:visitField_('WakilAuditi'),
        CatatanUmum:visitField_('CatatanUmum'),
        Status:oldV.Status || 'DRAFT',
        UpdatedAt:now_()
      };

      var visitRow = 0;
      if (oldV._row) {
        updateRow_('VISIT',oldV._row,recV);
        visitRow = oldV._row;
      } else {
        visitRow = appendObject_('VISIT',recV);
      }

      if (!visitRow) {
        var savedVisit = findOne_('VISIT','AuditID',auditId) || {};
        visitRow = savedVisit._row || 0;
      }

      // Simpan jam sebagai teks HH:mm agar tidak diubah otomatis
      // Google Sheets menjadi Date/serial waktu.
      wfWriteVisitTimeText_(visitRow,'JamMulai',recV.JamMulai);
      wfWriteVisitTimeText_(visitRow,'JamSelesai',recV.JamSelesai);

      if (status === 'SIAP VISITASI') {
        updateRow_('AMI_AUDITI',audit._row,{Status:'VISITASI BERJALAN'});
        status = 'VISITASI BERJALAN';
      }
    }

    if (data.form2) {
      var f2=data.form2||{},old2=findOne_('FORM2_PROGRAM_KERJA','AuditID',auditId),oldPrograms=old2?parseJson_(old2.LangkahJSON,[]):[];
      var mergedPrograms=wfMergeProgramForms_(oldPrograms,Array.isArray(f2.Program)?f2.Program:(Array.isArray(f2.Langkah)?f2.Langkah:[]),Array.isArray(f2.DeletedRowIDs)?f2.DeletedRowIDs:[],u,old2||{});
      function uniqJoin_(arr){var seen={},out=[];(arr||[]).forEach(function(x){var t=wfClean_(x);if(t&&!seen[t]){seen[t]=true;out.push(t);}});return out.join('\n');}
      var rec2={Form2ID:old2?old2.Form2ID:uuid_('F2'),AuditID:auditId,TentatifAuditObjektif:uniqJoin_(mergedPrograms.map(function(x){return x.tentatifAuditObjektif;})),TujuanAudit:uniqJoin_(mergedPrograms.map(function(x){return x.tujuanAudit;})),LangkahJSON:JSON.stringify(mergedPrograms),UpdatedAt:now_(),UpdatedBy:u.Nama};
      if(old2)updateRow_('FORM2_PROGRAM_KERJA',old2._row,rec2);else appendObject_('FORM2_PROGRAM_KERJA',rec2);
    }

    if (data.form3) {
      var f3=data.form3||{},old3=findOne_('FORM3_CATATAN','AuditID',auditId),oldNotes=old3?parseJson_(old3.CatatanJSON,[]):[];
      var mergedNotes=wfMergeAuditNotes_(oldNotes,Array.isArray(f3.Catatan)?f3.Catatan:[],Array.isArray(f3.DeletedRowIDs)?f3.DeletedRowIDs:[],u);
      var rec3={Form3ID:old3?old3.Form3ID:uuid_('F3'),AuditID:auditId,CatatanJSON:JSON.stringify(mergedNotes),UpdatedAt:now_(),UpdatedBy:u.Nama};
      if(old3)updateRow_('FORM3_CATATAN',old3._row,rec3);else appendObject_('FORM3_CATATAN',rec3);
    }

    if (typeof auditLog_ === 'function') {
      auditLog_(u,'SAVE_ALL_VISIT_FORMS','VISIT/FORM2/FORM3',auditId,'','',{
        visit:!!data.visit,
        form2:!!data.form2,
        form3:!!data.form3
      });
    }

    return {
      ok:true,
      message:'Seluruh data Visitasi, Program Kerja, dan Catatan Audit tersimpan pada data bersama tim auditor.'
    };
  });
}

/* ==================== HASIL AUDIT ==================== */

function saveAllFindings(token, auditId, items) {
  return withLock_(function() {
    var u = requireRole_(token, ['AUDITOR']);
    var audit =
      wfAssertAccess_(
        u,
        auditId,
        ['AUDITOR']
      );

    var status =
      wfClean_(audit.Status);

    if (
      [
        'SIAP VISITASI',
        'VISITASI BERJALAN',
        'HASIL AUDIT DIISI',
        'PERLU REVISI AUDITOR'
      ].indexOf(status) < 0
    ) {
      throw new Error(
        'Hasil Audit terkunci pada status ' +
        status +
        '.'
      );
    }

    wfEnsureImprovement_();

    var assignments =
      wfAssignmentMap_(auditId);

    var olds =
      wfExistingMap_(
        'FINDINGS',
        auditId,
        'AssignID'
      );

    var follows =
      wfExistingMap_(
        'SELF_FOLLOW_UP',
        auditId,
        'AssignID'
      );

    var selfs =
      wfExistingMap_(
        'SELF_EVAL',
        auditId,
        'AssignID'
      );

    var improvements =
      wfImprovementMap_(auditId);

    var findingRecords = [];
    var improvementRecords = [];

    (items || []).forEach(function(data) {
      data = data || {};

      var id =
        wfClean_(data.AssignID);

      var a =
        assignments[id];

      if (!a) {
        throw new Error(
          'Butir Hasil Audit tidak ditemukan: ' +
          id
        );
      }

      var category =
        wfNormCategory_(
          data.Kategori
        );

      if (
        category &&
        (AMI_CONFIG.CAPAIAN || [])
          .indexOf(category) < 0
      ) {
        throw new Error(
          'Kategori tidak valid pada ' +
          (
            a.ItemCode ||
            a.NamaStandar ||
            id
          )
        );
      }

      var old = olds[id] || {};
      var follow = follows[id] || {};
      var self = selfs[id] || {};
      var negative =
        wfIsNegative_(category);

      function incomingOrOld_(
        incoming,
        oldValue,
        initialValue
      ) {
        if (incoming !== undefined) {
          return String(
            incoming == null
              ? ''
              : incoming
          ).trim();
        }

        return String(
          oldValue ||
          initialValue ||
          ''
        ).trim();
      }

      var rec = {
        FindingID:
          old.FindingID ||
          uuid_('FND'),

        AuditID:auditId,
        AssignID:id,
        StandardID:a.StandardID,
        Kategori:category,

        Deskripsi:
          negative
            ? incomingOrOld_(data.Deskripsi, old.Deskripsi, self.EvaluasiDiri)
            : String(data.Deskripsi == null ? '' : data.Deskripsi).trim(),

        Kriteria:
          incomingOrOld_(data.Kriteria, old.Kriteria, a.PernyataanStandarSnapshot),

        Akibat:
          negative
            ? incomingOrOld_(data.Akibat, old.Akibat, self.Akibat)
            : String(data.Akibat == null ? '' : data.Akibat).trim(),

        AkarPenyebab:
          negative
            ? incomingOrOld_(data.AkarPenyebab, old.AkarPenyebab, self.AkarPenyebab)
            : String(data.AkarPenyebab == null ? '' : data.AkarPenyebab).trim(),

        Rekomendasi:
          String(
            data.Rekomendasi == null
              ? ''
              : data.Rekomendasi
          ).trim(),

        // Auditor boleh merevisi tindak lanjut awal Auditi.
        // SELF_FOLLOW_UP tetap menyimpan versi awal Auditi sebagai histori.
        TanggapanAuditi:
          negative
            ? incomingOrOld_(
                data.TanggapanAuditi,
                old.TanggapanAuditi,
                follow.TanggapanAuditi
              )
            : '',

        RencanaPerbaikan:
          negative
            ? incomingOrOld_(
                data.RencanaPerbaikan,
                old.RencanaPerbaikan,
                follow.RencanaPerbaikan
              )
            : '',

        JadwalPerbaikan:
          negative
            ? incomingOrOld_(
                data.JadwalPerbaikan,
                old.JadwalPerbaikan,
                follow.JadwalPerbaikan
              )
            : '',

        PJPerbaikan:
          negative
            ? incomingOrOld_(
                data.PJPerbaikan,
                old.PJPerbaikan,
                follow.PJPerbaikan
              )
            : '',

        RencanaPencegahan:
          negative
            ? incomingOrOld_(
                data.RencanaPencegahan,
                old.RencanaPencegahan,
                follow.RencanaPencegahan
              )
            : '',

        JadwalPencegahan:
          negative
            ? incomingOrOld_(
                data.JadwalPencegahan,
                old.JadwalPencegahan,
                follow.JadwalPencegahan
              )
            : '',

        PJPencegahan:
          negative
            ? incomingOrOld_(
                data.PJPencegahan,
                old.PJPencegahan,
                follow.PJPencegahan
              )
            : '',

        CreatedAt:
          old.CreatedAt ||
          now_(),

        CreatedBy:
          old.CreatedBy ||
          u.Nama,

        UpdatedAt:now_(),
        UpdatedBy:u.Nama
      };

      findingRecords.push(rec);

      var oldImp =
        improvements[id] || {};

      var positive =
        wfIsPositive_(category);

      // Draft awal dapat berasal dari Auditi; pada tahap ini Auditor menetapkan versi final.
      var impRec = {
        ImprovementID:
          oldImp.ImprovementID ||
          uuid_('IMP'),

        AuditID:auditId,
        AssignID:id,
        StandardID:a.StandardID,

        SelfEvalID:
          oldImp.SelfEvalID || '',

        CapaianAwal:
          oldImp.CapaianAwal || '',

        KategoriFinal:category,

        FaktorPendukung:
          positive
            ? String(
                data.FaktorPendukung == null
                  ? ''
                  : data.FaktorPendukung
              ).trim()
            : (
                oldImp.FaktorPendukung ||
                ''
              ),

        RekomendasiPeningkatanIndikator:
          positive
            ? String(
                data.RekomendasiPeningkatanIndikator == null
                  ? ''
                  : data.RekomendasiPeningkatanIndikator
              ).trim()
            : (
                oldImp.RekomendasiPeningkatanIndikator ||
                ''
              ),

        Status:
          positive
            ? 'DIISI AUDITOR'
            : 'TIDAK DIPERLUKAN',

        SavedAt:
          oldImp.SavedAt ||
          now_(),

        SavedBy:
          oldImp.SavedBy ||
          u.Nama,

        UpdatedAt:now_(),
        UpdatedBy:u.Nama
      };

      improvementRecords.push(
        impRec
      );
    });

    wfBatchUpsert_(
      'FINDINGS',
      ['AuditID','AssignID'],
      findingRecords,
      [
        'JadwalPerbaikan',
        'JadwalPencegahan'
      ]
    );

    wfBatchUpsert_(
      WF_IMPROVEMENT_SHEET_,
      ['AuditID','AssignID'],
      improvementRecords,
      []
    );

    if (
      status ===
      'VISITASI BERJALAN'
    ) {
      updateRow_(
        'AMI_AUDITI',
        audit._row,
        {
          Status:
            'HASIL AUDIT DIISI'
        }
      );
    }

    if (
      typeof auditLog_ ===
      'function'
    ) {
      auditLog_(
        u,
        'SAVE_ALL_FINDINGS',
        'FINDINGS',
        auditId,
        '',
        '',
        {
          items:
            findingRecords.length
        }
      );
    }

    return {
      ok:true,
      saved:findingRecords.length,
      message:
        'Seluruh Hasil Audit, revisi tindak lanjut, dan rekomendasi peningkatan tersimpan.'
    };
  });
}

function validateAuditResult_(token, auditId) {
  var u =
    requireRole_(
      token,
      ['AUDITOR']
    );

  wfAssertAccess_(
    u,
    auditId,
    ['AUDITOR']
  );

  wfEnsureImprovement_();

  var assignments =
    wfActiveAssignments_(
      auditId
    );

  var findings =
    wfExistingMap_(
      'FINDINGS',
      auditId,
      'AssignID'
    );

  var improvements =
    wfImprovementMap_(
      auditId
    );

  var errors = [];

  assignments.forEach(function(a) {
    var id =
      wfClean_(a.AssignID);

    var f =
      findings[id] || {};

    var category =
      wfNormCategory_(
        f.Kategori
      );

    var label =
      a.ItemCode ||
      a.NamaStandar ||
      id;

    if (!category) {
      errors.push(
        label +
        ': hasil audit belum dinilai'
      );
      return;
    }

    if (wfIsNegative_(category)) {
      if (!wfClean_(f.Deskripsi)) {
        errors.push(
          label +
          ': Deskripsi Temuan wajib'
        );
      }

      if (!wfClean_(f.Kriteria)) {
        errors.push(
          label +
          ': Kriteria wajib'
        );
      }

      if (!wfClean_(f.Akibat)) {
        errors.push(
          label +
          ': Akibat wajib'
        );
      }

      if (!wfClean_(f.AkarPenyebab)) {
        errors.push(
          label +
          ': Akar Penyebab wajib'
        );
      }

      if (!wfClean_(f.Rekomendasi)) {
        errors.push(
          label +
          ': Rekomendasi Perbaikan Auditor wajib'
        );
      }

      if (!wfClean_(f.RencanaPerbaikan)) {
        errors.push(
          label +
          ': Rencana Perbaikan Auditi wajib'
        );
      }

      if (!wfClean_(f.JadwalPerbaikan)) {
        errors.push(
          label +
          ': Jadwal Perbaikan wajib'
        );
      }

      if (!wfClean_(f.PJPerbaikan)) {
        errors.push(
          label +
          ': Penanggung Jawab wajib'
        );
      }
    }

    if (wfIsPositive_(category)) {
      var imp =
        improvements[id] || {};

      if (
        !wfClean_(
          imp.FaktorPendukung
        )
      ) {
        errors.push(
          label +
          ': Faktor Pendukung wajib diisi Auditor'
        );
      }

      if (
        !wfClean_(
          imp.RekomendasiPeningkatanIndikator
        )
      ) {
        errors.push(
          label +
          ': Rekomendasi Peningkatan Indikator wajib diisi Auditor'
        );
      }
    }
  });

  // Form Program Kerja adalah bagian dari hasil audit yang akan masuk laporan.
  // Lead tidak boleh mengirim hasil untuk persetujuan bila field induk atau
  // seluruh uraian langkah kerja belum lengkap.
  var form2Row = findOne_('FORM2_PROGRAM_KERJA','AuditID',auditId) || {};
  var rawPrograms = parseJson_(form2Row.LangkahJSON,[]) || [];
  var programs = wfNormalizeProgramForms_(rawPrograms,form2Row);
  if (!programs.length) {
    errors.push('Form Program Kerja Audit belum diisi.');
  } else {
    programs.forEach(function(p,pi){
      var labelP='Program Kerja Audit #' + String(pi+1);
      if(!wfClean_(p.nomorStandar)) errors.push(labelP + ': Nomor Standar wajib');
      if(!wfClean_(p.namaStandar)) errors.push(labelP + ': Nama Standar wajib');
      if(!wfClean_(p.tentatifAuditObjektif)) errors.push(labelP + ': Tentatif Audit Objektif wajib');
      if(!wfClean_(p.tujuanAudit)) errors.push(labelP + ': Tujuan Audit wajib');
      var steps=Array.isArray(p.langkahKerja)?p.langkahKerja:[];
      if(!steps.some(function(x){return wfClean_(x&&x.uraian);})) {
        errors.push(labelP + ': minimal satu Uraian Langkah Kerja wajib');
      }
    });
  }

  return {
    ok:
      errors.length === 0,
    errors:errors
  };
}


/* ==================== TINDAK LANJ AUDITI PASCA AUDIT ==================== */

function saveAllAuditiFollowUps(token, auditId, items) {
  return withLock_(function() {
    var u = requireRole_(token, ['AUDITI']);
    var audit = wfAssertAccess_(u, auditId, ['AUDITI']);
    if (wfClean_(audit.Status) !== 'MENUNGGU ACC AUDITI') {
      throw new Error('Tindak Lanjut terkunci pada status ' + wfClean_(audit.Status) + '.');
    }

    var findings = wfExistingMap_('FINDINGS', auditId, 'FindingID');
    var assignments = wfAssignmentMap_(auditId);
    var records=[];

    (items||[]).forEach(function(data){
      data=data||{};
      var fid=wfClean_(data.FindingID);
      var old=findings[fid];
      if(!old) throw new Error('Temuan tidak ditemukan: '+fid);
      if(!wfIsNegative_(old.Kategori)) return;
      if(!assignments[wfClean_(old.AssignID)]) return;

      var rec={};
      Object.keys(old).forEach(function(k){if(k!=='_row')rec[k]=old[k];});
      rec.TanggapanAuditi=String(data.TanggapanAuditi||'').trim();
      rec.RencanaPerbaikan=String(data.RencanaPerbaikan||'').trim();
      rec.JadwalPerbaikan=String(data.JadwalPerbaikan||'').trim();
      rec.PJPerbaikan=String(data.PJPerbaikan||'').trim();
      rec.RencanaPencegahan=String(data.RencanaPencegahan||'').trim();
      rec.JadwalPencegahan=String(data.JadwalPencegahan||'').trim();
      rec.PJPencegahan=String(data.PJPencegahan||'').trim();
      rec.UpdatedAt=now_();
      rec.UpdatedBy=u.Nama;
      records.push(rec);
    });

    // Penting: SELF_FOLLOW_UP adalah snapshot awal Evaluasi Diri dan tidak diubah lagi
    // pada tahap pasca-audit. Tindak lanjut final/terverifikasi disimpan di FINDINGS.
    if(records.length) wfBatchUpsert_('FINDINGS',['AuditID','AssignID'],records,['JadwalPerbaikan','JadwalPencegahan']);
    if(typeof auditLog_==='function') auditLog_(u,'SAVE_ALL_AUDITI_FOLLOW_UP','FINDINGS',auditId,'','',{items:records.length});
    return {ok:true,saved:records.length,message:'Seluruh Tindak Lanjut final Auditi tersimpan tanpa mengubah histori Evaluasi Diri.'};
  });
}

/* ==================== MAINTENANCE ==================== */

function maintenanceEnsureWorkflowFinal_() {
  var self = ensureSheetReady_('SELF_EVAL', SHEET_DEFS.SELF_EVAL);
  var follow = wfEnsureFollowUp_();
  var imp = wfEnsureImprovement_();

  return {
    ok:true,
    selfEvalSheet:self.getName(),
    followUpSheet:follow.getName(),
    improvementSheet:imp.getName(),
    message:'Workflow batch final siap. Schema Evaluasi Diri negatif (Akibat dan AkarPenyebab) sudah dipastikan.'
  };
}

/**
 * Wrapper publik untuk menjalankan maintenance workflow dari dropdown Apps Script.
 * Jalankan fungsi: maintenanceEnsureWorkflowFinal
 */
function maintenanceEnsureWorkflowFinal() {
  var result = maintenanceEnsureWorkflowFinal_();
  Logger.log(JSON.stringify(result));
  return result;
}

