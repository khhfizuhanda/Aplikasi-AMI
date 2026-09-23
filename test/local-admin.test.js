const {test} = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../local-admin');

function fakePool(seed = {}) {
  const data = Object.fromEntries(Object.entries(seed).map(([key, rows]) => [key, rows.map(row => ({...row}))]));
  const calls = [];
  const db = {
    async query(sql, params = []) {
      calls.push({sql, params});
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) return {rows: []};
      const tableMatch = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+"?ami"?\."?([^"\s(]+)"?/i);
      const name = tableMatch && tableMatch[1].replace(/"/g, '');
      if (!name) return {rows: []};
      data[name] ||= [];
      if (/^SELECT \*/i.test(sql)) {
        const where = sql.match(/WHERE\s+"([^"]+)"\s*=\s*\$1/i);
        return {rows: (where ? data[name].filter(row => String(row[where[1]] ?? '') === String(params[0] ?? '')) : data[name]).map(row => ({...row}))};
      }
      if (/SELECT COUNT/i.test(sql)) {
        const where = sql.match(/WHERE\s+"([^"]+)"\s*=\s*\$1/i);
        const count = where ? data[name].filter(row => String(row[where[1]] ?? '') === String(params[0] ?? '')).length : data[name].length;
        return {rows: [{count}]};
      }
      if (/^INSERT/i.test(sql)) {
        const fields = [...sql.matchAll(/"([^"]+)"/g)].map(match => match[1]);
        data[name].push(Object.fromEntries(fields.map((field, index) => [field, params[index]])));
        return {rows: []};
      }
      if (/^UPDATE/i.test(sql)) {
        const fields = [...sql.matchAll(/"([^"]+)"\s*=\s*\$\d+/g)].map(match => match[1]);
        const keyMatch = sql.match(/WHERE\s+"([^"]+)"\s*=\s*\$(\d+)/i);
        if (keyMatch) data[name].filter(row => String(row[keyMatch[1]] ?? '') === String(params[Number(keyMatch[2]) - 1] ?? '')).forEach(row => fields.forEach((field, index) => { row[field] = params[index]; }));
        return {rows: []};
      }
      if (/^DELETE/i.test(sql)) {
        const keyMatch = sql.match(/WHERE\s+"([^"]+)"\s*=\s*\$1/i);
        if (keyMatch) data[name] = data[name].filter(row => String(row[keyMatch[1]] ?? '') !== String(params[0] ?? ''));
        return {rows: []};
      }
      return {rows: []};
    },
    release() {}
  };
  return {data, calls, query: db.query, async connect() { return db; }};
}

const adminUser = {UserID:'admin', Nama:'Admin', Role:'ADMIN_BPM'};
const base = {
  AMI_CYCLE: [{CycleID:'c1', Status:'DRAFT BPM', Active:'false'}],
  AMI_AUDITI: [{AuditID:'a1', CycleID:'c1', AuditiType:'PRODI', AuditiID:'p1', AuditiName:'Prodi 1', Status:'DRAFT BPM'}],
  MASTER_STANDAR: [{StandardID:'s1', ItemCode:'A-01', NamaStandar:'Standar', PernyataanStandar:'Pernyataan', Indikator:'Indikator', StatusStandar:'BERLAKU', Active:'true', Versi:'1.0', TahunBerlakuMulai:'2026'}],
  AMI_STANDARD_ASSIGN: [],
  MASTER_PRODI: [], MASTER_UNIT: [], MASTER_AUDITOR: [], MASTER_PIMPINAN: [],
  USERS: [{UserID:'admin', Username:'admin', Role:'ADMIN_BPM', Active:'true'}, {UserID:'u1', Username:'user', Role:'AUDITI', Active:'true'}],
  SESSIONS: [], SETTINGS: [], AUDIT_LOG: [], SELF_EVAL: [], EVIDENCE: [], DESK_EVAL: [], FINDINGS: [], VISIT: [], FORM2_PROGRAM_KERJA: [], FORM3_CATATAN: [], APPROVAL: [], REPORT_LOG: []
};

test('admin writes use a transaction and preserve cycle/assignment contracts', async () => {
  const pool = fakePool(base);
  const cycle = await admin.saveCycle(pool, 'ami', adminUser, {NamaSiklus:'Siklus 2026', Tahun:'2026'});
  assert.match(cycle.cycleId, /^CYCLE-/);
  const assigned = await admin.assignStandards(pool, 'ami', adminUser, ['a1'], ['s1'], false);
  assert.equal(assigned.inserted, 1);
  assert.equal(pool.data.AMI_STANDARD_ASSIGN.length, 1);
  assert.equal(pool.calls.filter(call => call.sql === 'BEGIN').length, 2);
  await assert.rejects(admin.assignStandards(pool, 'ami', {Role:'AUDITOR'}, ['a1'], ['s1'], false), error => error.status === 403);
});

test('standard content is locked after assignment and password reset excludes bulk admin', async () => {
  const pool = fakePool({...base, AMI_STANDARD_ASSIGN:[{AssignID:'x',AuditID:'a1',StandardID:'s1',Active:'true'}]});
  await assert.rejects(admin.saveStandard(pool, 'ami', adminUser, {StandardID:'s1',ItemCode:'A-01',NamaStandar:'Changed',PernyataanStandar:'Pernyataan',Indikator:'Indikator',StatusStandar:'BERLAKU',TahunBerlakuMulai:'2026'}), /terkunci/);
  const result = await admin.resetUserPasswordsBulk(pool, 'ami', adminUser, {mode:'ALL', password:'password-2026'});
  assert.equal(result.count, 1);
  assert.equal(pool.data.USERS.find(row => row.UserID === 'admin').ForceChangePassword, undefined);
  assert.equal(pool.data.USERS.find(row => row.UserID === 'u1').ForceChangePassword, 'true');
});

test('bulk master import rejects invalid types and reports the source row', async () => {
  const pool = fakePool(base);
  const result = await admin.bulkImportMaster(pool, 'ami', adminUser, 'UNIT', [
    'KodeUnit\tNamaUnit\tJenisUnit\tPimpinan',
    'U1\tUnit Valid\tBIRO\tPimpinan',
    'U2\tUnit Salah\tINVALID\tPimpinan',
    'U1\tUnit Valid\tBIRO\tPimpinan'
  ].join('\n'));
  assert.equal(result.inserted, 1);
  assert.equal(result.skipped, 2);
  assert.match(result.errors[0], /Baris 3/);
  assert.match(result.errors[0], /JenisUnit/);
  assert.match(result.errors[1], /Baris 4/);
});
