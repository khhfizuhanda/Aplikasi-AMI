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
