const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env'));

const app = express();
const port = Number(process.env.PORT || 3000);
const schema = process.env.PGSCHEMA || 'ami';
const bpmLogoSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 120" role="img" aria-label="Bureau of Quality Assurance BPM UMA">
  <defs>
    <linearGradient id="bpmBg" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#eaf4ff"/>
      <stop offset="100%" stop-color="#dfeeff"/>
    </linearGradient>
  </defs>
  <rect width="260" height="120" rx="22" fill="url(#bpmBg)"/>
  <rect x="16" y="16" width="88" height="88" rx="20" fill="#123b68"/>
  <text x="60" y="71" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="900" fill="#ffffff">BPM</text>
  <g fill="#0f3d69" font-family="Arial, Helvetica, sans-serif">
    <text x="120" y="46" font-size="18" font-weight="700">Biro Penjaminan Mutu</text>
    <text x="120" y="70" font-size="18" font-weight="700">Universitas Medan Area</text>
    <text x="120" y="92" font-size="12" letter-spacing="1.2" fill="#456789">QUALITY ASSURANCE</text>
  </g>
</svg>
`);
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,https://khhfizuhanda.github.io').split(',').map(origin => origin.trim()).filter(Boolean));
const pool = new Pool({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}),
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ami_local',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  connectionTimeoutMillis: 5000,
  query_timeout: 15000,
});
pool.on('error', error => console.error('Koneksi PostgreSQL terputus:', error.message));

function databaseError(error) {
  if (/password must be a string/.test(error.message)) return 'Password PostgreSQL belum diisi. Isi PGPASSWORD di file .env lalu restart server AMI.';
  if (error.code === '28P01') return 'Username atau password PostgreSQL salah. Periksa PGUSER dan PGPASSWORD di .env lalu restart server AMI.';
  if (error.code === 'ECONNREFUSED') return 'PostgreSQL tidak dapat dihubungi. Pastikan servicenya aktif dan PGHOST/PGPORT benar.';
  if (error.code === '3D000') return 'Database PostgreSQL belum tersedia. Buat database sesuai PGDATABASE lalu jalankan postgres/schema.sql.';
  if (error.code === '42P01') return 'Tabel AMI belum tersedia. Jalankan postgres/schema.sql pada database yang dikonfigurasi.';
  return error.message;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(`${salt}|${password}`, 'utf8').digest('hex');
}

async function ensureLocalAdmin() {
  const salt = crypto.randomBytes(24).toString('hex');
  const passwordHash = hashPassword('admin123', salt);
  await pool.query(`
    INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier('USERS')}
      ("UserID", "Username", "PasswordHash", "Salt", "Nama", "Role", "Active", "ForceChangePassword", "CreatedAt", "UpdatedAt")
    SELECT $1, 'admin', $2, $3, 'Administrator BPM', 'ADMIN_BPM', 'true', 'false', NOW()::text, NOW()::text
    WHERE NOT EXISTS (
      SELECT 1 FROM ${quoteIdentifier(schema)}.${quoteIdentifier('USERS')} WHERE lower("Username") = 'admin'
    )
  `, [`USR-LOCAL-ADMIN-${Date.now()}`, passwordHash, salt]);
}

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.has(origin) || origin.endsWith('.github.io'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get(['/', '/Index.html', '/index.html'], (req, res) => {
  const template = fs.readFileSync(path.join(__dirname, 'Index.html'), 'utf8');
  const initialView = req.query.view === 'login' ? 'login' : 'public';
  const localHtml = template
    .replaceAll('<?= appName ?>', 'Sistem Audit Mutu Internal (AMI) 2026')
    .replaceAll('<?= initialView ?>', initialView)
    .replaceAll('<?= webAppUrl ?>', '/')
    .replaceAll('<?= orgName ?>', 'Universitas Medan Area')
    .replaceAll('<?= unitName ?>', 'Biro Penjaminan Mutu')
    .replaceAll('<?= appVersion ?>', '1.6.2-local')
    .replaceAll('<?!= bpmLogo ?>', bpmLogoSvg)
    .replaceAll('<?!= spmiLogo ?>', bpmLogoSvg)
    .replaceAll('<?!= campusHero ?>', '')
    .replace("<?!= JSON.stringify(webAppUrl || '') ?>", JSON.stringify('/'))
    .replace("<?= initialView === 'login' ? 'hidden' : '' ?>", initialView === 'login' ? 'hidden' : '')
    .replace("<?= initialView === 'login' ? '' : 'hidden' ?>", initialView === 'login' ? '' : 'hidden');
  res.set('Cache-Control', 'no-store').type('html').send(localHtml.replace('<head>', '<head><script>window.AMI_LOCAL_BACKEND = true;</script>'));
});

// Serve only application routes; never expose source files or database configuration.

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT current_database() AS database, current_user AS user_name, NOW() AS server_time');
    res.json({ ok: true, database: result.rows[0].database, user: result.rows[0].user_name, schema });
  } catch (error) {
    res.status(503).json({ ok: false, error: databaseError(error) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  try {
    const result = await pool.query(`
      SELECT "UserID", "Username", "PasswordHash", "Salt", "Nama", "Role", "RefType", "RefID", "Active", "ForceChangePassword"
      FROM ${quoteIdentifier(schema)}.${quoteIdentifier('USERS')}
      WHERE lower("Username") = $1
      LIMIT 1
    `, [username]);
    const user = result.rows[0];
    if (!user || String(user.Active).toLowerCase() !== 'true' || hashPassword(password, user.Salt) !== user.PasswordHash) {
      return res.status(401).json({ ok: false, error: 'Username atau password tidak benar.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const resumeKey = crypto.randomBytes(32).toString('hex');
    await pool.query(`INSERT INTO ${tableName('SESSIONS')} ("Token", "UserID", "ExpiresAt", "CreatedAt", "LastSeenAt", "ResumeKey") VALUES ($1,$2,$3,$4,$4,$5)`,
      [token, user.UserID, null, new Date().toISOString(), resumeKey]);
    res.json({ ok: true, token, resumeKey, user: publicUser(user) });
  } catch (error) {
    res.status(503).json({ ok: false, error: databaseError(error) });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schema]);
    res.json({ ok: true, tables: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

function quoteIdentifier(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

app.get('/api/tables/:table/count', async (req, res) => {
  const table = req.params.table;
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`);
    res.json({ ok: true, table, count: result.rows[0].count });
  } catch (error) {
    res.status(404).json({ ok: false, error: error.message });
  }
});

function tableName(name) { return `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`; }
function publicUser(user) {
  return {userId: user.UserID, username: user.Username, nama: user.Nama, role: user.Role,
    refType: user.RefType || '', refId: user.RefID || '', forceChangePassword: String(user.ForceChangePassword).toLowerCase() === 'true'};
}

async function session(token, column = 'Token') {
  const result = await pool.query(`SELECT u.*, s."Token", s."ResumeKey", s."ExpiresAt" FROM ${tableName('SESSIONS')} s JOIN ${tableName('USERS')} u ON u."UserID" = s."UserID" WHERE s.${quoteIdentifier(column)} = $1 LIMIT 1`, [String(token || '')]);
  const user = result.rows[0];
  const expiresAt = user && user.ExpiresAt != null && user.ExpiresAt !== '' ? Date.parse(user.ExpiresAt) : null;
  if (!user || String(user.Active).toLowerCase() !== 'true' || (expiresAt !== null && expiresAt <= Date.now())) {
    const error = new Error('Sesi sudah berakhir. Silakan login kembali.'); error.status = 401; throw error;
  }
  return user;
}

const { readDashboard } = require('./local-dashboard');
const { exportXlsxModule, validateImportXlsx, commitImportXlsx, cancelImportXlsx } = require('./local-import-export');
const localRead = require('./local-read');
const localAdmin = require('./local-admin');
const localWorkflow = require('./local-workflow');
const localSystem = require('./local-system');
const localReports = require('./local-reports');
app.post('/api/rpc/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const args = req.body.args;
    if (!Array.isArray(args)) return res.status(400).json({error: 'Parameter tidak valid.'});
        const masterTables = {
          PRODI: 'MASTER_PRODI',
          UNIT: 'MASTER_UNIT',
          AUDITOR: 'MASTER_AUDITOR',
          PIMPINAN: 'MASTER_PIMPINAN',
        };

        async function listMaster(pool, schema, user, type) {
          if (user.Role !== 'ADMIN_BPM') {
            const error = new Error('Hanya Admin BPM yang dapat melihat master data.');
            error.status = 403;
            throw error;
          }
          const table = masterTables[String(type || '').toUpperCase()];
          if (!table) throw new Error('Jenis master tidak dikenali.');
          const result = await pool.query(`SELECT * FROM ${tableName(table)} ORDER BY 1`);
          return result.rows;
        }
    if (name === 'getPublicExecutiveDashboard') return res.json(await readDashboard(pool, schema, name));
    const user = await session(args[0], name === 'resumeSession' ? 'ResumeKey' : 'Token');
    if (name === 'resumeSession') return res.json({ok:true, token:user.Token, resumeKey:user.ResumeKey, user:publicUser(user)});
    if (name === 'createResumeKey') return res.json({ok:true, resumeKey:user.ResumeKey});
    if (name === 'logout') {
      await pool.query(`DELETE FROM ${tableName('SESSIONS')} WHERE "Token" = $1`, [user.Token]);
      return res.json({ok:true});
    }
    if (name === 'changePassword') {
      if (hashPassword(String(args[1] || ''), user.Salt) !== user.PasswordHash) return res.status(400).json({error:'Password lama tidak benar.'});
      const password = String(args[2] || '');
      if (password.length < 8) return res.status(400).json({error:'Password baru minimal 8 karakter.'});
      const salt = crypto.randomBytes(24).toString('hex');
      await pool.query(`UPDATE ${tableName('USERS')} SET "Salt"=$1, "PasswordHash"=$2, "ForceChangePassword"='false', "UpdatedAt"=$3 WHERE "UserID"=$4`, [salt,hashPassword(password,salt),new Date().toISOString(),user.UserID]);
      await pool.query(`DELETE FROM ${tableName('SESSIONS')} WHERE "UserID"=$1 AND "Token"<>$2`, [user.UserID,user.Token]);
      return res.json({ok:true});
    }
        if (name === 'listMaster') return res.json(await listMaster(pool, schema, user, args[1]));
        if (name === 'listStandardsAdmin') return res.json(await localRead.listStandardsAdmin(pool, schema, user, args[1] || {}));
        if (name === 'listStandards') return res.json(await localRead.listStandards(pool, schema, user, args[1] || {}));
        if (name === 'getStandardVersions') return res.json(await localRead.getStandardVersions(pool, schema, user, args[1]));
        if (name === 'listUsers') return res.json(await localRead.listUsers(pool, schema, user));
        if (name === 'listCycles') return res.json(await localRead.listCycles(pool, schema, user));
        if (name === 'listCycleAudits') return res.json(await localRead.listCycleAudits(pool, schema, user, args[1]));
        if (name === 'getAccessibleAudits') return res.json(await localRead.getAccessibleAudits(pool, schema, user));
        if (name === 'getAuditWorkspace') return res.json(await localRead.getAuditWorkspace(pool, schema, user, args[1]));
        const systemReads = {
          listReports: () => localReports.listReports(pool, schema, user),
          getLaunchReadiness: () => localSystem.getLaunchReadiness(pool, schema, user),
          getRecentSystemErrors: () => localSystem.getRecentSystemErrors(pool, schema, user, args[1]),
          getDatabaseHealth: () => localSystem.getDatabaseHealth(pool, schema, user),
          runSystemSelfTest: () => localSystem.runSystemSelfTest(pool, schema, user),
          getResetAuditPreview: () => localSystem.getResetAuditPreview(pool, schema, user, args[1]),
          getResetAllTestDataPreview: () => localSystem.getResetAllTestDataPreview(pool, schema, user),
          previewOfficialStandardCodeMigration: () => localSystem.previewOfficialStandardCodeMigration(pool, schema, user),
        };
        if (systemReads[name]) return res.json(await systemReads[name]());
        const systemWrites = {
          resetAuditForRetest: () => localSystem.resetAuditForRetest(pool, schema, user, args[1], args[2]),
          resetAllTestData: () => localSystem.resetAllTestData(pool, schema, user, args[1]),
          upgradeSchemaFinal: () => localSystem.upgradeSchemaFinal(pool, schema, user),
          applyOfficialStandardCodeMigration: () => localSystem.applyOfficialStandardCodeMigration(pool, schema, user),
          generateAmiFinalReport: () => localReports.generateAmiFinalReport(),
          downloadReportFile: () => localReports.downloadReportFile(),
          downloadEvidenceFile: () => localReports.downloadEvidenceFile(),
        };
        if (systemWrites[name]) return res.json(await systemWrites[name]());
        const workflowWrites = {
          saveAllSelfEvaluation: () => localWorkflow.saveAllSelfEvaluation(pool, schema, user, args[1], args[2]),
          saveEvidenceLinksBatch: () => localWorkflow.saveEvidenceLinksBatch(pool, schema, user, args[1], args[2]),
          saveAllDeskEvaluation: () => localWorkflow.saveAllDeskEvaluation(pool, schema, user, args[1], args[2]),
          saveAllVisitForms: () => localWorkflow.saveAllVisitForms(pool, schema, user, args[1], args[2]),
          saveAllFindings: () => localWorkflow.saveAllFindings(pool, schema, user, args[1], args[2]),
          saveAllAuditiFollowUps: () => localWorkflow.saveAllAuditiFollowUps(pool, schema, user, args[1], args[2]),
          returnSelfEvaluation: () => localWorkflow.returnSelfEvaluation(pool, schema, user, args[1], args[2]),
          approveAudit: () => localWorkflow.approveAudit(pool, schema, user, args[1], args[2], args[3]),
          returnAuditRevision: () => localWorkflow.returnAuditRevision(pool, schema, user, args[1], args[2]),
          deleteEvidence: () => localWorkflow.deleteEvidence(pool, schema, user, args[1]),
          getAuditValidation: () => localWorkflow.getAuditValidation(pool, schema, user, args[1]),
          submitSelfEvaluation: () => localWorkflow.submitSelfEvaluation(pool, schema, user, args[1]),
          finishDeskEvaluation: () => localWorkflow.finishDeskEvaluation(pool, schema, user, args[1]),
          submitAuditResult: () => localWorkflow.submitAuditResult(pool, schema, user, args[1]),
        };
        if (workflowWrites[name]) return res.json(await workflowWrites[name]());
    const adminWrites = {
      saveCycle: () => localAdmin.saveCycle(pool, schema, user, args[1]),
      setActiveCycle: () => localAdmin.setActiveCycle(pool, schema, user, args[1]),
      saveMaster: () => localAdmin.saveMaster(pool, schema, user, args[1], args[2]),
      bulkImportMaster: () => localAdmin.bulkImportMaster(pool, schema, user, args[1], args[2]),
      saveStandard: () => localAdmin.saveStandard(pool, schema, user, args[1]),
      createStandardVersion: () => localAdmin.createStandardVersion(pool, schema, user, args[1]),
      deleteStandardDraft: () => localAdmin.deleteStandardDraft(pool, schema, user, args[1]),
      bulkImportStandards: () => localAdmin.bulkImportStandards(pool, schema, user, args[1]),
      createAuditiFromMaster: () => localAdmin.createAuditiFromMaster(pool, schema, user, args[1], args[2]),
      assignStandards: () => localAdmin.assignStandards(pool, schema, user, args[1], args[2], args[3]),
      reopenAuditAssignment: () => localAdmin.reopenAuditAssignment(pool, schema, user, args[1]),
      resetUserPassword: () => localAdmin.resetUserPassword(pool, schema, user, args[1], args[2]),
      resetUserPasswordsBulk: () => localAdmin.resetUserPasswordsBulk(pool, schema, user, args[1]),
      syncUsersFromMasters: () => localAdmin.syncUsersFromMasters(pool, schema, user),
    };
    if (adminWrites[name]) return res.json(await adminWrites[name]());
    if (name === 'exportXlsxModule') return res.json(await exportXlsxModule(pool, schema, user, args[1], args[2] || {}));
    if (name === 'validateImportXlsx') return res.json(await validateImportXlsx(pool, schema, user, args[1], args[2] || {}, args[3], args[4], args[5]));
    if (name === 'commitImportXlsx') return res.json(await commitImportXlsx(pool, schema, user, args[1]));
    if (name === 'cancelImportXlsx') return res.json(cancelImportXlsx(user, args[1]));
    if (['getBootstrap','getExecutiveDashboard','getImportExportCatalog'].includes(name)) return res.json(await readDashboard(pool, schema, name, user));
    return res.status(501).json({error:`Fitur ${name} belum tersedia pada backend lokal PostgreSQL.`});
  } catch (error) { res.status(error.status || 503).json({error: databaseError(error)}); }
});

app.use('/api', (req, res) => res.status(404).json({error:'Endpoint API tidak ditemukan. Buka aplikasi melalui server AMI.'}));
app.use((error, req, res, next) => res.status(error.status || 500).json({error:error.message}));

if (require.main === module) {
  app.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`AMI server running on port ${port}`));
  ensureLocalAdmin().catch(error => console.error(`Database belum siap: ${databaseError(error)}`));
}
module.exports = { app, pool, ensureLocalAdmin };

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
