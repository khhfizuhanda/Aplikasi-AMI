/**
 * Database.gs — AMI 2026 Final Optimized
 * Setup dibuat idempotent/non-destruktif dan memberi tahap error yang jelas.
 */

function normalizeSpreadsheetId_(value) {
  const raw = cleanText_(value);
  if (!raw) return '';
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : raw;
}

function openSpreadsheetByConfig_() {
  const configured = normalizeSpreadsheetId_(AMI_CONFIG.DB_SPREADSHEET_ID);
  if (configured) {
    try {
      return SpreadsheetApp.openById(configured);
    } catch (e) {
      throw new Error(
        'DB_SPREADSHEET_ID tidak valid/tidak dapat diakses. Isi hanya ID Google Sheet atau URL Google Sheet yang benar. Detail: ' +
        (e && e.message ? e.message : e)
      );
    }
  }

  const saved = normalizeSpreadsheetId_(PropertiesService.getScriptProperties().getProperty('AMI_DB_ID'));
  if (saved) {
    try { return SpreadsheetApp.openById(saved); } catch (ignore) {}
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  throw new Error(
    'Database belum terhubung. Jika project Apps Script standalone, isi DB_SPREADSHEET_ID di Config.gs. ' +
    'Untuk database AMI yang sudah ada, pastikan DB_SPREADSHEET_ID benar lalu jalankan maintenanceUpgradeSchemaFinal_() sekali dari editor Apps Script.'
  );
}

let AMI_DB_RUNTIME_CACHE_ = null;
let AMI_DB_RUNTIME_ID_ = '';
const AMI_SHEET_RUNTIME_CACHE_ = {};
const AMI_HEADER_RUNTIME_CACHE_ = {};
const AMI_ROWS_RUNTIME_CACHE_ = {};
// V27: cache lintas-eksekusi hanya untuk tabel referensi kecil/read-mostly.
// Tabel transaksi audit sengaja TIDAK dicache lintas eksekusi agar data kerja tetap real-time.
const AMI_SHARED_ROWS_CACHE_TTL_ = 120;
const AMI_SHARED_ROWS_CACHE_SHEETS_ = Object.freeze({SETTINGS:true,MASTER_PRODI:true,MASTER_UNIT:true,MASTER_AUDITOR:true,MASTER_PIMPINAN:true,AMI_CYCLE:true});
function sharedRowsCacheKey_(name){return 'AMI_V27_ROWS_'+AMI_CONFIG.VERSION+'_'+cleanText_(name);}
function invalidateRowsCache_(name){
  if(name){
    delete AMI_ROWS_RUNTIME_CACHE_[name];
    if(AMI_SHARED_ROWS_CACHE_SHEETS_[name]){try{CacheService.getScriptCache().remove(sharedRowsCacheKey_(name));}catch(ignore){}}
  }else{
    // no-name dipakai saat baru memperoleh ScriptLock: hanya reset snapshot lokal
    // eksekusi ini, jangan menghancurkan cache referensi global akibat write transaksi lain.
    Object.keys(AMI_ROWS_RUNTIME_CACHE_).forEach(function(k){delete AMI_ROWS_RUNTIME_CACHE_[k];});
  }
}

function resetDbRuntimeCache_() {
  AMI_DB_RUNTIME_CACHE_ = null;
  AMI_DB_RUNTIME_ID_ = '';
  Object.keys(AMI_SHEET_RUNTIME_CACHE_).forEach(function(k){ delete AMI_SHEET_RUNTIME_CACHE_[k]; });
  Object.keys(AMI_HEADER_RUNTIME_CACHE_).forEach(function(k){ delete AMI_HEADER_RUNTIME_CACHE_[k]; });
  invalidateRowsCache_();
}

function db_() {
  const configured = normalizeSpreadsheetId_(AMI_CONFIG.DB_SPREADSHEET_ID);
  const saved = normalizeSpreadsheetId_(PropertiesService.getScriptProperties().getProperty('AMI_DB_ID'));
  const expectedId = configured || saved || '';

  if (AMI_DB_RUNTIME_CACHE_) {
    if (!expectedId || AMI_DB_RUNTIME_ID_ === expectedId) {
      return AMI_DB_RUNTIME_CACHE_;
    }
    resetDbRuntimeCache_();
  }

  const ss = openSpreadsheetByConfig_();
  AMI_DB_RUNTIME_CACHE_ = ss;
  AMI_DB_RUNTIME_ID_ = ss.getId();
  return ss;
}
function now_() { return Utilities.formatDate(new Date(), AMI_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), AMI_CONFIG.TIMEZONE, 'yyyy-MM-dd'); }
function uuid_(prefix) { return (prefix || 'ID') + '-' + Utilities.getUuid().replace(/-/g,'').substring(0,20).toUpperCase(); }
function cleanText_(v) { return String(v == null ? '' : v).trim(); }
function bool_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1'; }
function parseJson_(v, fallback) { try { return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; } }

function serializeValue_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, AMI_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  if (Array.isArray(v)) return v.map(serializeValue_);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach(k => o[k] = serializeValue_(v[k]));
    return o;
  }
  return v;
}
function cleanRow_(r) {
  const o = {};
  Object.keys(r || {}).forEach(k => { if (k !== '_row') o[k] = serializeValue_(r[k]); });
  return o;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  // V27 production: transaksi data tetap diserialkan untuk mencegah lost-update,
  // tetapi antrean diberi waktu sedikit lebih longgar dan pesan yang dapat ditindaklanjuti.
  // Login/session tidak menggunakan helper ini sehingga lonjakan login tidak ikut terblokir.
  const acquired = lock.tryLock(45000);
  if (!acquired) {
    throw new Error('Server AMI sedang memproses penyimpanan pengguna lain. Data yang masih tampil di form belum hilang; tunggu beberapa detik lalu klik Simpan kembali.');
  }
  try {
    // Bila eksekusi sempat membaca data sebelum menunggu lock (contoh upload bukti),
    // cache per-eksekusi dapat menjadi stale. Muat ulang keadaan database sesudah lock didapat.
    invalidateRowsCache_();
    return fn();
  } finally { try { lock.releaseLock(); } catch (ignore) {} }
}

/** Legacy setup hanya untuk editor Apps Script. Nama berakhiran _ mencegah pemanggilan via google.script.run. */
function setupDatabaseLegacy_() {
  resetDbRuntimeCache_();
  return forceSetupDatabase_();
}

function forceSetupDatabase_() {
  return withLock_(function() {
    let stage = 'KONEKSI DATABASE';
    try {
      const ss = openSpreadsheetByConfig_();
      PropertiesService.getScriptProperties().setProperty('AMI_DB_ID', ss.getId());

      stage = 'VALIDASI FILE KODE';
      if (typeof AMI_STANDARD_SEED === 'undefined' || !Array.isArray(AMI_STANDARD_SEED)) {
        throw new Error('StandarSeed.gs tidak terbaca atau AMI_STANDARD_SEED tidak tersedia. Pastikan StandarSeed.gs dari paket final sudah ditempel dan tidak bercampur dengan versi lama.');
      }
      const expected = Number(AMI_CONFIG.EXPECTED_STANDARD_SEED_COUNT || 0);
      if (expected && AMI_STANDARD_SEED.length !== expected) {
        throw new Error('Jumlah seed standar tidak sesuai. Diharapkan ' + expected + ' butir, terbaca ' + AMI_STANDARD_SEED.length + ' butir.');
      }
      if (typeof ensureDefaultAdmin_ !== 'function') {
        throw new Error('Auth.gs tidak terbaca atau fungsi ensureDefaultAdmin_() tidak tersedia.');
      }
      if (typeof migrateStandardVersionMetadata_ !== 'function' || typeof backfillAssignmentSnapshots_ !== 'function') {
        throw new Error('StandardService.gs tidak terbaca. Pastikan file StandardService.gs dari paket final sudah ditambahkan ke project Apps Script.');
      }

      stage = 'MEMBUAT/MIGRASI SHEET';
      Object.keys(SHEET_DEFS).forEach(function(name) {
        ensureSheet_(ss, name, SHEET_DEFS[name]);
      });

      stage = 'PENGATURAN AWAL';
      seedSettings_();

      stage = 'MASTER STANDAR';
      const standardSeed = syncStandardsFromSeed_();

      stage = 'VERSI MASTER STANDAR';
      const standardMigration = migrateStandardVersionMetadata_();

      stage = 'SNAPSHOT STANDAR HISTORIS';
      const snapshotMigration = backfillAssignmentSnapshots_();

      stage = 'REGISTER SUMBER';
      seedSourceRegister_();

      stage = 'AKUN ADMIN';
      const admin = ensureDefaultAdmin_();

      stage = 'VALIDASI HASIL SETUP';
      const validation = validateDatabaseStructure_(ss);
      if (!validation.ok) {
        throw new Error('Struktur database belum lengkap: ' + validation.errors.join(' | '));
      }

      PropertiesService.getScriptProperties().setProperty('AMI_SETUP_COMPLETE', 'true');
      PropertiesService.getScriptProperties().setProperty('AMI_SETUP_VERSION', AMI_CONFIG.VERSION);
      PropertiesService.getScriptProperties().setProperty('AMI_SETUP_LAST_OK_AT', now_());
      PropertiesService.getScriptProperties().deleteProperty('AMI_SETUP_LAST_ERROR');

      return serializeValue_({
        ok: true,
        message: 'Setup database berhasil.',
        databaseName: ss.getName(),
        databaseId: ss.getId(),
        databaseUrl: ss.getUrl(),
        standardSeed: standardSeed,
        standardMigration: standardMigration,
        snapshotMigration: snapshotMigration,
        defaultAdmin: admin,
        sheetCount: Object.keys(SHEET_DEFS).length,
        version: AMI_CONFIG.VERSION
      });
    } catch (e) {
      const msg = '[SETUP GAGAL — ' + stage + '] ' + (e && e.message ? e.message : String(e));
      try {
        PropertiesService.getScriptProperties().setProperty('AMI_SETUP_LAST_ERROR', msg);
      } catch (ignore) {}
      throw new Error(msg);
    }
  });
}

function ensureSheetCapacity_(sh, minRows, minCols) {
  minRows = Math.max(1, Number(minRows) || 1);
  minCols = Math.max(1, Number(minCols) || 1);
  if (sh.getMaxRows() < minRows) {
    sh.insertRowsAfter(sh.getMaxRows(), minRows - sh.getMaxRows());
  }
  if (sh.getMaxColumns() < minCols) {
    sh.insertColumnsAfter(sh.getMaxColumns(), minCols - sh.getMaxColumns());
  }
}

// Migrasi aman: data lama tidak dihapus, header yang kurang ditambahkan di kanan.
function ensureSheet_(ss, name, requiredHeaders) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  ensureSheetCapacity_(sh, 2, Math.max(1, requiredHeaders.length));

  const lastCol = Math.max(1, sh.getLastColumn());
  let current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(cleanText_);
  const isBlank = current.every(function(x) { return !x; });

  if (isBlank) {
    ensureSheetCapacity_(sh, 2, requiredHeaders.length);
    sh.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    current = requiredHeaders.slice();
  } else {
    requiredHeaders.forEach(function(h) {
      if (current.indexOf(h) < 0) {
        const targetCol = sh.getLastColumn() + 1;
        ensureSheetCapacity_(sh, 2, targetCol);
        sh.getRange(1, targetCol).setValue(h);
        current.push(h);
      }
    });
  }

  const finalLastCol = Math.max(1, sh.getLastColumn());
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, finalLastCol)
    .setFontWeight('bold')
    .setBackground('#173d6b')
    .setFontColor('#ffffff')
    .setWrap(true);

  AMI_SHEET_RUNTIME_CACHE_[name] = sh;
  delete AMI_HEADER_RUNTIME_CACHE_[name];
  invalidateRowsCache_(name);
  return sh;
}

function ensureSheetReady_(name,requiredHeaders) {
  var ss=db_(),sh=ss.getSheetByName(name);
  if(!sh)return ensureSheet_(ss,name,requiredHeaders||SHEET_DEFS[name]||[]);
  AMI_SHEET_RUNTIME_CACHE_[name]=sh;
  var required=requiredHeaders||SHEET_DEFS[name]||[];
  if(required.length){
    var current=headers_(name);
    var missing=required.some(function(h){return current.indexOf(h)<0;});
    if(missing)return ensureSheet_(ss,name,required);
  }
  return sh;
}

function sheet_(name) {
  if (AMI_SHEET_RUNTIME_CACHE_[name]) return AMI_SHEET_RUNTIME_CACHE_[name];

  const sh = db_().getSheetByName(name);
  if (!sh) throw new Error('Sheet ' + name + ' tidak ditemukan. Jalankan maintenanceUpgradeSchemaFinal_() sekali dari editor Apps Script.');

  AMI_SHEET_RUNTIME_CACHE_[name] = sh;
  return sh;
}

function headers_(name) {
  if (AMI_HEADER_RUNTIME_CACHE_[name]) {
    return AMI_HEADER_RUNTIME_CACHE_[name].slice();
  }

  const sh = sheet_(name);
  const h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn()))
    .getValues()[0]
    .map(cleanText_);

  AMI_HEADER_RUNTIME_CACHE_[name] = h;
  return h.slice();
}

function getAllRows_(name) {
  // Level 1: runtime cache dalam satu eksekusi.
  if (AMI_ROWS_RUNTIME_CACHE_[name]) {
    return AMI_ROWS_RUNTIME_CACHE_[name].map(function(r){return Object.assign({},r);});
  }
  // Level 2 V27: referensi kecil dapat dibaca dari ScriptCache untuk mengurangi
  // Spreadsheet RPC saat puluhan user bootstrap hampir bersamaan.
  if(AMI_SHARED_ROWS_CACHE_SHEETS_[name]){
    try{
      const raw=CacheService.getScriptCache().get(sharedRowsCacheKey_(name));
      if(raw){const cached=JSON.parse(raw);if(Array.isArray(cached)){AMI_ROWS_RUNTIME_CACHE_[name]=cached;return cached.map(function(r){return Object.assign({},r);});}}
    }catch(ignoreShared){}
  }
  const sh = sheet_(name);
  const h = headers_(name);
  const last = sh.getLastRow();
  if (last < 2) { AMI_ROWS_RUNTIME_CACHE_[name]=[]; return []; }
  const values = sh.getRange(2, 1, last - 1, h.length).getValues();
  const rows=values.map(function(row, i) {
    const o = {_row: i + 2};
    h.forEach(function(k, j) { if (k) o[k] = row[j]; });
    return o;
  });
  AMI_ROWS_RUNTIME_CACHE_[name]=rows;
  if(AMI_SHARED_ROWS_CACHE_SHEETS_[name]){
    try{const raw=JSON.stringify(rows);if(raw.length<95000)CacheService.getScriptCache().put(sharedRowsCacheKey_(name),raw,AMI_SHARED_ROWS_CACHE_TTL_);}catch(ignorePut){}
  }
  return rows.map(function(r){return Object.assign({},r);});
}
function appendObject_(name, obj) {
  const sh = sheet_(name), h = headers_(name);
  ensureSheetCapacity_(sh, sh.getLastRow() + 1, h.length);
  const rowNum=sh.getLastRow()+1;
  sh.getRange(rowNum, 1, 1, h.length).setValues([h.map(function(k) { return obj[k] == null ? '' : obj[k]; })]);
  invalidateRowsCache_(name);
  return rowNum;
}
function appendObjects_(name, objects) {
  if (!objects || !objects.length) return 0;
  const sh = sheet_(name), h = headers_(name), start = sh.getLastRow() + 1;
  ensureSheetCapacity_(sh, start + objects.length - 1, h.length);
  const values = objects.map(function(obj) { return h.map(function(k) { return obj[k] == null ? '' : obj[k]; }); });
  sh.getRange(start, 1, values.length, h.length).setValues(values);
  invalidateRowsCache_(name);
  return values.length;
}
function updateRow_(name, rowNum, patch) {
  const sh = sheet_(name), h = headers_(name), row = sh.getRange(rowNum, 1, 1, h.length).getValues()[0];
  h.forEach(function(k, i) { if (k && Object.prototype.hasOwnProperty.call(patch, k)) row[i] = patch[k]; });
  sh.getRange(rowNum, 1, 1, h.length).setValues([row]);
  invalidateRowsCache_(name);
}
function findOne_(name, key, value) { return getAllRows_(name).find(function(r) { return String(r[key]) === String(value); }) || null; }
function deleteRowsByPredicate_(name, predicate) {
  const rowNums=getAllRows_(name).filter(predicate).map(function(r){return Number(r._row);}).sort(function(a,b){return a-b;});
  if(!rowNums.length)return 0;
  const blocks=[];let start=rowNums[0],prev=rowNums[0];
  for(let i=1;i<rowNums.length;i++){
    const n=rowNums[i];
    if(n===prev+1){prev=n;continue;}
    blocks.push({start:start,count:prev-start+1});start=prev=n;
  }
  blocks.push({start:start,count:prev-start+1});
  const sh=sheet_(name);
  blocks.sort(function(a,b){return b.start-a.start;}).forEach(function(b){sh.deleteRows(b.start,b.count);});
  invalidateRowsCache_(name);
  return rowNums.length;
}
function deleteRowByKey_(name, key, value) { return deleteRowsByPredicate_(name, function(r) { return String(r[key]) === String(value); }); }

/** Tulis nilai literal agar persen, rasio, >=, dan simbol tidak dikonversi Sheets. */
function writePlainTextCell_(sheetName,rowNum,columnName,value){
  const sh=sheet_(sheetName),h=headers_(sheetName),idx=h.indexOf(columnName);
  if(idx<0)throw new Error('Kolom '+columnName+' tidak ditemukan pada '+sheetName+'.');
  const cell=sh.getRange(Number(rowNum),idx+1);
  cell.setNumberFormat('@');
  cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(String(value==null?'':value)).build());
  invalidateRowsCache_(sheetName);
}

/**
 * Batch upsert generik: satu pembacaan sheet, update per blok kontigu,
 * dan satu append untuk seluruh baris baru. Tidak menulis ulang baris lain.
 */
function batchUpsert_(sheetName,keyFields,records,textColumns){
  records=Array.isArray(records)?records:[];
  if(!records.length)return{count:0,inserted:0,updated:0};
  const sh=sheet_(sheetName),h=headers_(sheetName),last=sh.getLastRow();
  const values=last>=2?sh.getRange(2,1,last-1,h.length).getValues():[];
  const keyOf=function(obj){return keyFields.map(function(k){return cleanText_(obj[k]);}).join('||');};
  const objOf=function(row){const o={};h.forEach(function(k,i){if(k)o[k]=row[i];});return o;};
  const rowFrom=function(old,patch){const row=old?old.slice():new Array(h.length).fill('');h.forEach(function(k,i){if(k&&Object.prototype.hasOwnProperty.call(patch,k))row[i]=patch[k];});return row;};
  const existing={},newIndex={},changed={},newRows=[];
  values.forEach(function(row,i){existing[keyOf(objOf(row))]=i;});
  records.forEach(function(rec){
    const key=keyOf(rec);
    if(Object.prototype.hasOwnProperty.call(existing,key)){
      const i=existing[key];values[i]=rowFrom(values[i],rec);changed[i+2]=values[i];
    }else if(Object.prototype.hasOwnProperty.call(newIndex,key)){
      const ni=newIndex[key];newRows[ni]=rowFrom(newRows[ni],rec);
    }else{
      newIndex[key]=newRows.length;newRows.push(rowFrom(null,rec));
    }
  });
  const rows=Object.keys(changed).map(Number).sort(function(a,b){return a-b;}),blocks=[];
  if(rows.length){let st=rows[0],prev=rows[0],block=[changed[rows[0]]];for(let i=1;i<rows.length;i++){const rn=rows[i];if(rn===prev+1){block.push(changed[rn]);prev=rn;continue;}blocks.push({start:st,rows:block});st=prev=rn;block=[changed[rn]];}blocks.push({start:st,rows:block});}
  const textIdx=(textColumns||[]).map(function(c){return h.indexOf(c);}).filter(function(i){return i>=0;});
  blocks.forEach(function(b){
    textIdx.forEach(function(i){sh.getRange(b.start,i+1,b.rows.length,1).setNumberFormat('@');});
    sh.getRange(b.start,1,b.rows.length,h.length).setValues(b.rows);
  });
  if(newRows.length){
    const start=sh.getLastRow()+1;ensureSheetCapacity_(sh,start+newRows.length-1,h.length);
    textIdx.forEach(function(i){sh.getRange(start,i+1,newRows.length,1).setNumberFormat('@');});
    sh.getRange(start,1,newRows.length,h.length).setValues(newRows);
  }
  invalidateRowsCache_(sheetName);
  return{count:records.length,inserted:newRows.length,updated:rows.length};
}

function getSetting_(key, fallback) {
  const r = getAllRows_('SETTINGS').find(function(x) { return cleanText_(x.Key) === key; });
  return r ? cleanText_(r.Value) : fallback;
}
function setSetting_(key, value, desc, user) {
  const r = getAllRows_('SETTINGS').find(function(x) { return cleanText_(x.Key) === key; });
  const p = {Key:key, Value:value, Description:desc || (r ? r.Description : ''), UpdatedAt:now_(), UpdatedBy:user || 'SYSTEM'};
  if (r) updateRow_('SETTINGS', r._row, p); else appendObject_('SETTINGS', p);
}
function seedSettings_() {
  setSetting_('APP_NAME', AMI_CONFIG.APP_NAME, 'Nama aplikasi', 'SYSTEM');
  setSetting_('ORG_NAME', AMI_CONFIG.ORG_NAME, 'Institusi', 'SYSTEM');
  setSetting_('UNIT_NAME', AMI_CONFIG.UNIT_NAME, 'Pengelola sistem', 'SYSTEM');
  setSetting_('TIMEZONE', AMI_CONFIG.TIMEZONE, 'Zona waktu', 'SYSTEM');
  if (getSetting_('ACTIVE_CYCLE_ID', null) == null) setSetting_('ACTIVE_CYCLE_ID', '', 'Siklus AMI aktif', 'SYSTEM');
  if (getSetting_('ROOT_FOLDER_ID', null) == null) setSetting_('ROOT_FOLDER_ID', '', 'Folder utama AMI', 'SYSTEM');
  if (getSetting_('LOGO_FILE_ID', null) == null) setSetting_('LOGO_FILE_ID', '', 'Logo institusi', 'SYSTEM');
}

function syncStandardsFromSeed_() {
  const rows=getAllRows_('MASTER_STANDAR'),byHash={},byId={};
  rows.forEach(function(r){if(cleanText_(r.SourceHash))byHash[cleanText_(r.SourceHash)]=r;if(cleanText_(r.StandardID))byId[cleanText_(r.StandardID)]=r;});
  let inserted=0,patched=0,unchanged=0;const toAppend=[];
  AMI_STANDARD_SEED.forEach(function(s,idx){
    const sid=cleanText_(s.StandardID)||('STD-'+String(idx+1).padStart(4,'0'));
    const old=byHash[cleanText_(s.SourceHash)]||byId[sid];
    if(old){
      const patch={};
      if(!cleanText_(old.StandardFamilyID))patch.StandardFamilyID='STDFAM-'+cleanText_(old.StandardID||sid);
      if(!cleanText_(old.Versi))patch.Versi='1.0';
      if(!cleanText_(old.TahunBerlakuMulai))patch.TahunBerlakuMulai=cleanText_(old.TahunSumber||s.TahunSumber);
      if(!cleanText_(old.StatusStandar))patch.StatusStandar='BERLAKU';
      if(!cleanText_(old.Origin))patch.Origin='SEED';
      if(!cleanText_(old.CreatedBy))patch.CreatedBy='SYSTEM SEED';
      if(Object.keys(patch).length){patch.UpdatedAt=now_();patch.UpdatedBy='SYSTEM SEED';updateRow_('MASTER_STANDAR',old._row,patch);patched++;}else unchanged++;
      return;
    }
    const rec=Object.assign({},s,{StandardID:sid,StandardFamilyID:'STDFAM-'+sid,Versi:'1.0',TahunBerlakuMulai:cleanText_(s.TahunSumber),TahunBerlakuSampai:'',StatusStandar:'BERLAKU',ReplacesStandardID:'',Origin:'SEED',Locked:false,Notes:'',Active:true,CreatedAt:now_(),UpdatedAt:now_(),CreatedBy:'SYSTEM SEED',UpdatedBy:'SYSTEM SEED'});
    toAppend.push(rec);inserted++;
  });
  appendObjects_('MASTER_STANDAR',toAppend);
  return{inserted:inserted,patched:patched,unchanged:unchanged,totalSeed:AMI_STANDARD_SEED.length};
}

function seedSourceRegister_() {
  const grouped = {};
  AMI_STANDARD_SEED.forEach(function(s) {
    const k = s.Kelompok + '|' + s.SumberFile + '|' + s.TahunSumber;
    grouped[k] = (grouped[k] || 0) + 1;
  });
  const existing = {};
  getAllRows_('SOURCE_REGISTER').forEach(function(r) { existing[cleanText_(r.SourceID)] = r; });
  const toAppend = [];
  Object.keys(grouped).forEach(function(k, i) {
    const p = k.split('|'), id = 'SRC-' + String(i + 1).padStart(2,'0'), old = existing[id];
    const rec = {SourceID:id, Kelompok:p[0], NamaFile:p[1], Tahun:p[2], JumlahButir:grouped[k], CatatanVerifikasi:'Sumber MASTER_STANDAR. Perubahan substantif harus diverifikasi terhadap PDF sumber.'};
    if (old) updateRow_('SOURCE_REGISTER', old._row, rec); else toAppend.push(rec);
  });
  appendObjects_('SOURCE_REGISTER', toAppend);
}

function validateDatabaseStructure_(ss) {
  const errors = [];
  Object.keys(SHEET_DEFS).forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) { errors.push('Sheet ' + name + ' tidak ada'); return; }
    const current = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(cleanText_);
    const missing = SHEET_DEFS[name].filter(function(h) { return current.indexOf(h) < 0; });
    if (missing.length) errors.push(name + ' kurang header: ' + missing.join(', '));
  });
  const standards = ss.getSheetByName('MASTER_STANDAR');
  if (standards && Math.max(0, standards.getLastRow() - 1) < Number(AMI_CONFIG.EXPECTED_STANDARD_SEED_COUNT || 130)) {
    errors.push('MASTER_STANDAR kurang dari ' + Number(AMI_CONFIG.EXPECTED_STANDARD_SEED_COUNT || 130) + ' butir');
  }
  return {ok: errors.length === 0, errors: errors};
}

// Jalankan dari editor Apps Script bila setup masih gagal. Karena nama diakhiri _, fungsi ini tidak diekspos ke google.script.run.
function maintenanceSetupDiagnostics_() {
  const out = {version:AMI_CONFIG.VERSION, configuredId:AMI_CONFIG.DB_SPREADSHEET_ID || '', savedId:PropertiesService.getScriptProperties().getProperty('AMI_DB_ID') || '', checks:[]};
  try {
    const ss = openSpreadsheetByConfig_();
    out.databaseName = ss.getName(); out.databaseId = ss.getId(); out.databaseUrl = ss.getUrl();
    out.checks.push({name:'Koneksi database',ok:true,detail:ss.getName()});
  } catch (e) { out.checks.push({name:'Koneksi database',ok:false,detail:e.message}); return out; }
  out.checks.push({name:'StandarSeed.gs',ok:typeof AMI_STANDARD_SEED !== 'undefined' && Array.isArray(AMI_STANDARD_SEED),detail:typeof AMI_STANDARD_SEED === 'undefined'?'Tidak terbaca':String(AMI_STANDARD_SEED.length)+' butir'});
  out.checks.push({name:'Auth.gs',ok:typeof ensureDefaultAdmin_ === 'function',detail:typeof ensureDefaultAdmin_ === 'function'?'OK':'ensureDefaultAdmin_ tidak ditemukan'});
  out.checks.push({name:'StandardService.gs',ok:typeof migrateStandardVersionMetadata_ === 'function'&&typeof backfillAssignmentSnapshots_ === 'function',detail:typeof migrateStandardVersionMetadata_ === 'function'?'OK':'File/fungsi manajemen standar tidak ditemukan'});
  out.lastSetupError = PropertiesService.getScriptProperties().getProperty('AMI_SETUP_LAST_ERROR') || '';
  return serializeValue_(out);
}

function getDatabaseHealth(token) {
  requireRole_(token, ['ADMIN_BPM']);
  const ss = db_(), checks = Object.keys(SHEET_DEFS).map(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return {name:name, ok:false, rows:0, missing:SHEET_DEFS[name]};
    const current = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(cleanText_);
    const missing = SHEET_DEFS[name].filter(function(h) { return current.indexOf(h) < 0; });
    return {name:name, ok:missing.length===0, rows:Math.max(0,sh.getLastRow()-1), missing:missing};
  });
  return serializeValue_({ok:checks.every(function(x){return x.ok;}), spreadsheetName:ss.getName(), spreadsheetUrl:ss.getUrl(), spreadsheetId:ss.getId(), checks:checks});
}

/** Export snapshot lengkap untuk migrasi satu kali ke PostgreSQL lokal. Jalankan dari editor Apps Script. */
function exportDatabaseSnapshotToDrive_() {
  const ss = db_(), snapshot = {
    exportedAt: now_(),
    version: AMI_CONFIG.VERSION,
    sourceSpreadsheetId: ss.getId(),
    sourceSpreadsheetName: ss.getName(),
    tables: {}
  };
  Object.keys(SHEET_DEFS).forEach(function(name) {
    snapshot.tables[name] = {
      columns: SHEET_DEFS[name].slice(),
      rows: getAllRows_(name).map(cleanRow_)
    };
  });
  const fileName = 'AMI_POSTGRES_SNAPSHOT_' + Utilities.formatDate(new Date(), AMI_CONFIG.TIMEZONE, 'yyyyMMdd_HHmmss') + '.json';
  const file = DriveApp.createFile(fileName, JSON.stringify(snapshot), MimeType.PLAIN_TEXT);
  return {ok:true, fileId:file.getId(), fileName:file.getName(), fileUrl:file.getUrl(), tableCount:Object.keys(snapshot.tables).length};
}
