const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Reuse the existing dashboard calculations and role filtering with a read-only
// PostgreSQL snapshot. No Apps Script write functions are exposed as RPC methods.
const scripts = ['Config.gs', 'AdminService.gs', 'Code.gs', 'ImportExportService.gs'].map(file =>
  new vm.Script(fs.readFileSync(path.join(__dirname, file), 'utf8'), {filename:file}));
const tables = ['SETTINGS','AMI_CYCLE','AMI_AUDITI','AMI_TEAM','AMI_STANDARD_ASSIGN',
  'SELF_EVAL','DESK_EVAL','FINDINGS','REPORT_LOG','MASTER_STANDAR','MASTER_PRODI',
  'MASTER_UNIT','MASTER_AUDITOR','MASTER_PIMPINAN'];
const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
const clean = value => String(value == null ? '' : value).trim();

async function readDashboard(pool, schema, method, user) {
  if (!['getBootstrap','getExecutiveDashboard','getPublicExecutiveDashboard','getImportExportCatalog'].includes(method)) throw new Error('Metode baca tidak dikenal.');
  const data = {};
  const results = await Promise.all(tables.map(table => pool.query(`SELECT * FROM ${quote(schema)}.${quote(table)}`)));
  tables.forEach((table, i) => { data[table] = results[i].rows; });
  const context = vm.createContext({
    getAllRows_: table => data[table] || [],
    getSetting_: (key, fallback) => (data.SETTINGS.find(row => row.Key === key) || {}).Value || fallback,
    findOne_: (table, key, value) => (data[table] || []).find(row => row[key] === value),
    cleanText_: clean,
    normalizeUsername_: value => clean(value).toLowerCase(),
    bool_: value => value === true || String(value).toLowerCase() === 'true' || String(value) === '1',
    cleanRow_: row => ({...row}),
    serializeValue_: value => JSON.parse(JSON.stringify(value)),
    now_: () => new Date().toISOString(),
    session_: () => user,
    publicUser_: row => ({userId:row.UserID,username:row.Username,nama:row.Nama,role:row.Role,
      refType:row.RefType || '',refId:row.RefID || '',forceChangePassword:String(row.ForceChangePassword).toLowerCase() === 'true'}),
    CacheService: {getScriptCache: () => ({get: () => null, put: () => {}})}
  });
  for (const script of scripts) script.runInContext(context, {timeout:5000});
  return new vm.Script(`${method}()`).runInContext(context, {timeout:5000});
}
module.exports = {readDashboard};
