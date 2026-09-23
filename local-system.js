const crypto = require('node:crypto');

const clean = value => String(value == null ? '' : value).trim();
const upper = value => clean(value).toUpperCase();
const truthy = value => value === true || ['true', '1', 'yes', 'iya', 'aktif'].includes(clean(value).toLowerCase());
const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
const table = (schema, name) => `${quote(schema)}.${quote(name)}`;
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${crypto.randomUUID()}`;

function requireAdmin(user) {
  if (!user || upper(user.Role) !== 'ADMIN_BPM') {
    const error = new Error('Hanya Admin BPM yang dapat melakukan perubahan ini.');
    error.status = 403;
    throw error;
  }
}

async function inTransaction(pool, work) {
  if (!pool.connect) return work(pool);
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
  finally { client.release(); }
}

async function all(db, schema, name) { return (await db.query(`SELECT * FROM ${table(schema, name)}`)).rows; }
async function one(db, schema, name, key, value) { return (await db.query(`SELECT * FROM ${table(schema, name)} WHERE ${quote(key)} = $1 LIMIT 1`, [value])).rows[0] || null; }
async function count(db, schema, name, where = '', params = []) { return Number((await db.query(`SELECT COUNT(*)::int AS count FROM ${table(schema, name)}${where}`, params)).rows[0]?.count || 0); }
async function insert(db, schema, name, record) {
  const fields = Object.keys(record);
  await db.query(`INSERT INTO ${table(schema, name)} (${fields.map(quote).join(',')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(',')})`, fields.map(field => record[field]));
}
async function update(db, schema, name, key, value, patch) {
  const fields = Object.keys(patch); if (!fields.length) return;
  await db.query(`UPDATE ${table(schema, name)} SET ${fields.map((field, i) => `${quote(field)} = $${i + 1}`).join(', ')} WHERE ${quote(key)} = $${fields.length + 1}`, [...fields.map(field => patch[field]), value]);
}

const schemaColumns = {
  SETTINGS:['Key','Value','Description','UpdatedAt','UpdatedBy'], SOURCE_REGISTER:['SourceID','Kelompok','NamaFile','Tahun','JumlahButir','CatatanVerifikasi'],
  MASTER_STANDAR:['StandardID','ItemCode','Kelompok','KodeKelompokStandar','NamaStandar','NoSumber','PernyataanStandar','StrategiPencapaian','Indikator','SumberFile','TahunSumber','HalamanPDFMulai','HalamanPDFAkhir','SourceHash','Active','CreatedAt','UpdatedAt','StandardFamilyID','Versi','TahunBerlakuMulai','TahunBerlakuSampai','StatusStandar','ReplacesStandardID','Origin','Locked','Notes','CreatedBy','UpdatedBy'],
  MASTER_PRODI:['ProdiID','KodeProdi','NamaProdi','Fakultas','Jenjang','Kaprodi','NIDN','Active','CreatedAt','UpdatedAt'], MASTER_UNIT:['UnitID','KodeUnit','NamaUnit','JenisUnit','Pimpinan','Active','CreatedAt','UpdatedAt'], MASTER_AUDITOR:['AuditorID','NIDN_NIK','Nama','Unit','Sertifikasi','Active','CreatedAt','UpdatedAt'], MASTER_PIMPINAN:['PimpinanID','Nama','Jabatan','Level','Active','CreatedAt','UpdatedAt','UnitID','AccessType','AccessID','AccessName'],
  USERS:['UserID','Username','PasswordHash','Salt','Nama','Role','RefType','RefID','Active','ForceChangePassword','LastLogin','CreatedAt','UpdatedAt'], SESSIONS:['Token','UserID','ExpiresAt','CreatedAt','LastSeenAt','ResumeKey'], AMI_CYCLE:['CycleID','NamaSiklus','Tahun','TahunAkademik','TanggalMulai','BatasEvaluasiDiri','DeskStart','DeskEnd','VisitStart','VisitEnd','Status','Active','CreatedAt','CreatedBy'], AMI_AUDITI:['AuditID','CycleID','AuditiType','AuditiID','AuditiName','Fakultas','Jenjang','Status','PublishedAt','CreatedAt','CreatedBy'],
  AMI_STANDARD_ASSIGN:['AssignID','AuditID','StandardID','ItemCode','NamaStandar','AssignedAt','AssignedBy','Active','KelompokSnapshot','KodeKelompokSnapshot','PernyataanStandarSnapshot','StrategiSnapshot','IndikatorSnapshot','SumberFileSnapshot','TahunSumberSnapshot','SourceHashSnapshot','VersiStandarSnapshot','TahunBerlakuSnapshot'], AMI_TEAM:['TeamID','AuditID','LeadAuditorID','Member1ID','Member2ID','AssignedAt','AssignedBy','UpdatedAt'], SELF_EVAL:['SelfEvalID','AuditID','AssignID','StandardID','Capaian','NilaiCapaian','EvaluasiDiri','Akibat','AkarPenyebab','Status','BuktiCount','SavedAt','SubmittedAt','SubmittedBy'], SELF_FOLLOW_UP:['FollowUpID','AuditID','AssignID','StandardID','SelfEvalID','CapaianAwal','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','Status','SavedAt','SavedBy','UpdatedAt'], EVIDENCE:['EvidenceID','SelfEvalID','AuditID','StandardID','NamaBukti','JenisBukti','URL','DriveFileID','Keterangan','ClientKey','FileSize','UploadedAt','UploadedBy'], DESK_EVAL:['DeskID','AuditID','AssignID','StandardID','StatusDesk','CatatanDesk','ButuhVisitasi','AuditorID','UpdatedAt'], VISIT:['VisitID','AuditID','Tanggal','JamMulai','JamSelesai','Lokasi','WakilAuditi','CatatanUmum','Status','UpdatedAt'], FORM2_PROGRAM_KERJA:['Form2ID','AuditID','TentatifAuditObjektif','TujuanAudit','LangkahJSON','UpdatedAt','UpdatedBy'], FORM3_CATATAN:['Form3ID','AuditID','CatatanJSON','UpdatedAt','UpdatedBy'], FINDINGS:['FindingID','AuditID','AssignID','StandardID','Kategori','Deskripsi','Kriteria','Akibat','AkarPenyebab','Rekomendasi','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','CreatedAt','CreatedBy','UpdatedAt','UpdatedBy'], AMI_IMPROVEMENT:['ImprovementID','AuditID','AssignID','StandardID','SelfEvalID','CapaianAwal','KategoriFinal','FaktorPendukung','RekomendasiPeningkatanIndikator','Status','SavedAt','SavedBy','UpdatedAt','UpdatedBy'], APPROVAL:['ApprovalID','AuditID','Stage','Approved','ApprovedByUserID','ApprovedByNama','ApprovedByRole','ApprovedAt','VersionHash','Note'], REPORT_LOG:['ReportID','AuditID','Version','Status','GoogleDocID','DocxFileID','PdfFileID','ValidationHash','DocxBytes','PdfBytes','CreatedAt','CreatedBy'], AUDIT_LOG:['LogID','Timestamp','UserID','Nama','Role','Action','Module','AuditID','RecordID','BeforeJSON','AfterJSON'], SYSTEM_ERROR_LOG:['ErrorID','Timestamp','UserID','Username','Role','FunctionName','Message','Stack','ContextJSON']
};
const resetTables = ['REPORT_LOG','APPROVAL','AMI_IMPROVEMENT','FINDINGS','FORM3_CATATAN','FORM2_PROGRAM_KERJA','VISIT','DESK_EVAL','EVIDENCE','SELF_FOLLOW_UP','SELF_EVAL','AMI_TEAM','AMI_STANDARD_ASSIGN','AMI_AUDITI','AUDIT_LOG','SYSTEM_ERROR_LOG'];
const resetAuditTables = ['REPORT_LOG','APPROVAL','AMI_IMPROVEMENT','FINDINGS','FORM3_CATATAN','FORM2_PROGRAM_KERJA','VISIT','DESK_EVAL','EVIDENCE','SELF_FOLLOW_UP','SELF_EVAL','AMI_TEAM','AMI_STANDARD_ASSIGN','AUDIT_LOG','AMI_AUDITI'];
const retainedTables = ['SETTINGS','SOURCE_REGISTER','MASTER_STANDAR','MASTER_PRODI','MASTER_UNIT','MASTER_AUDITOR','MASTER_PIMPINAN','USERS','SESSIONS','AMI_CYCLE'];

async function getDatabaseHealth(pool, schema, user) {
  requireAdmin(user);
  const checks = await Promise.all(Object.entries(schemaColumns).map(async ([name, columns]) => {
    const result = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`, [schema, name]);
    const present = new Set(result.rows.map(row => row.column_name));
    const missing = columns.filter(column => !present.has(column));
    return {name, ok: missing.length === 0, rows: missing.length ? 0 : await count(pool, schema, name), missing};
  }));
  return {ok: checks.every(check => check.ok), schema, checks};
}

async function getRecentSystemErrors(pool, schema, user, limit = 30) {
  requireAdmin(user); const size = Math.max(1, Math.min(100, Number(limit) || 30));
  return (await pool.query(`SELECT * FROM ${table(schema, 'SYSTEM_ERROR_LOG')} ORDER BY "Timestamp" DESC LIMIT $1`, [size])).rows;
}

async function getLaunchReadiness(pool, schema, user) {
  requireAdmin(user); const health = await getDatabaseHealth(pool, schema, user); const checks = [];
  checks.push({name:'Struktur database kompatibel dengan versi final', ok:health.ok, detail:health.ok ? 'Semua tabel dan kolom wajib tersedia.' : 'Jalankan penyelarasan skema final.'});
  for (const [name, predicate, detail] of [
    ['Master Program Studi telah diisi', 'MASTER_PRODI', 'prodi aktif'], ['Master Auditor mencukupi satu tim', 'MASTER_AUDITOR', 'auditor aktif'], ['Master Pimpinan telah diisi', 'MASTER_PIMPINAN', 'pimpinan aktif']
  ]) { const total = await count(pool, schema, predicate, ` WHERE "Active" = $1`, ['true']); const required = name === 'Master Auditor mencukupi satu tim' ? 3 : 1; checks.push({name, ok:total >= required, detail:`${total} ${detail}`}); }
  const cycles = await count(pool, schema, 'AMI_CYCLE', ` WHERE "Active" = $1 OR upper("Status") = $2`, ['true','AKTIF']);
  checks.push({name:'Tepat satu Siklus AMI aktif', ok:cycles === 1, detail:`${cycles} siklus aktif`});
  return {ok:health.ok && checks.every(check => check.ok), version:'1.6.2-local', critical:checks.filter(check => !check.ok).length + (health.ok ? 0 : 1), checks, databaseId:'postgresql', databaseName:process.env.PGDATABASE || 'ami_local'};
}

async function runSystemSelfTest(pool, schema, user) {
  requireAdmin(user); const checks = [];
  try { await pool.query('SELECT 1 AS ok'); checks.push({name:'Koneksi PostgreSQL',ok:true,detail:'SELECT 1 berhasil.'}); } catch (error) { checks.push({name:'Koneksi PostgreSQL',ok:false,detail:error.message}); }
  const health = await getDatabaseHealth(pool, schema, user); health.checks.forEach(check => checks.push({name:`Tabel ${check.name}`,ok:check.ok,detail:check.ok ? `${check.rows} baris` : `Kolom hilang: ${check.missing.join(', ')}`}));
  return {ok:checks.every(check => check.ok), checks};
}

async function resetCounts(pool, schema, names) { const values = {}; let total = 0; for (const name of names) { values[name] = await count(pool, schema, name); total += values[name]; } return {values, total}; }
async function getResetAllTestDataPreview(pool, schema, user) {
  requireAdmin(user); const counts = await resetCounts(pool, schema, resetTables); const evidence = await count(pool, schema, 'EVIDENCE', ` WHERE COALESCE("DriveFileID", '') <> ''`); const reports = await count(pool, schema, 'REPORT_LOG', ` WHERE COALESCE("GoogleDocID", '') <> '' OR COALESCE("DocxFileID", '') <> '' OR COALESCE("PdfFileID", '') <> ''`);
  return {ok:true, confirmation:'RESET SEMUA DATA UJI AMI 2026', counts:counts.values, totalRows:counts.total, driveFiles:{evidence,reports,total:evidence+reports}, retained:retainedTables, note:'Reset menghapus seluruh transaksi/uji AMI; master, akun, siklus, settings, dan struktur database tetap dipertahankan.'};
}
async function getResetAuditPreview(pool, schema, user, auditId) {
  requireAdmin(user); const audit = await one(pool, schema, 'AMI_AUDITI', 'AuditID', auditId); if (!audit) throw new Error('Audit tidak ditemukan.'); const result = await resetCounts(pool, schema, resetAuditTables); const counts = {}; for (const name of resetAuditTables) counts[name] = await count(pool, schema, name, ` WHERE "AuditID" = $1`, [auditId]);
  return {ok:true, audit:{AuditID:audit.AuditID,AuditiName:audit.AuditiName,AuditiType:audit.AuditiType,AuditiID:audit.AuditiID,Status:audit.Status,CycleID:audit.CycleID}, counts, confirmation:`RESET ${clean(audit.AuditiName)}`, retained:retainedTables};
}
async function resetAllTestData(pool, schema, user, confirmation) {
  requireAdmin(user); const expected = 'RESET SEMUA DATA UJI AMI 2026'; if (clean(confirmation) !== expected) throw new Error(`Konfirmasi tidak sesuai. Ketik persis: ${expected}`);
  return inTransaction(pool, async db => { const before = await resetCounts(db, schema, resetTables); for (const name of resetTables) await db.query(`DELETE FROM ${table(schema, name)}`); await insert(db, schema, 'AUDIT_LOG', {LogID:id('RESET'),Timestamp:now(),UserID:user.UserID || '',Nama:user.Nama || '',Role:user.Role || '',Action:'RESET_ALL_TEST_DATA',Module:'SYSTEM',AuditID:'',RecordID:'',BeforeJSON:JSON.stringify({deletedRows:before.total}),AfterJSON:JSON.stringify({retained:retainedTables})}); return {ok:true,message:'Seluruh data uji/transaksi AMI berhasil direset.',deleted:before.values,totalDeleted:before.total,trashedEvidence:0,trashedReports:0,retained:retainedTables,reloginRequired:false}; });
}
async function resetAuditForRetest(pool, schema, user, auditId, confirmation) {
  requireAdmin(user); return inTransaction(pool, async db => { const audit = await one(db, schema, 'AMI_AUDITI', 'AuditID', auditId); if (!audit) throw new Error('Audit tidak ditemukan atau sudah direset.'); const expected = `RESET ${clean(audit.AuditiName)}`; if (clean(confirmation) !== expected) throw new Error(`Konfirmasi tidak sesuai. Ketik persis: ${expected}`); const counts = {}; for (const name of resetAuditTables) counts[name] = await count(db, schema, name, ` WHERE "AuditID" = $1`, [auditId]); for (const name of resetAuditTables) await db.query(`DELETE FROM ${table(schema, name)} WHERE "AuditID" = $1`, [auditId]); await insert(db, schema, 'AUDIT_LOG', {LogID:id('RESET'),Timestamp:now(),UserID:user.UserID || '',Nama:user.Nama || '',Role:user.Role || '',Action:'RESET_TEST_AUDIT',Module:'AMI_AUDITI',AuditID:'',RecordID:auditId,BeforeJSON:JSON.stringify(counts),AfterJSON:JSON.stringify({reset:true})}); return {ok:true,message:`Data audit uji ${clean(audit.AuditiName)} berhasil direset.`,deleted:counts,trashedEvidence:0,trashedReports:0}; });
}

async function upgradeSchemaFinal(pool, schema, user) {
  requireAdmin(user); return inTransaction(pool, async db => { const changes = []; for (const [name, columns] of Object.entries(schemaColumns)) for (const column of columns) { await db.query(`ALTER TABLE ${table(schema, name)} ADD COLUMN IF NOT EXISTS ${quote(column)} TEXT`); changes.push(`${name}.${column}`); } return {ok:true, database:'PostgreSQL',schema,changes:changes.length,message:'Skema final AMI berhasil diselaraskan tanpa menghapus data.'}; });
}

const officialCodes = {'Standar Kompetensi Lulusan':'STD/SPMI/UMA/1.1.0.0/2024','Standar Luaran Dharma Pendidikan':'STD/SPMI/UMA/1.1.1.0/2024','Standar Isi Pembelajaran':'STD/SPMI/UMA/1.2.0.0/2024','Standar Proses Pembelajaran':'STD/SPMI/UMA/1.3.0.0/2024','Standar Penilaian Pembelajaran':'STD/SPMI/UMA/1.4.0.0/2024','Standar Dosen':'STD/SPMI/UMA/1.5.0.0/2024','Standar Tenaga Kependidikan':'STD/SPMI/UMA/1.5.1.0/2024','Standar Sarana dan Prasarana Pembelajaran':'STD/SPMI/UMA/1.6.0.0/2024','Standar Pengelolaan Pembelajaran':'STD/SPMI/UMA/1.7.0.0/2024','Standar Pembiayaan Pembelajaran':'STD/SPMI/UMA/1.8.0.0/2024','Standar Luaran Penelitian':'STD/SPMI/UMA/2.1.0.0/2024','Standar Proses Penelitian':'STD/SPMI/UMA/2.2.0.0/2024','Standar Masukan Penelitian':'STD/SPMI/UMA/2.3.0.0/2024','Standar Luaran Pengabdian kepada Masyarakat':'STD/SPMI/UMA/3.1.0.0/2024','Standar Proses Pengabdian kepada Masyarakat':'STD/SPMI/UMA/3.2.0.0/2024','Standar Sarana dan Prasarana Pengabdian kepada Masyarakat':'STD/SPMI/UMA/3.3.0.0/2024','Standar Rekrutmen Auditor':'STD/SPMI/UMA/4.1.0.0/2022','Standar Visi dan Misi':'STD/SPMI/UMA/4.2.0.0/2022','Standar Mahasiswa dan Kemahasiswaan':'STD/SPMI/UMA/4.3.0.0/2022','Standar Suasana Akademik':'STD/SPMI/UMA/4.4.0.0/2022','Standar Kerjasama':'STD/SPMI/UMA/4.5.0.0/2022','Standar Informasi':'STD/SPMI/UMA/4.6.0.0/2022','Standar Pengembangan Budaya Mutu':'STD/SPMI/UMA/4.7.0.0/2022','Standar Kode Etik':'STD/SPMI/UMA/4.8.0.0/2022','Standar Fasilitasi Mahasiswa Melakukan Kegiatan Pembelajaran di Luar Prodi':'STD/SPMI/UMA/5.1.0.0/2024','Standar Perjanjian Kerjasama antar PT atau antar PT dengan Lembaga Non PT':'STD/SPMI/UMA/5.2.0.0/2024'};
function hashStandard(row) { return crypto.createHash('sha256').update(['ItemCode','Kelompok','KodeKelompokStandar','NamaStandar','NoSumber','PernyataanStandar','StrategiPencapaian','Indikator','SumberFile','TahunSumber','HalamanPDFMulai','HalamanPDFAkhir'].map(key => clean(row[key])).join('\u241f')).digest('hex').slice(0, 32); }
async function migrationPlan(pool, schema) { const rows = await all(pool, schema, 'MASTER_STANDAR'); const unmapped = [...new Set(rows.map(row => clean(row.NamaStandar)).filter(name => name && !officialCodes[name]))]; if (unmapped.length) throw new Error(`Nama standar belum memiliki pemetaan kode resmi: ${unmapped.join(' | ')}`); const families = {}; for (const row of rows) { const family = clean(row.StandardFamilyID) || clean(row.StandardID); (families[family] ||= {name:clean(row.NamaStandar),rows:[]}).rows.push(row); } const target = {}; for (const family of Object.values(families)) family.rows.sort((a,b) => Number(a.HalamanPDFMulai || 999999) - Number(b.HalamanPDFMulai || 999999)); for (const family of Object.values(families)) family.rows.forEach((row,index) => { target[clean(row.StandardID)] = `${officialCodes[family.name]}-${String(Number(row.NoSumber) || index + 1).padStart(2, '0')}`; }); const plan = rows.map(row => ({...row, TargetItemCode:target[clean(row.StandardID)],TargetGroupCode:officialCodes[clean(row.NamaStandar)]})); const duplicate = new Set(); for (const row of plan) { const key = `${row.TargetItemCode}|${clean(row.Versi) || '1.0'}`; if (duplicate.has(key)) throw new Error(`Target kode resmi menghasilkan duplikasi ItemCode+Versi: ${key}`); duplicate.add(key); } return plan; }
async function previewOfficialStandardCodeMigration(pool, schema, user) { requireAdmin(user); const plan = await migrationPlan(pool, schema); return {ok:true,total:plan.length,changes:plan.filter(row => clean(row.ItemCode) !== row.TargetItemCode || clean(row.KodeKelompokStandar) !== row.TargetGroupCode).map(row => ({StandardID:row.StandardID,CurrentItemCode:row.ItemCode,TargetItemCode:row.TargetItemCode,CurrentGroupCode:row.KodeKelompokStandar,TargetGroupCode:row.TargetGroupCode})),warnings:[],sample:plan.slice(0,25)}; }
async function applyOfficialStandardCodeMigration(pool, schema, user) { requireAdmin(user); return inTransaction(pool, async db => { const plan = await migrationPlan(db, schema); const byId = Object.fromEntries(plan.map(row => [clean(row.StandardID), row])); let standardsUpdated = 0, assignmentsUpdated = 0; for (const row of plan) { const hash = hashStandard({...row,ItemCode:row.TargetItemCode,KodeKelompokStandar:row.TargetGroupCode}); if (clean(row.ItemCode) !== row.TargetItemCode || clean(row.KodeKelompokStandar) !== row.TargetGroupCode) { await update(db, schema, 'MASTER_STANDAR', 'StandardID', row.StandardID, {ItemCode:row.TargetItemCode,KodeKelompokStandar:row.TargetGroupCode,SourceHash:hash,UpdatedAt:now(),UpdatedBy:user.Nama || ''}); standardsUpdated++; } }
  const assignments = await all(db, schema, 'AMI_STANDARD_ASSIGN'); for (const row of assignments) { const planRow = byId[clean(row.StandardID)]; if (!planRow) continue; const patch = {}; if (clean(row.ItemCode) !== planRow.TargetItemCode) patch.ItemCode = planRow.TargetItemCode; if (clean(row.KodeKelompokSnapshot) !== planRow.TargetGroupCode) patch.KodeKelompokSnapshot = planRow.TargetGroupCode; const hash = hashStandard({...planRow,ItemCode:planRow.TargetItemCode,KodeKelompokStandar:planRow.TargetGroupCode}); if (clean(row.SourceHashSnapshot) !== hash) patch.SourceHashSnapshot = hash; if (Object.keys(patch).length) { await update(db, schema, 'AMI_STANDARD_ASSIGN', 'AssignID', row.AssignID, patch); assignmentsUpdated++; } }
  await insert(db, schema, 'AUDIT_LOG', {LogID:id('LOG'),Timestamp:now(),UserID:user.UserID || '',Nama:user.Nama || '',Role:user.Role || '',Action:'MIGRATE_OFFICIAL_STANDARD_CODES',Module:'MASTER_STANDAR',AuditID:'',RecordID:'',BeforeJSON:'',AfterJSON:JSON.stringify({standardsUpdated,assignmentsUpdated})}); return {ok:true,standardsUpdated,assignmentsUpdated,warnings:[]}; }); }

module.exports = {requireAdmin,getDatabaseHealth,getLaunchReadiness,getRecentSystemErrors,runSystemSelfTest,getResetAuditPreview,resetAuditForRetest,getResetAllTestDataPreview,resetAllTestData,upgradeSchemaFinal,previewOfficialStandardCodeMigration,applyOfficialStandardCodeMigration};
