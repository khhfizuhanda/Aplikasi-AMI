/**
 * StandardService.gs — AMI V1.4
 * Manajemen Master Standar lintas tahun dengan versioning dan snapshot historis.
 */

function standardContentFields_(){
  return ['ItemCode','Kelompok','KodeKelompokStandar','NamaStandar','NoSumber','PernyataanStandar','StrategiPencapaian','Indikator','SumberFile','TahunSumber','HalamanPDFMulai','HalamanPDFAkhir'];
}

function standardContentHash_(rec){
  const raw=standardContentFields_().map(function(k){return cleanText_(rec&&rec[k]);}).join('\u241f');
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw,Utilities.Charset.UTF_8);
  return bytes.map(function(b){const v=b<0?b+256:b;return('0'+v.toString(16)).slice(-2);}).join('').substring(0,32);
}

function standardUsageMap_(){
  const out={};
  const audits={};getAllRows_('AMI_AUDITI').forEach(function(a){audits[cleanText_(a.AuditID)]=a;});
  getAllRows_('AMI_STANDARD_ASSIGN').forEach(function(a){
    const sid=cleanText_(a.StandardID);if(!sid)return;
    if(!out[sid])out[sid]={total:0,draft:0,published:0,final:0};
    out[sid].total++;
    const aud=audits[cleanText_(a.AuditID)],st=aud?cleanText_(aud.Status):'';
    if(st==='DRAFT BPM')out[sid].draft++;else out[sid].published++;
    if(st==='FINAL')out[sid].final++;
  });
  return out;
}

function standardAppliesToYear_(s,year){
  year=Number(year)||0;if(!year)return true;
  const start=Number(cleanText_(s.TahunBerlakuMulai))||0,end=Number(cleanText_(s.TahunBerlakuSampai))||0;
  return (!start||year>=start)&&(!end||year<=end);
}

function normalizeStandardStatus_(v){
  const x=cleanText_(v).toUpperCase();return (AMI_CONFIG.STANDARD_STATUSES||[]).indexOf(x)>=0?x:'';
}

function normalizeStandardRecord_(data,old){
  data=Object.assign({},data||{});old=old||{};
  const rec={};
  standardContentFields_().forEach(function(k){rec[k]=cleanText_(data[k]);});
  if(!rec.ItemCode)throw new Error('Kode Butir/ItemCode wajib diisi.');
  if(!rec.NamaStandar)throw new Error('Nama Standar wajib diisi.');
  if(!rec.PernyataanStandar)throw new Error('Pernyataan Standar wajib diisi.');
  if(!rec.Indikator)throw new Error('Indikator wajib diisi.');
  rec.StandardFamilyID=cleanText_(data.StandardFamilyID)||cleanText_(old.StandardFamilyID)||uuid_('STDFAM');
  rec.Versi=cleanText_(data.Versi)||cleanText_(old.Versi)||'1.0';
  rec.TahunBerlakuMulai=cleanText_(data.TahunBerlakuMulai)||cleanText_(old.TahunBerlakuMulai)||cleanText_(rec.TahunSumber);
  rec.TahunBerlakuSampai=cleanText_(data.TahunBerlakuSampai);
  let st=normalizeStandardStatus_(data.StatusStandar)||normalizeStandardStatus_(old.StatusStandar)||'DRAFT';
  rec.StatusStandar=st;
  if(st==='BERLAKU'&&!rec.TahunBerlakuMulai)throw new Error('Tahun Berlaku Mulai wajib diisi untuk standar berstatus BERLAKU.');
  rec.ReplacesStandardID=cleanText_(data.ReplacesStandardID)||cleanText_(old.ReplacesStandardID);
  rec.Origin=cleanText_(old.Origin)||cleanText_(data.Origin)||'MANUAL';
  rec.Notes=cleanText_(data.Notes);
  rec.Active=st==='BERLAKU';
  rec.SourceHash=standardContentHash_(rec);
  return rec;
}

function migrateStandardVersionMetadata_(){
  const sh=sheet_('MASTER_STANDAR'),h=headers_('MASTER_STANDAR'),last=sh.getLastRow();if(last<2)return{updated:0};
  const values=sh.getRange(2,1,last-1,h.length).getValues(),idx={};h.forEach(function(k,i){idx[k]=i;});
  const usage=standardUsageMap_();let updated=0;
  values.forEach(function(row){
    const sid=cleanText_(row[idx.StandardID]);if(!sid)return;let changed=false;
    function fill(k,v){if(idx[k]!=null&&!cleanText_(row[idx[k]])){row[idx[k]]=v;changed=true;}}
    fill('StandardFamilyID','STDFAM-'+sid);
    fill('Versi','1.0');
    fill('TahunBerlakuMulai',cleanText_(row[idx.TahunSumber]));
    fill('StatusStandar','BERLAKU');
    fill('Origin',cleanText_(row[idx.SourceHash])?'SEED':'LEGACY');
    fill('CreatedBy','SYSTEM MIGRATION');
    if(idx.Locked!=null){const lock=!!(usage[sid]&&usage[sid].total);if(row[idx.Locked]!==lock){row[idx.Locked]=lock;changed=true;}}
    if(idx.Active!=null&&cleanText_(row[idx.StatusStandar])==='BERLAKU'&&row[idx.Active]!==true){row[idx.Active]=true;changed=true;}
    if(changed){if(idx.UpdatedBy!=null)row[idx.UpdatedBy]='SYSTEM MIGRATION';updated++;}
  });
  if(updated)sh.getRange(2,1,values.length,h.length).setValues(values);
  return{updated:updated,total:values.length};
}

function standardSnapshotFromMaster_(s){
  return{
    KelompokSnapshot:cleanText_(s.Kelompok),KodeKelompokSnapshot:cleanText_(s.KodeKelompokStandar),
    PernyataanStandarSnapshot:cleanText_(s.PernyataanStandar),StrategiSnapshot:cleanText_(s.StrategiPencapaian),IndikatorSnapshot:cleanText_(s.Indikator),
    SumberFileSnapshot:cleanText_(s.SumberFile),TahunSumberSnapshot:cleanText_(s.TahunSumber),SourceHashSnapshot:cleanText_(s.SourceHash),
    VersiStandarSnapshot:cleanText_(s.Versi)||'1.0',TahunBerlakuSnapshot:cleanText_(s.TahunBerlakuMulai)
  };
}

function backfillAssignmentSnapshots_(){
  const sh=sheet_('AMI_STANDARD_ASSIGN'),h=headers_('AMI_STANDARD_ASSIGN'),last=sh.getLastRow();if(last<2)return{updated:0};
  const values=sh.getRange(2,1,last-1,h.length).getValues(),idx={};h.forEach(function(k,i){idx[k]=i;});
  const masters={};getAllRows_('MASTER_STANDAR').forEach(function(s){masters[cleanText_(s.StandardID)]=s;});let updated=0;
  values.forEach(function(row){const s=masters[cleanText_(row[idx.StandardID])];if(!s)return;const snap=standardSnapshotFromMaster_(s);let changed=false;Object.keys(snap).forEach(function(k){if(idx[k]!=null&&!cleanText_(row[idx[k]])){row[idx[k]]=snap[k];changed=true;}});if(changed)updated++;});
  if(updated)sh.getRange(2,1,values.length,h.length).setValues(values);
  return{updated:updated,total:values.length};
}

function listStandardsAdmin(token,filters){
  requireRole_(token,['ADMIN_BPM']);filters=filters||{};const usage=standardUsageMap_();let rows=getAllRows_('MASTER_STANDAR');
  const q=cleanText_(filters.q).toLowerCase(),status=cleanText_(filters.status).toUpperCase(),kelompok=cleanText_(filters.kelompok),tahun=Number(filters.tahun)||0;
  if(status)rows=rows.filter(function(r){return cleanText_(r.StatusStandar).toUpperCase()===status;});
  if(kelompok)rows=rows.filter(function(r){return cleanText_(r.Kelompok)===kelompok;});
  if(tahun)rows=rows.filter(function(r){return standardAppliesToYear_(r,tahun);});
  if(q)rows=rows.filter(function(r){return[r.ItemCode,r.NamaStandar,r.PernyataanStandar,r.Indikator,r.SumberFile,r.Versi].some(function(v){return String(v||'').toLowerCase().indexOf(q)>=0;});});
  rows=rows.map(function(r){const o=cleanRow_(r),u=usage[cleanText_(r.StandardID)]||{total:0,draft:0,published:0,final:0};o.UsageTotal=u.total;o.UsagePublished=u.published;o.UsageFinal=u.final;o.Locked=u.total>0;o.CanEditContent=u.total===0;o.CanDelete=u.total===0&&cleanText_(r.StatusStandar)==='DRAFT';return o;});
  rows.sort(function(a,b){const c=String(a.ItemCode||'').localeCompare(String(b.ItemCode||''));if(c)return c;return String(a.Versi||'').localeCompare(String(b.Versi||''),undefined,{numeric:true});});
  return serializeValue_(rows);
}

function saveStandard(token,data){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']);data=data||{};const id=cleanText_(data.StandardID),old=id?findOne_('MASTER_STANDAR','StandardID',id):null,usage=standardUsageMap_(),used=old&&usage[id]&&usage[id].total>0;
  const rec=normalizeStandardRecord_(data,old||{});
  if(old&&used){
    const changed=standardContentFields_().some(function(k){return cleanText_(old[k])!==cleanText_(rec[k]);});
    if(changed)throw new Error('Standar ini sudah digunakan pada audit dan substansinya terkunci. Gunakan tombol "Buat Versi Baru" agar histori AMI lama tidak berubah.');
    rec.StandardFamilyID=cleanText_(old.StandardFamilyID);rec.Versi=cleanText_(old.Versi);rec.TahunBerlakuMulai=cleanText_(old.TahunBerlakuMulai);rec.ReplacesStandardID=cleanText_(old.ReplacesStandardID);rec.SourceHash=cleanText_(old.SourceHash);rec.Locked=true;
  }
  const duplicate=getAllRows_('MASTER_STANDAR').find(function(r){return cleanText_(r.StandardID)!==id&&normalizeUsername_(r.ItemCode)===normalizeUsername_(rec.ItemCode)&&normalizeUsername_(r.Versi)===normalizeUsername_(rec.Versi);});
  if(duplicate)throw new Error('Kode '+rec.ItemCode+' versi '+rec.Versi+' sudah ada. Edit versi tersebut atau gunakan nomor versi lain.');
  const sid=id||uuid_('STD');rec.StandardID=sid;rec.Locked=!!used;rec.UpdatedAt=now_();rec.UpdatedBy=u.Nama;
  if(old){rec.CreatedAt=old.CreatedAt||now_();rec.CreatedBy=old.CreatedBy||u.Nama;updateRow_('MASTER_STANDAR',old._row,rec);}else{rec.CreatedAt=now_();rec.CreatedBy=u.Nama;appendObject_('MASTER_STANDAR',rec);}
  if(rec.StatusStandar==='BERLAKU'&&rec.ReplacesStandardID&&Number(rec.TahunBerlakuMulai)){const prev=findOne_('MASTER_STANDAR','StandardID',rec.ReplacesStandardID);if(prev){const end=Number(rec.TahunBerlakuMulai)-1;if(!cleanText_(prev.TahunBerlakuSampai)||Number(prev.TahunBerlakuSampai)>=Number(rec.TahunBerlakuMulai))updateRow_('MASTER_STANDAR',prev._row,{TahunBerlakuSampai:String(end),UpdatedAt:now_(),UpdatedBy:u.Nama});}}
  auditLog_(u,old?'EDIT_STANDARD':'ADD_STANDARD','MASTER_STANDAR','',sid,old,rec);try{CacheService.getScriptCache().remove('AMI_PUBLIC_DASH_'+AMI_CONFIG.VERSION);}catch(ignore){}
  return{ok:true,id:sid,locked:!!used};
});}

function nextStandardVersion_(familyId){
  const versions=getAllRows_('MASTER_STANDAR').filter(function(r){return cleanText_(r.StandardFamilyID)===cleanText_(familyId);}).map(function(r){return Number.parseFloat(cleanText_(r.Versi))||0;});
  const max=versions.length?Math.max.apply(null,versions):0;return String(Math.floor(max)+1)+'.0';
}

function createStandardVersion(token,standardId){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']),old=findOne_('MASTER_STANDAR','StandardID',standardId);if(!old)throw new Error('Standar tidak ditemukan.');
  const rec={};standardContentFields_().forEach(function(k){rec[k]=old[k];});rec.StandardID=uuid_('STD');rec.StandardFamilyID=cleanText_(old.StandardFamilyID)||('STDFAM-'+cleanText_(old.StandardID));rec.Versi=nextStandardVersion_(rec.StandardFamilyID);rec.TahunBerlakuMulai='';rec.TahunBerlakuSampai='';rec.StatusStandar='DRAFT';rec.ReplacesStandardID=old.StandardID;rec.Origin='VERSION';rec.Locked=false;rec.Active=false;rec.Notes='Versi baru dari '+cleanText_(old.ItemCode)+' v'+(cleanText_(old.Versi)||'1.0');rec.SourceHash=standardContentHash_(rec);rec.CreatedAt=now_();rec.CreatedBy=u.Nama;rec.UpdatedAt=now_();rec.UpdatedBy=u.Nama;
  appendObject_('MASTER_STANDAR',rec);auditLog_(u,'CREATE_STANDARD_VERSION','MASTER_STANDAR','',rec.StandardID,old,rec);return serializeValue_({ok:true,standard:rec});
});}

function changeStandardStatus(token,standardId,status){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']),r=findOne_('MASTER_STANDAR','StandardID',standardId);if(!r)throw new Error('Standar tidak ditemukan.');status=normalizeStandardStatus_(status);if(!status)throw new Error('Status standar tidak valid.');
  if(status==='BERLAKU'&&!cleanText_(r.TahunBerlakuMulai))throw new Error('Isi Tahun Berlaku Mulai sebelum menetapkan status BERLAKU.');
  const patch={StatusStandar:status,Active:status==='BERLAKU',UpdatedAt:now_(),UpdatedBy:u.Nama};updateRow_('MASTER_STANDAR',r._row,patch);auditLog_(u,'CHANGE_STANDARD_STATUS','MASTER_STANDAR','',standardId,r,patch);return{ok:true,status:status};
});}

function deleteStandardDraft(token,standardId){return withLock_(function(){
  const u=requireRole_(token,['ADMIN_BPM']),r=findOne_('MASTER_STANDAR','StandardID',standardId);if(!r)throw new Error('Standar tidak ditemukan.');const usage=standardUsageMap_()[standardId];if(usage&&usage.total)throw new Error('Standar sudah digunakan pada audit dan tidak dapat dihapus. Ubah status menjadi ARSIP/DICABUT.');if(cleanText_(r.StatusStandar)!=='DRAFT')throw new Error('Hanya standar DRAFT yang belum pernah digunakan yang dapat dihapus permanen.');deleteRowByKey_('MASTER_STANDAR','StandardID',standardId);auditLog_(u,'DELETE_STANDARD_DRAFT','MASTER_STANDAR','',standardId,r,'');return{ok:true};
});}

function getStandardVersions(token,standardId){
  requireRole_(token,['ADMIN_BPM']);const r=findOne_('MASTER_STANDAR','StandardID',standardId);if(!r)throw new Error('Standar tidak ditemukan.');const fam=cleanText_(r.StandardFamilyID)||('STDFAM-'+cleanText_(r.StandardID));return listStandardsAdmin(token,{}).filter(function(x){return cleanText_(x.StandardFamilyID)===fam;});
}

function bulkImportStandards(token,rawText){
  return withLock_(function(){
    const u=requireRole_(token,['ADMIN_BPM']);
    const lines=String(rawText||'').split(/\r?\n/).filter(function(x){return cleanText_(x);});
    if(!lines.length)return{inserted:0,updated:0,skipped:0,errors:[]};

    const existing=getAllRows_('MASTER_STANDAR'),usage=standardUsageMap_(),stamp=now_();
    const byKey={},byId={},seenInput={},recordsById={},order=[],errors=[];
    existing.forEach(function(r){
      const key=normalizeUsername_(r.ItemCode)+'|'+normalizeUsername_(r.Versi||'1.0');
      if(key!=='|')byKey[key]=r;
      if(cleanText_(r.StandardID))byId[cleanText_(r.StandardID)]=r;
    });

    let inserted=0,updated=0,skipped=0;
    function queue(rec){
      const id=cleanText_(rec.StandardID);
      if(!recordsById[id])order.push(id);
      recordsById[id]=Object.assign(recordsById[id]||{},rec);
    }

    lines.forEach(function(line,idx){
      const c=line.split('\t');
      try{
        const code=cleanText_(c[0]),versi=cleanText_(c[9])||'1.0';
        if(!code)throw new Error('Kode Butir kosong.');
        const key=normalizeUsername_(code)+'|'+normalizeUsername_(versi);
        if(seenInput[key])throw new Error('ItemCode + Versi duplikat pada input yang sama.');
        seenInput[key]=true;

        const old=byKey[key]||null;
        const data={
          StandardID:old?old.StandardID:'',
          StandardFamilyID:old?old.StandardFamilyID:'',
          ItemCode:code,
          Kelompok:c[1]||'',KodeKelompokStandar:c[2]||'',NamaStandar:c[3]||'',NoSumber:c[4]||'',
          PernyataanStandar:c[5]||'',StrategiPencapaian:c[6]||'',Indikator:c[7]||'',
          TahunBerlakuMulai:c[8]||'',Versi:versi,StatusStandar:c[10]||'DRAFT',
          SumberFile:c[11]||'',TahunSumber:c[12]||'',
          HalamanPDFMulai:c.length>14?(c[13]||''):(old?old.HalamanPDFMulai:''),
          HalamanPDFAkhir:c.length>14?(c[14]||''):(old?old.HalamanPDFAkhir:''),
          Notes:c.length>15?(c[15]||''):(c[13]||''),
          ReplacesStandardID:old?old.ReplacesStandardID:''
        };
        const rec=normalizeStandardRecord_(data,old||{}),used=!!(old&&usage[cleanText_(old.StandardID)]&&usage[cleanText_(old.StandardID)].total>0);

        if(old&&used){
          const changed=standardContentFields_().some(function(k){return cleanText_(old[k])!==cleanText_(rec[k]);});
          if(changed)throw new Error('Standar sudah digunakan pada audit; perubahan substansi wajib melalui versi baru.');
          rec.StandardFamilyID=cleanText_(old.StandardFamilyID);rec.Versi=cleanText_(old.Versi);
          rec.TahunBerlakuMulai=cleanText_(old.TahunBerlakuMulai);rec.ReplacesStandardID=cleanText_(old.ReplacesStandardID);
          rec.SourceHash=cleanText_(old.SourceHash);rec.Locked=true;
        }

        const sid=old?cleanText_(old.StandardID):uuid_('STD');
        rec.StandardID=sid;rec.Locked=used;rec.UpdatedAt=stamp;rec.UpdatedBy=u.Nama;
        rec.CreatedAt=old&&old.CreatedAt?old.CreatedAt:stamp;rec.CreatedBy=old&&old.CreatedBy?old.CreatedBy:u.Nama;
        queue(rec);
        byKey[key]=Object.assign({},old||{},rec);
        byId[sid]=byKey[key];
        old?updated++:inserted++;

        if(rec.StatusStandar==='BERLAKU'&&rec.ReplacesStandardID&&Number(rec.TahunBerlakuMulai)){
          const prev=byId[cleanText_(rec.ReplacesStandardID)];
          if(prev){
            const endYear=Number(rec.TahunBerlakuMulai)-1;
            if(!cleanText_(prev.TahunBerlakuSampai)||Number(prev.TahunBerlakuSampai)>=Number(rec.TahunBerlakuMulai)){
              queue({StandardID:prev.StandardID,TahunBerlakuSampai:String(endYear),UpdatedAt:stamp,UpdatedBy:u.Nama});
            }
          }
        }
      }catch(e){
        skipped++;
        if(errors.length<20)errors.push('Baris '+(idx+1)+': '+(e&&e.message?e.message:String(e)));
      }
    });

    const records=order.map(function(id){return recordsById[id];});
    if(records.length)batchUpsert_('MASTER_STANDAR',['StandardID'],records,[]);
    auditLog_(u,'BULK_IMPORT_STANDARDS','MASTER_STANDAR','','','',{inserted:inserted,updated:updated,skipped:skipped,rows:records.length,errors:errors});
    try{CacheService.getScriptCache().remove('AMI_PUBLIC_DASH_'+AMI_CONFIG.VERSION);}catch(ignore){}
    return{inserted:inserted,updated:updated,skipped:skipped,errors:errors};
  });
}

/**
 * ============================================================
 * KODE RESMI STANDAR UMA — MIGRASI PRA-LAUNCH
 * ============================================================
 * ItemCode menjadi: <Kode Standar Resmi>-<nomor butir 2 digit>
 * contoh: STD/SPMI/UMA/1.1.0.0/2024-01
 *
 * Kode kelompok Penelitian dan Pengabdian telah dikonfirmasi BPM:
 * - Penelitian: 2.1.0.0 (Luaran), 2.2.0.0 (Proses), 2.3.0.0 (Masukan).
 * - Pengabdian: 3.1.0.0 (Luaran), 3.2.0.0 (Proses), 3.3.0.0 (Sarana dan Prasarana).
 * Pemetaan ini dipakai sebagai kode resmi sistem dan laporan AMI.
 */
const UMA_OFFICIAL_STANDARD_CODES = Object.freeze({
  'Standar Kompetensi Lulusan':'STD/SPMI/UMA/1.1.0.0/2024',
  'Standar Luaran Dharma Pendidikan':'STD/SPMI/UMA/1.1.1.0/2024',
  'Standar Isi Pembelajaran':'STD/SPMI/UMA/1.2.0.0/2024',
  'Standar Proses Pembelajaran':'STD/SPMI/UMA/1.3.0.0/2024',
  'Standar Penilaian Pembelajaran':'STD/SPMI/UMA/1.4.0.0/2024',
  'Standar Dosen':'STD/SPMI/UMA/1.5.0.0/2024',
  'Standar Tenaga Kependidikan':'STD/SPMI/UMA/1.5.1.0/2024',
  'Standar Sarana dan Prasarana Pembelajaran':'STD/SPMI/UMA/1.6.0.0/2024',
  'Standar Pengelolaan Pembelajaran':'STD/SPMI/UMA/1.7.0.0/2024',
  'Standar Pembiayaan Pembelajaran':'STD/SPMI/UMA/1.8.0.0/2024',

  'Standar Luaran Penelitian':'STD/SPMI/UMA/2.1.0.0/2024',
  'Standar Proses Penelitian':'STD/SPMI/UMA/2.2.0.0/2024',
  'Standar Masukan Penelitian':'STD/SPMI/UMA/2.3.0.0/2024',

  'Standar Luaran Pengabdian kepada Masyarakat':'STD/SPMI/UMA/3.1.0.0/2024',
  'Standar Proses Pengabdian kepada Masyarakat':'STD/SPMI/UMA/3.2.0.0/2024',
  'Standar Sarana dan Prasarana Pengabdian kepada Masyarakat':'STD/SPMI/UMA/3.3.0.0/2024',

  'Standar Rekrutmen Auditor':'STD/SPMI/UMA/4.1.0.0/2022',
  'Standar Visi dan Misi':'STD/SPMI/UMA/4.2.0.0/2022',
  'Standar Mahasiswa dan Kemahasiswaan':'STD/SPMI/UMA/4.3.0.0/2022',
  'Standar Suasana Akademik':'STD/SPMI/UMA/4.4.0.0/2022',
  'Standar Kerjasama':'STD/SPMI/UMA/4.5.0.0/2022',
  'Standar Informasi':'STD/SPMI/UMA/4.6.0.0/2022',
  'Standar Pengembangan Budaya Mutu':'STD/SPMI/UMA/4.7.0.0/2022',
  'Standar Kode Etik':'STD/SPMI/UMA/4.8.0.0/2022',

  'Standar Fasilitasi Mahasiswa Melakukan Kegiatan Pembelajaran di Luar Prodi':'STD/SPMI/UMA/5.1.0.0/2024',
  'Standar Perjanjian Kerjasama antar PT atau antar PT dengan Lembaga Non PT':'STD/SPMI/UMA/5.2.0.0/2024'
});

function officialStandardCodeFor_(name){
  return UMA_OFFICIAL_STANDARD_CODES[cleanText_(name)]||'';
}
function officialCodeMigrationWarnings_(){
  return [];
}
function buildOfficialCodeMigrationPlan_(){
  const rows=getAllRows_('MASTER_STANDAR');
  const unmapped=[...new Set(rows.map(r=>cleanText_(r.NamaStandar)).filter(n=>n&&!officialStandardCodeFor_(n)))];
  if(unmapped.length)throw new Error('Nama standar belum memiliki pemetaan kode resmi: '+unmapped.join(' | '));

  // StandardFamilyID membuat versi baru dari butir yang sama tetap memakai ItemCode yang sama.
  const familyMap={};
  rows.forEach(function(r){
    const family=cleanText_(r.StandardFamilyID)||cleanText_(r.StandardID);
    if(!familyMap[family])familyMap[family]={family:family,name:cleanText_(r.NamaStandar),rows:[],firstRow:r._row||999999,no:cleanText_(r.NoSumber),page:Number(r.HalamanPDFMulai)||999999};
    familyMap[family].rows.push(r);
    familyMap[family].firstRow=Math.min(familyMap[family].firstRow,r._row||999999);
    familyMap[family].page=Math.min(familyMap[family].page,Number(r.HalamanPDFMulai)||999999);
  });

  const byName={};
  Object.keys(familyMap).forEach(function(k){const f=familyMap[k];if(!byName[f.name])byName[f.name]=[];byName[f.name].push(f);});
  const targetByFamily={};
  Object.keys(byName).forEach(function(name){
    const fs=byName[name].sort(function(a,b){return a.page-b.page||a.firstRow-b.firstRow;});
    const nums=fs.map(f=>/^\d+$/.test(f.no)?Number(f.no):0);
    const usable=nums.every(n=>n>0)&&new Set(nums).size===nums.length;
    fs.forEach(function(f,i){
      const suffix=String(usable?nums[i]:(i+1)).padStart(2,'0');
      targetByFamily[f.family]=officialStandardCodeFor_(name)+'-'+suffix;
    });
  });

  const plan=[];
  rows.forEach(function(r){
    const family=cleanText_(r.StandardFamilyID)||cleanText_(r.StandardID);
    plan.push({
      StandardID:cleanText_(r.StandardID),
      StandardFamilyID:family,
      NamaStandar:cleanText_(r.NamaStandar),
      Versi:cleanText_(r.Versi)||'1.0',
      CurrentItemCode:cleanText_(r.ItemCode),
      CurrentGroupCode:cleanText_(r.KodeKelompokStandar),
      TargetGroupCode:officialStandardCodeFor_(r.NamaStandar),
      TargetItemCode:targetByFamily[family]
    });
  });
  const dup={};
  plan.forEach(p=>{const k=p.TargetItemCode+'|'+p.Versi;(dup[k]||(dup[k]=[])).push(p.StandardID);});
  const bad=Object.keys(dup).filter(k=>dup[k].length>1);
  if(bad.length)throw new Error('Target kode resmi menghasilkan duplikasi ItemCode+Versi: '+bad.join(', '));
  return plan;
}
function previewOfficialStandardCodeMigration(token){
  requireRole_(token,['ADMIN_BPM']);
  const plan=buildOfficialCodeMigrationPlan_();
  return serializeValue_({
    ok:true,
    total:plan.length,
    changes:plan.filter(p=>p.CurrentItemCode!==p.TargetItemCode||p.CurrentGroupCode!==p.TargetGroupCode),
    warnings:officialCodeMigrationWarnings_(),
    sample:plan.slice(0,25)
  });
}
function applyOfficialStandardCodeMigration(token){
  return withLock_(function(){
    const u=requireRole_(token,['ADMIN_BPM']);
    const plan=buildOfficialCodeMigrationPlan_();
    const byStd={};plan.forEach(p=>byStd[p.StandardID]=p);
    let standardsUpdated=0,assignmentsUpdated=0;
    const newHashByStd={};

    getAllRows_('MASTER_STANDAR').forEach(function(r){
      const p=byStd[cleanText_(r.StandardID)];if(!p)return;
      if(cleanText_(r.ItemCode)===p.TargetItemCode&&cleanText_(r.KodeKelompokStandar)===p.TargetGroupCode)return;
      const next=Object.assign({},r,{ItemCode:p.TargetItemCode,KodeKelompokStandar:p.TargetGroupCode});
      const hash=typeof standardContentHash_==='function'?standardContentHash_(next):cleanText_(r.SourceHash);
      newHashByStd[cleanText_(r.StandardID)]=hash;
      updateRow_('MASTER_STANDAR',r._row,{ItemCode:p.TargetItemCode,KodeKelompokStandar:p.TargetGroupCode,SourceHash:hash,UpdatedAt:now_(),UpdatedBy:u.Nama});
      standardsUpdated++;
    });

    getAllRows_('AMI_STANDARD_ASSIGN').forEach(function(a){
      const p=byStd[cleanText_(a.StandardID)];if(!p)return;
      const patch={};
      if(cleanText_(a.ItemCode)!==p.TargetItemCode)patch.ItemCode=p.TargetItemCode;
      if(cleanText_(a.KodeKelompokSnapshot)!==p.TargetGroupCode)patch.KodeKelompokSnapshot=p.TargetGroupCode;
      const nh=newHashByStd[cleanText_(a.StandardID)];if(nh&&cleanText_(a.SourceHashSnapshot)!==nh)patch.SourceHashSnapshot=nh;
      if(Object.keys(patch).length){updateRow_('AMI_STANDARD_ASSIGN',a._row,patch);assignmentsUpdated++;}
    });

    if(typeof auditLog_==='function')auditLog_(u,'MIGRATE_OFFICIAL_STANDARD_CODES','MASTER_STANDAR','','','',{standardsUpdated:standardsUpdated,assignmentsUpdated:assignmentsUpdated,warnings:officialCodeMigrationWarnings_()});
    return serializeValue_({ok:true,standardsUpdated:standardsUpdated,assignmentsUpdated:assignmentsUpdated,warnings:officialCodeMigrationWarnings_()});
  });
}
