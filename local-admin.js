const crypto = require('node:crypto');

const clean = value => String(value == null ? '' : value).trim();
const upper = value => clean(value).toUpperCase();
const truthy = value => value === true || ['true', '1', 'yes', 'iya', 'aktif'].includes(clean(value).toLowerCase());
const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
const table = (schema, name) => `${quote(schema)}.${quote(name)}`;
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const hashPassword = (password, salt) => crypto.createHash('sha256').update(`${salt}|${password}`, 'utf8').digest('hex');
const randomSalt = () => crypto.randomBytes(24).toString('hex');
const norm = value => upper(value).replace(/[^A-Z0-9]/g, '');

function requireAdmin(user) {
  if (!user || upper(user.Role) !== 'ADMIN_BPM') {
    const error = new Error('Hanya Admin BPM yang dapat melakukan perubahan ini.');
    error.status = 403;
    throw error;
  }
}

async function inTransaction(pool, work, maybeWork) {
  if (typeof work !== 'function') work = maybeWork;
  if (!pool.connect) return work(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* preserve original error */ }
    throw error;
  } finally { client.release(); }
}

async function all(db, schema, name) { return (await db.query(`SELECT * FROM ${table(schema, name)}`)).rows; }
async function one(db, schema, name, key, value) {
  return (await db.query(`SELECT * FROM ${table(schema, name)} WHERE ${quote(key)} = $1 LIMIT 1`, [value])).rows[0] || null;
}
async function insert(db, schema, name, record) {
  const fields = Object.keys(record);
  await db.query(`INSERT INTO ${table(schema, name)} (${fields.map(quote).join(',')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(',')})`, fields.map(field => record[field]));
}
async function update(db, schema, name, key, keyValue, patch) {
  const fields = Object.keys(patch);
  if (!fields.length) return;
  await db.query(`UPDATE ${table(schema, name)} SET ${fields.map((field, i) => `${quote(field)} = $${i + 1}`).join(', ')} WHERE ${quote(key)} = $${fields.length + 1}`, [...fields.map(field => patch[field]), keyValue]);
}
async function remove(db, schema, name, key, value) {
  await db.query(`DELETE FROM ${table(schema, name)} WHERE ${quote(key)} = $1`, [value]);
}
async function audit(db, schema, user, action, module, recordId, before, after) {
  await insert(db, schema, 'AUDIT_LOG', {LogID:id('LOG'), Timestamp:now(), UserID:user.UserID || '', Nama:user.Nama || '', Role:user.Role || '', Action:action, Module:module, AuditID:'', RecordID:recordId || '', BeforeJSON:JSON.stringify(before || {}), AfterJSON:JSON.stringify(after || {})});
}
function fieldsFrom(record, fields) { return Object.fromEntries(fields.map(field => [field, clean(record[field])])); }

const masterDefs = {
  PRODI: {table:'MASTER_PRODI', key:'ProdiID', prefix:'PRODI', fields:['KodeProdi','NamaProdi','Fakultas','Jenjang','Kaprodi','NIDN']},
  UNIT: {table:'MASTER_UNIT', key:'UnitID', prefix:'UNIT', fields:['KodeUnit','NamaUnit','JenisUnit','Pimpinan']},
  AUDITOR: {table:'MASTER_AUDITOR', key:'AuditorID', prefix:'AUD', fields:['NIDN_NIK','Nama','Unit','Sertifikasi']},
  PIMPINAN: {table:'MASTER_PIMPINAN', key:'PimpinanID', prefix:'PIM', fields:['Nama','Jabatan','Level','UnitID','AccessType','AccessID','AccessName']}
};

async function saveMaster(pool, schema, user, type, input) {
  requireAdmin(user); const def = masterDefs[upper(type)]; if (!def) throw new Error('Jenis master tidak dikenali.');
  return inTransaction(pool, async db => {
    input = input || {}; let keyValue = clean(input[def.key]);
    let old = keyValue ? await one(db, schema, def.table, def.key, keyValue) : null;
    if (def.table === 'MASTER_AUDITOR' && !old) {
      const existing = await all(db, schema, def.table);
      old = existing.find(row => (clean(input.NIDN_NIK) && norm(row.NIDN_NIK) === norm(input.NIDN_NIK)) || (!clean(input.NIDN_NIK) && norm(row.Nama) === norm(input.Nama) && norm(row.Unit) === norm(input.Unit))) || null;
      if (old) keyValue = old[def.key];
    }
    keyValue = keyValue || id(def.prefix);
    const stamp = now();
    const record = {...fieldsFrom(input, def.fields), [def.key]:keyValue, Active: input.Active === false ? 'false' : 'true', UpdatedAt:stamp};
    if (old) { await update(db, schema, def.table, def.key, old[def.key], record); }
    else { await insert(db, schema, def.table, {...record, CreatedAt:stamp}); }
    await audit(db, schema, user, 'SAVE_MASTER', def.table, keyValue, old, record);
    return {ok:true, id:keyValue, updatedExisting:!!old};
  });
}

async function bulkImportMaster(pool, schema, user, type, rawText) {
  requireAdmin(user); const key = upper(type); if (!masterDefs[key]) throw new Error('Jenis master tidak dikenali.');
  return inTransaction(pool, async db => {
    let inserted = 0, updated = 0, skipped = 0;
    const lines = String(rawText || '').split(/\r?\n/).filter(line => clean(line));
    for (const line of lines) {
      const c = line.split('\t');
      try {
        let record;
        if (key === 'PRODI') { if (!clean(c[1])) throw new Error('Nama Prodi wajib diisi.'); record = {KodeProdi:c[0],NamaProdi:c[1],Fakultas:c[2],Jenjang:c[3],Kaprodi:c[4],NIDN:c[5]}; }
        if (key === 'UNIT') { if (!clean(c[1])) throw new Error('Nama Unit wajib diisi.'); record = {KodeUnit:c[0],NamaUnit:c[1],JenisUnit:c[2],Pimpinan:c[3]}; }
        if (key === 'AUDITOR') { if (!clean(c[1])) throw new Error('Nama Auditor wajib diisi.'); record = {NIDN_NIK:c[0],Nama:c[1],Unit:c[2],Sertifikasi:c[3]}; }
        if (key === 'PIMPINAN') { if (!clean(c[0])) throw new Error('Nama Pimpinan wajib diisi.'); record = {Nama:c[0],Jabatan:c[1],Level:c[2],AccessID:c[3],AccessName:c[3],AccessType:c[2]}; }
        const def = masterDefs[key]; const existing = (await all(db, schema, def.table)).find(row => key === 'PRODI' ? (norm(row.KodeProdi) === norm(record.KodeProdi) || norm(row.NamaProdi) === norm(record.NamaProdi)) : key === 'UNIT' ? (norm(row.KodeUnit) === norm(record.KodeUnit) || norm(row.NamaUnit) === norm(record.NamaUnit)) : key === 'AUDITOR' ? (norm(row.NIDN_NIK) === norm(record.NIDN_NIK) || (norm(row.Nama) === norm(record.Nama) && norm(row.Unit) === norm(record.Unit))) : (norm(row.Nama) === norm(record.Nama) && norm(row.Jabatan) === norm(record.Jabatan)));
        const result = await saveMaster(db, schema, user, key, {...record, [def.key]:existing ? existing[def.key] : ''});
        result.updatedExisting ? updated++ : inserted++;
      } catch (_) { skipped++; }
    }
    return {inserted, updated, skipped};
  });
}

async function saveCycle(pool, schema, user, input) {
  requireAdmin(user); return inTransaction(pool, async db => {
    input = input || {}; const cycleId = clean(input.CycleID) || id('CYCLE'); const old = clean(input.CycleID) ? await one(db, schema, 'AMI_CYCLE', 'CycleID', cycleId) : null; const stamp = now();
    const record = {CycleID:cycleId,NamaSiklus:clean(input.NamaSiklus) || `AMI Tahun ${clean(input.Tahun)}`,Tahun:clean(input.Tahun),TahunAkademik:clean(input.TahunAkademik),TanggalMulai:clean(input.TanggalMulai),BatasEvaluasiDiri:clean(input.BatasEvaluasiDiri),DeskStart:clean(input.DeskStart),DeskEnd:clean(input.DeskEnd),VisitStart:clean(input.VisitStart),VisitEnd:clean(input.VisitEnd),Status:clean(input.Status) || 'DRAFT BPM',Active:input.Active === false ? 'false' : 'true',CreatedAt:old ? old.CreatedAt : stamp,CreatedBy:old ? old.CreatedBy : user.Nama};
    if (old) await update(db, schema, 'AMI_CYCLE', 'CycleID', cycleId, record); else await insert(db, schema, 'AMI_CYCLE', record);
    if (record.Status === 'AKTIF') await setActive(db, schema, user, cycleId);
    await audit(db, schema, user, 'SAVE_CYCLE', 'AMI_CYCLE', cycleId, old, record); return {ok:true, cycleId};
  });
}
async function setActive(db, schema, user, cycleId) {
  const target = await one(db, schema, 'AMI_CYCLE', 'CycleID', cycleId); if (!target) throw new Error('Siklus tidak ditemukan.');
  const cycles = await all(db, schema, 'AMI_CYCLE'); for (const cycle of cycles) await update(db, schema, 'AMI_CYCLE', 'CycleID', cycle.CycleID, {Active:clean(cycle.CycleID) === cycleId ? 'true' : 'false', Status:clean(cycle.CycleID) === cycleId ? 'AKTIF' : (clean(cycle.Status) === 'AKTIF' ? 'DRAFT BPM' : cycle.Status)});
  await updateSetting(db, schema, 'ACTIVE_CYCLE_ID', cycleId, user.Nama);
}
async function setActiveCycle(pool, schema, user, cycleId) { requireAdmin(user); return inTransaction(pool, async db => { await setActive(db, schema, user, clean(cycleId)); await audit(db, schema, user, 'SET_ACTIVE_CYCLE', 'AMI_CYCLE', cycleId, {}, {Active:true}); return {ok:true}; }); }
async function updateSetting(db, schema, key, value, user) {
  const existing = await one(db, schema, 'SETTINGS', 'Key', key); const record = {Key:key,Value:value,Description:'Siklus AMI aktif',UpdatedAt:now(),UpdatedBy:user};
  if (existing) await update(db, schema, 'SETTINGS', 'Key', key, record); else await insert(db, schema, 'SETTINGS', record);
}

const standardContentFields = ['ItemCode','Kelompok','KodeKelompokStandar','NamaStandar','NoSumber','PernyataanStandar','StrategiPencapaian','Indikator','SumberFile','TahunSumber','HalamanPDFMulai','HalamanPDFAkhir'];
function standardHash(record) { return crypto.createHash('sha256').update(standardContentFields.map(field => clean(record[field])).join('\u241f'), 'utf8').digest('hex').slice(0, 32); }
function normalizeStandard(input, old) {
  const record = fieldsFrom(input, standardContentFields); if (!record.ItemCode) throw new Error('Kode Butir/ItemCode wajib diisi.'); if (!record.NamaStandar) throw new Error('Nama Standar wajib diisi.'); if (!record.PernyataanStandar) throw new Error('Pernyataan Standar wajib diisi.'); if (!record.Indikator) throw new Error('Indikator wajib diisi.');
  record.StandardFamilyID = clean(input.StandardFamilyID) || clean(old && old.StandardFamilyID) || id('STDFAM'); record.Versi = clean(input.Versi) || clean(old && old.Versi) || '1.0'; record.TahunBerlakuMulai = clean(input.TahunBerlakuMulai) || clean(old && old.TahunBerlakuMulai) || record.TahunSumber; record.TahunBerlakuSampai = clean(input.TahunBerlakuSampai); record.StatusStandar = ['DRAFT','BERLAKU','DICABUT','ARSIP'].includes(upper(input.StatusStandar || (old && old.StatusStandar))) ? upper(input.StatusStandar || old.StatusStandar) : 'DRAFT'; if (record.StatusStandar === 'BERLAKU' && !record.TahunBerlakuMulai) throw new Error('Tahun Berlaku Mulai wajib diisi untuk standar berstatus BERLAKU.'); record.ReplacesStandardID = clean(input.ReplacesStandardID) || clean(old && old.ReplacesStandardID); record.Origin = clean(input.Origin) || clean(old && old.Origin) || 'MANUAL'; record.Notes = clean(input.Notes); record.Active = record.StatusStandar === 'BERLAKU' ? 'true' : 'false'; record.SourceHash = standardHash(record); return record;
}
async function standardUsage(db, schema, standardId) { return (await db.query(`SELECT COUNT(*)::int AS count FROM ${table(schema, 'AMI_STANDARD_ASSIGN')} WHERE ${quote('StandardID')} = $1 AND ${quote('Active')} IN ('true','1','IYA')`, [standardId])).rows[0].count; }
function standardSnapshot(standard) { return {KelompokSnapshot:clean(standard.Kelompok),KodeKelompokSnapshot:clean(standard.KodeKelompokStandar),PernyataanStandarSnapshot:clean(standard.PernyataanStandar),StrategiSnapshot:clean(standard.StrategiPencapaian),IndikatorSnapshot:clean(standard.Indikator),SumberFileSnapshot:clean(standard.SumberFile),TahunSumberSnapshot:clean(standard.TahunSumber),SourceHashSnapshot:clean(standard.SourceHash),VersiStandarSnapshot:clean(standard.Versi) || '1.0',TahunBerlakuSnapshot:clean(standard.TahunBerlakuMulai)}; }

async function saveStandard(pool, schema, user, input) { requireAdmin(user); return inTransaction(pool, async db => { input=input||{}; const sid=clean(input.StandardID); const old=sid ? await one(db,schema,'MASTER_STANDAR','StandardID',sid) : null; const used=old ? await standardUsage(db,schema,sid) : 0; const record=normalizeStandard(input,old); if(old && used && standardContentFields.some(field => clean(old[field]) !== clean(record[field]))) throw new Error('Standar ini sudah digunakan pada audit dan substansinya terkunci. Gunakan Buat Versi Baru.'); record.StandardID=sid || id('STD'); record.Locked=used ? 'true' : 'false'; record.CreatedAt=old ? old.CreatedAt : now(); record.CreatedBy=old ? old.CreatedBy : user.Nama; record.UpdatedAt=now(); record.UpdatedBy=user.Nama; const duplicate=(await all(db,schema,'MASTER_STANDAR')).find(row=>row.StandardID !== record.StandardID && norm(row.ItemCode)===norm(record.ItemCode) && norm(row.Versi || '1.0')===norm(record.Versi || '1.0')); if(duplicate) throw new Error(`Kode ${record.ItemCode} versi ${record.Versi} sudah ada.`); if(old) await update(db,schema,'MASTER_STANDAR','StandardID',sid,record); else await insert(db,schema,'MASTER_STANDAR',record); if(record.StatusStandar==='BERLAKU' && record.ReplacesStandardID && Number(record.TahunBerlakuMulai)){const previous=await one(db,schema,'MASTER_STANDAR','StandardID',record.ReplacesStandardID); if(previous && (!clean(previous.TahunBerlakuSampai || '') || Number(previous.TahunBerlakuSampai) >= Number(record.TahunBerlakuMulai))) await update(db,schema,'MASTER_STANDAR','StandardID',previous.StandardID,{TahunBerlakuSampai:String(Number(record.TahunBerlakuMulai)-1),UpdatedAt:now(),UpdatedBy:user.Nama});} await audit(db,schema,user,old?'EDIT_STANDARD':'ADD_STANDARD','MASTER_STANDAR',record.StandardID,old,record); return {ok:true,id:record.StandardID,locked:!!used}; }); }

async function createStandardVersion(pool, schema, user, standardId) { requireAdmin(user); return inTransaction(pool, async db => { const old=await one(db,schema,'MASTER_STANDAR','StandardID',standardId); if(!old) throw new Error('Standar tidak ditemukan.'); const versions=(await all(db,schema,'MASTER_STANDAR')).filter(row=>clean(row.StandardFamilyID || `STDFAM-${row.StandardID}`)===clean(old.StandardFamilyID || `STDFAM-${old.StandardID}`)).map(row=>Number.parseFloat(clean(row.Versi))||0); const record={}; for(const field of standardContentFields) record[field]=clean(old[field]); record.StandardID=id('STD'); record.StandardFamilyID=clean(old.StandardFamilyID)||`STDFAM-${old.StandardID}`; record.Versi=`${Math.floor(versions.length ? Math.max(...versions) : 0) + 1}.0`; record.TahunBerlakuMulai=''; record.TahunBerlakuSampai=''; record.StatusStandar='DRAFT'; record.ReplacesStandardID=old.StandardID; record.Origin='VERSION'; record.Locked='false'; record.Active='false'; record.Notes=`Versi baru dari ${old.ItemCode} v${old.Versi || '1.0'}`; record.SourceHash=standardHash(record); record.CreatedAt=now(); record.CreatedBy=user.Nama; record.UpdatedAt=record.CreatedAt; record.UpdatedBy=user.Nama; await insert(db,schema,'MASTER_STANDAR',record); await audit(db,schema,user,'CREATE_STANDARD_VERSION','MASTER_STANDAR',record.StandardID,old,record); return {ok:true,standard:record}; }); }
async function deleteStandardDraft(pool,schema,user,standardId) { requireAdmin(user); return inTransaction(pool,async db=>{const row=await one(db,schema,'MASTER_STANDAR','StandardID',standardId); if(!row) throw new Error('Standar tidak ditemukan.'); if(await standardUsage(db,schema,standardId)) throw new Error('Standar sudah digunakan pada audit dan tidak dapat dihapus.'); if(upper(row.StatusStandar)!=='DRAFT') throw new Error('Hanya standar DRAFT yang belum pernah digunakan yang dapat dihapus permanen.'); await remove(db,schema,'MASTER_STANDAR','StandardID',standardId); await audit(db,schema,user,'DELETE_STANDARD_DRAFT','MASTER_STANDAR',standardId,row,{}); return {ok:true};}); }

async function bulkImportStandards(pool,schema,user,rawText) { requireAdmin(user); return inTransaction(pool,async db=>{const result={inserted:0,updated:0,skipped:0,errors:[]}; const seen=new Set(); for(const [index,line] of String(rawText||'').split(/\r?\n/).filter(clean).entries()){try{const c=line.split('\t'), code=clean(c[0]), version=clean(c[9])||'1.0', key=`${norm(code)}|${norm(version)}`; if(!code) throw new Error('Kode Butir kosong.'); if(seen.has(key)) throw new Error('ItemCode + Versi duplikat pada input yang sama.'); seen.add(key); const existing=(await all(db,schema,'MASTER_STANDAR')).find(row=>norm(row.ItemCode)===norm(code)&&norm(row.Versi||'1.0')===norm(version)); const input={StandardID:existing && existing.StandardID,StandardFamilyID:existing && existing.StandardFamilyID,ItemCode:code,Kelompok:c[1],KodeKelompokStandar:c[2],NamaStandar:c[3],NoSumber:c[4],PernyataanStandar:c[5],StrategiPencapaian:c[6],Indikator:c[7],TahunBerlakuMulai:c[8],Versi:version,StatusStandar:c[10]||'DRAFT',SumberFile:c[11],TahunSumber:c[12],HalamanPDFMulai:c[13],HalamanPDFAkhir:c[14],Notes:c[15]}; const saved=await saveStandard(db,schema,user,input); saved.updatedExisting ? result.updated++ : result.inserted++;}catch(error){result.skipped++;if(result.errors.length<20)result.errors.push(`Baris ${index+1}: ${error.message}`);}} return result;}); }

async function createAuditiFromMaster(pool,schema,user,cycleId,target) { requireAdmin(user); return inTransaction(pool,async db=>{if(!await one(db,schema,'AMI_CYCLE','CycleID',cycleId)) throw new Error('Siklus tidak ditemukan.'); target=target||{}; let source=[]; if(target.mode==='ALL_PRODI' || target.mode==='JENJANG'){source=(await all(db,schema,'MASTER_PRODI')).filter(row=>truthy(row.Active)&& (target.mode==='ALL_PRODI'||clean(row.Jenjang)===clean(target.jenjang))).map(row=>({type:'PRODI',id:row.ProdiID,name:row.NamaProdi,fak:row.Fakultas,jenjang:row.Jenjang}));}else if(target.mode==='UNIT_IDS'){const ids=new Set((target.ids||[]).map(clean));source=(await all(db,schema,'MASTER_UNIT')).filter(row=>ids.has(clean(row.UnitID))).map(row=>({type:'UNIT',id:row.UnitID,name:row.NamaUnit,fak:'',jenjang:''}));}else throw new Error('Target auditi tidak dikenali.'); const current=await all(db,schema,'AMI_AUDITI'),keys=new Set(current.map(row=>`${clean(row.CycleID)}|${clean(row.AuditiType)}|${clean(row.AuditiID)}`));let inserted=0,skipped=0;for(const item of source){const key=`${cycleId}|${item.type}|${item.id}`;if(keys.has(key)){skipped++;continue;}keys.add(key);await insert(db,schema,'AMI_AUDITI',{AuditID:id('AUDIT'),CycleID:cycleId,AuditiType:item.type,AuditiID:item.id,AuditiName:item.name,Fakultas:item.fak,Jenjang:item.jenjang,Status:'DRAFT BPM',PublishedAt:'',CreatedAt:now(),CreatedBy:user.Nama});inserted++;}await audit(db,schema,user,'CREATE_AUDITI','AMI_AUDITI','',{target,inserted,skipped});return {inserted,skipped};}); }

async function assignmentStarted(db,schema,auditId) { const names=['SELF_EVAL','EVIDENCE','DESK_EVAL','FINDINGS','VISIT','FORM2_PROGRAM_KERJA','FORM3_CATATAN','APPROVAL','REPORT_LOG']; for(const name of names){const result=await db.query(`SELECT COUNT(*)::int AS count FROM ${table(schema,name)} WHERE ${quote('AuditID')} = $1`,[auditId]);if(Number(result.rows[0].count)>0)return true;} return false; }
async function reopenAuditAssignment(pool,schema,user,auditId){requireAdmin(user);return inTransaction(pool,schema,async db=>{const auditRow=await one(db,schema,'AMI_AUDITI','AuditID',auditId);if(!auditRow)throw new Error('Auditi tidak ditemukan.');if(upper(auditRow.Status)==='DRAFT BPM')return {ok:true,alreadyDraft:true};if(upper(auditRow.Status)!=='PENUGASAN DITERBITKAN')throw new Error('Penetapan hanya dapat dibuka kembali saat status PENUGASAN DITERBITKAN.');if(await assignmentStarted(db,schema,auditId))throw new Error('Proses audit sudah mulai diisi sehingga penetapan tidak dapat dibuka kembali.');for(const name of ['SELF_EVAL','APPROVAL']) await db.query(`DELETE FROM ${table(schema,name)} WHERE ${quote('AuditID')} = $1`,[auditId]);await update(db,schema,'AMI_AUDITI','AuditID',auditId,{Status:'DRAFT BPM',PublishedAt:''});await audit(db,schema,user,'REOPEN_ASSIGNMENT','AMI_AUDITI',auditId,auditRow,{Status:'DRAFT BPM'});return {ok:true,auditId,status:'DRAFT BPM'};});}

async function assignStandards(pool,schema,user,auditIds,standardIds,replaceExisting){requireAdmin(user);return inTransaction(pool,schema,async db=>{auditIds=(auditIds||[]).map(clean);standardIds=(standardIds||[]).map(clean);if(!auditIds.length)throw new Error('Pilih minimal satu auditi.');if(!standardIds.length)throw new Error('Pilih minimal satu standar/indikator.');const audits=await all(db,schema,'AMI_AUDITI'),standards=await all(db,schema,'MASTER_STANDAR'),cycles=await all(db,schema,'AMI_CYCLE');const auditMap=new Map(audits.map(row=>[clean(row.AuditID),row])),stdMap=new Map(standards.map(row=>[clean(row.StandardID),row])),cycleMap=new Map(cycles.map(row=>[clean(row.CycleID),row]));for(const auditId of auditIds){const auditRow=auditMap.get(auditId);if(!auditRow)throw new Error('Auditi tidak ditemukan.');if(upper(auditRow.Status)!=='DRAFT BPM')throw new Error(`${auditRow.AuditiName}: penetapan terkunci.`);if(replaceExisting&&await assignmentStarted(db,schema,auditId))throw new Error(`${auditRow.AuditiName}: data audit sudah mulai diisi.`);}if(replaceExisting){for(const auditId of auditIds){await db.query(`DELETE FROM ${table(schema,'AMI_STANDARD_ASSIGN')} WHERE ${quote('AuditID')} = $1`,[auditId]);await db.query(`DELETE FROM ${table(schema,'SELF_EVAL')} WHERE ${quote('AuditID')} = $1`,[auditId]);}}const existingRows=await all(db,schema,'AMI_STANDARD_ASSIGN'),existing=new Set(existingRows.filter(row=>truthy(row.Active)).map(row=>`${clean(row.AuditID)}|${clean(row.StandardID)}`));let inserted=0,skipped=0;for(const auditId of auditIds){const cycle=cycleMap.get(auditMap.get(auditId).CycleID)||{},year=Number(cycle.Tahun)||0;for(const standardId of standardIds){const standard=stdMap.get(standardId);if(!standard)throw new Error(`Standar ${standardId} tidak ditemukan.`);if(!(truthy(standard.Active)&&(upper(standard.StatusStandar)==='BERLAKU'||!clean(standard.StatusStandar))))throw new Error(`${standard.ItemCode || standardId}: standar belum berstatus BERLAKU.`);const start=Number(standard.TahunBerlakuMulai)||0,end=Number(standard.TahunBerlakuSampai)||0;if(year&&((start&&year<start)||(end&&year>end)))throw new Error(`${standard.ItemCode || standardId}: standar tidak berlaku untuk tahun siklus ${year}.`);const key=`${auditId}|${standardId}`;if(existing.has(key)){skipped++;continue;}await insert(db,schema,'AMI_STANDARD_ASSIGN',{AssignID:id('ASN'),AuditID:auditId,StandardID:standardId,ItemCode:standard.ItemCode,NamaStandar:standard.NamaStandar,AssignedAt:now(),AssignedBy:user.Nama,Active:'true',...standardSnapshot(standard)});existing.add(key);inserted++;await update(db,schema,'MASTER_STANDAR','StandardID',standardId,{Locked:'true',UpdatedAt:now(),UpdatedBy:user.Nama});}}await audit(db,schema,user,'ASSIGN_STANDARDS','AMI_STANDARD_ASSIGN','',{auditIds,standardIds,replaceExisting,inserted});return {inserted,skipped,removed:replaceExisting ? existingRows.filter(row=>auditIds.includes(clean(row.AuditID))).length : 0};});}

function desiredUsername(row, type, masters) { const compact = value => norm(value).toLowerCase().slice(0, 28); if(type==='AUDITOR') return compact(row.NIDN_NIK || `auditor.${row.AuditorID.slice(-6)}`); if(type==='PRODI') return compact(row.KodeProdi || `prodi.${row.ProdiID.slice(-6)}`); if(type==='UNIT') return compact(row.KodeUnit || `unit.${row.UnitID.slice(-6)}`); const level=upper(row.Level), area=compact(row.AccessName || row.AccessID || row.UnitID); if(level==='UNIVERSITAS' && /rektor/i.test(row.Jabatan)) return /wakil/i.test(row.Jabatan) ? `wakilrektor${area || 'uma'}` : 'rektoruma'; return `pimpinan${area || compact(row.Jabatan) || 'uma'}`; }
async function syncUsersFromMasters(pool,schema,user){requireAdmin(user);return inTransaction(pool,schema,async db=>{const users=await all(db,schema,'USERS'),byRef=new Map(users.filter(row=>row.RefType&&row.RefID).map(row=>[`${row.RefType}|${row.RefID}`,row])),created=[],renamed=[];const used=new Set(users.map(row=>norm(row.Username).toLowerCase()));const ensure=async(type,refId,name,base,role)=>{if(!refId)return;const old=byRef.get(`${type}|${refId}`);if(old){const patch={};if(clean(old.Nama)!==clean(name))patch.Nama=name;if(clean(old.Role)!==role)patch.Role=role;if(!truthy(old.Active))patch.Active='true';if(!clean(old.Salt)||!clean(old.PasswordHash)){const salt=randomSalt();patch.Salt=salt;patch.PasswordHash=hashPassword('ami2026!',salt);patch.ForceChangePassword='true';}if(role==='PIMPINAN'){let desired=base.toLowerCase();let n=1;while([...used].includes(norm(desired).toLowerCase())&&norm(desired).toLowerCase()!==norm(old.Username).toLowerCase())desired=`${base}.${++n}`;if(norm(old.Username).toLowerCase()!==norm(desired).toLowerCase()){patch.Username=desired;renamed.push({Nama:name,Role:role,UsernameLama:old.Username,UsernameBaru:desired});used.add(norm(desired).toLowerCase());}}if(Object.keys(patch).length){patch.UpdatedAt=now();await update(db,schema,'USERS','UserID',old.UserID,patch);}return;}let username=base.toLowerCase(),n=1;while(used.has(norm(username).toLowerCase()))username=`${base}.${++n}`;used.add(norm(username).toLowerCase());const salt=randomSalt();const record={UserID:id('USR'),Username:username,PasswordHash:hashPassword('ami2026!',salt),Salt:salt,Nama:name,Role:role,RefType:type,RefID:refId,Active:'true',ForceChangePassword:'true',LastLogin:'',CreatedAt:now(),UpdatedAt:now()};await insert(db,schema,'USERS',record);created.push({Nama:name,Role:role,Username:username,Password:'ami2026!'});};for(const row of (await all(db,schema,'MASTER_AUDITOR')).filter(row=>truthy(row.Active)))await ensure('AUDITOR',row.AuditorID,row.Nama,desiredUsername(row,'AUDITOR'), 'AUDITOR');for(const row of (await all(db,schema,'MASTER_PRODI')).filter(row=>truthy(row.Active)))await ensure('PRODI',row.ProdiID,`Auditi — ${row.NamaProdi}`,desiredUsername(row,'PRODI'),'AUDITI');for(const row of (await all(db,schema,'MASTER_UNIT')).filter(row=>truthy(row.Active)))await ensure('UNIT',row.UnitID,`Auditi — ${row.NamaUnit}`,desiredUsername(row,'UNIT'),'AUDITI');for(const row of (await all(db,schema,'MASTER_PIMPINAN')).filter(row=>truthy(row.Active)))await ensure('PIMPINAN',row.PimpinanID,row.Nama,desiredUsername(row,'PIMPINAN'),'PIMPINAN');await audit(db,schema,user,'SYNC_USERS','USERS','',{created:created.length,renamed:renamed.length});return {ok:true,created,renamed,repaired:created.filter(row=>row.Repaired).length,totalUsers:(await all(db,schema,'USERS')).length};});}

async function resetUserPassword(pool,schema,user,userId,password){requireAdmin(user);return inTransaction(pool,schema,async db=>{const target=await one(db,schema,'USERS','UserID',userId);if(!target)throw new Error('Pengguna tidak ditemukan.');password=String(password || 'ami2026!');if(password.length<8)throw new Error('Password minimal 8 karakter.');const salt=randomSalt();await update(db,schema,'USERS','UserID',userId,{PasswordHash:hashPassword(password,salt),Salt:salt,ForceChangePassword:'true',UpdatedAt:now()});await db.query(`DELETE FROM ${table(schema,'SESSIONS')} WHERE ${quote('UserID')} = $1`,[userId]);await audit(db,schema,user,'RESET_PASSWORD','USERS',userId,{}, {Username:target.Username});return {ok:true,username:target.Username,password};});}
async function resetUserPasswordsBulk(pool,schema,user,payload){requireAdmin(user);payload=payload||{};const mode=upper(payload.mode||'SELECTED');const password=String(payload.password||'ami2026!');if(!['SELECTED','ALL'].includes(mode))throw new Error('Mode reset password tidak valid.');if(password.length<8)throw new Error('Password minimal 8 karakter.');return inTransaction(pool,schema,async db=>{const users=await all(db,schema,'USERS'),selected=new Set((payload.userIds||[]).map(clean)),targets=users.filter(row=>clean(row.UserID)!==clean(user.UserID)&&(mode==='ALL'||selected.has(clean(row.UserID))));if(!targets.length)throw new Error(mode==='ALL'?'Tidak ada akun lain yang dapat direset.':'Pilih minimal satu akun pengguna.');const salt=randomSalt();for(const target of targets)await update(db,schema,'USERS','UserID',target.UserID,{PasswordHash:hashPassword(password,salt),Salt:salt,ForceChangePassword:'true',UpdatedAt:now()});await db.query(`DELETE FROM ${table(schema,'SESSIONS')} WHERE ${quote('UserID')} = ANY($1::text[])`,[targets.map(row=>row.UserID)]);return {ok:true,mode,count:targets.length,password,currentAdminExcluded:true,users:targets.map(row=>({UserID:row.UserID,Username:row.Username,Nama:row.Nama,Role:row.Role}))};});}

module.exports={saveCycle,setActiveCycle,saveMaster,bulkImportMaster,saveStandard,createStandardVersion,deleteStandardDraft,bulkImportStandards,createAuditiFromMaster,assignStandards,reopenAuditAssignment,resetUserPassword,resetUserPasswordsBulk,syncUsersFromMasters,requireAdmin,hashPassword};
