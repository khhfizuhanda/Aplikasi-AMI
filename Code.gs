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
