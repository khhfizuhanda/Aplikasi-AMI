const {test} = require('node:test');
const assert = require('node:assert/strict');
const system = require('../local-system');
const reports = require('../local-reports');

function fakePool(seed) {
  const data = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, rows.map(row => ({...row}))]));
  const calls = [];
  const db = {async query(sql, params = []) {
    calls.push({sql, params});
    if (/^(BEGIN|COMMIT|ROLLBACK|SELECT 1)/i.test(sql.trim())) return {rows: []};
    if (/information_schema\.columns/i.test(sql)) return {rows: (data[params[1]] ? Object.keys(data[params[1]][0] || {}) : []).map(column_name => ({column_name}))};
    const match = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+"?ami"?\."?([^"\s(]+)"?/i);
    const name = match && match[1].replace(/"/g, '');
    if (!name) return {rows: []};
    data[name] ||= [];
    if (/^SELECT \*/i.test(sql)) {
      const where = sql.match(/WHERE\s+"([^\"]+)"\s*=\s*\$1/i);
      return {rows: (where ? data[name].filter(row => String(row[where[1]] ?? '') === String(params[0] ?? '')) : data[name]).map(row => ({...row}))};
    }
    if (/SELECT COUNT/i.test(sql)) {
      let selected = data[name];
      const where = sql.match(/WHERE\s+"([^\"]+)"\s*=\s*\$1/i);
      if (where) selected = selected.filter(row => String(row[where[1]] ?? '') === String(params[0] ?? ''));
      return {rows: [{count:selected.length}]};
    }
    if (/^INSERT/i.test(sql)) {
      const fields = [...(sql.match(/\(([^)]+)\)\s*VALUES/i) || ['', ''])[1].matchAll(/"([^\"]+)"/g)].map(match => match[1]);
      data[name].push(Object.fromEntries(fields.map((field, index) => [field, params[index]]))); return {rows: []};
    }
    if (/^UPDATE/i.test(sql)) {
      const fields = [...sql.matchAll(/"([^\"]+)"\s*=\s*\$\d+/g)].map(match => match[1]);
      const key = sql.match(/WHERE\s+"([^\"]+)"\s*=\s*\$(\d+)/i);
      if (key) data[name].filter(row => String(row[key[1]] ?? '') === String(params[Number(key[2]) - 1] ?? '')).forEach(row => fields.forEach((field, index) => { row[field] = params[index]; }));
      return {rows: []};
    }
    if (/^DELETE/i.test(sql)) {
      const key = sql.match(/WHERE\s+"([^\"]+)"\s*=\s*\$(\d+)/i);
      if (key) data[name] = data[name].filter(row => String(row[key[1]] ?? '') !== String(params[Number(key[2]) - 1] ?? ''));
      else data[name] = [];
    }
    return {rows: []};
  }, release() {}};
  return {data, calls, query: db.query, async connect() { return db; }};
}

const admin = {UserID:'admin',Nama:'Admin',Role:'ADMIN_BPM'};
const base = {MASTER_STANDAR:[{StandardID:'s1',StandardFamilyID:'f1',NamaStandar:'Standar Dosen',NoSumber:'1',Versi:'1.0',ItemCode:'OLD-01',KodeKelompokStandar:'OLD'}],AMI_STANDARD_ASSIGN:[{AssignID:'as1',StandardID:'s1',AuditID:'a1',ItemCode:'OLD-01',KodeKelompokSnapshot:'OLD'}],AMI_AUDITI:[{AuditID:'a1',AuditiName:'Prodi 1',AuditiType:'PRODI',AuditiID:'p1',Status:'DRAFT BPM'}],REPORT_LOG:[{ReportID:'r1',AuditID:'a1',CreatedAt:'2026-01-02'}],AMI_TEAM:[],MASTER_PIMPINAN:[],AUDIT_LOG:[],EVIDENCE:[]};

test('reports are scoped and Drive-backed operations return explicit 501', async () => {
  const pool = fakePool(base);
  assert.equal((await reports.listReports(pool, 'ami', admin))[0].ReportID, 'r1');
  await assert.rejects(Promise.resolve().then(() => reports.downloadReportFile()), error => error.status === 501 && /Google Drive/.test(error.message));
});

test('official code migration updates standards and snapshots transactionally', async () => {
  const pool = fakePool(base);
  const result = await system.applyOfficialStandardCodeMigration(pool, 'ami', admin);
  assert.equal(result.standardsUpdated, 1);
  assert.equal(pool.data.MASTER_STANDAR[0].ItemCode, 'STD/SPMI/UMA/1.5.0.0/2024-01');
  assert.equal(pool.data.AMI_STANDARD_ASSIGN[0].ItemCode, 'STD/SPMI/UMA/1.5.0.0/2024-01');
  assert.equal(pool.calls.filter(call => call.sql === 'BEGIN').length, 1);
  assert.equal(pool.calls.filter(call => call.sql === 'COMMIT').length, 1);
});

test('reset requires admin confirmation and commits a logged transaction', async () => {
  const pool = fakePool({...base, SELF_EVAL:[{AuditID:'a1'}], SYSTEM_ERROR_LOG:[{ErrorID:'e1'}]});
  await assert.rejects(() => system.resetAllTestData(pool, 'ami', {Role:'AUDITOR'}, 'RESET SEMUA DATA UJI AMI 2026'), error => error.status === 403);
  const result = await system.resetAllTestData(pool, 'ami', admin, 'RESET SEMUA DATA UJI AMI 2026');
  assert.equal(result.totalDeleted, 5);
  assert.equal(pool.data.SELF_EVAL.length, 0);
  assert.equal(pool.calls.filter(call => call.sql === 'BEGIN').length, 1);
  assert.equal(pool.calls.filter(call => call.sql === 'COMMIT').length, 1);
});
