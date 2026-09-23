const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readDashboard} = require('../local-dashboard');

const data = {
  AMI_AUDITI: [
    {AuditID:'a1',AuditiID:'p1',AuditiType:'PRODI',AuditiName:'Prodi 1',CycleID:'c1'},
    {AuditID:'a2',AuditiID:'p2',AuditiType:'PRODI',AuditiName:'Prodi 2',CycleID:'c1'}
  ],
  AMI_CYCLE: [{CycleID:'c1',NamaSiklus:'Siklus 1'}],
  AMI_TEAM: [{AuditID:'a2',LeadAuditorID:'lead',Member1ID:'member',Member2ID:'other'}],
  MASTER_PIMPINAN: [{PimpinanID:'leader',Active:'true',Level:'PRODI',AccessID:'p1'}],
  MASTER_PRODI: [{ProdiID:'p1',NamaProdi:'Prodi 1'}]
};
const pool = {query:async sql => ({rows:data[sql.match(/\."([^"]+)"$/)[1]] || []})};
const catalog = (Role,RefID,RefType='PRODI') => readDashboard(pool,'ami','getImportExportCatalog',{Role,RefID,RefType});

test('admin catalog includes cycles and all audits with original module permissions', async () => {
  const result = await catalog('ADMIN_BPM');
  assert.deepEqual(result.audits.map(a=>a.AuditID),['a1','a2']);
  assert.equal(result.cycles[0].CycleID,'c1');
  assert.ok(result.modules.find(m=>m.key==='MASTER_PRODI').canImport);
  assert.equal(result.modules.find(m=>m.key==='AUDIT_LOG').canImport,false);
  assert.equal(result.modules.find(m=>m.key==='EVALUASI_DIRI').canImport,false);
});

test('auditi and auditor catalogs restrict audits and import permissions', async () => {
  for (const [role,ref,expected,module] of [
    ['AUDITI','p1','a1','EVALUASI_DIRI'],
    ['AUDITOR','lead','a2','DESK_EVALUATION'],
    ['AUDITOR','member','a2','DESK_EVALUATION']
  ]) {
    const result = await catalog(role,ref);
    assert.deepEqual(result.audits.map(a=>a.AuditID),[expected]);
    assert.deepEqual(result.cycles,[]);
    assert.ok(result.modules.find(m=>m.key===module).canImport);
    assert.ok(!result.modules.some(m=>m.key==='MASTER_PRODI'));
  }
  assert.deepEqual((await catalog('AUDITOR','unassigned')).audits,[]);
});

test('pimpinan catalog respects profile scope and is export only', async () => {
  const result = await catalog('PIMPINAN','leader');
  assert.deepEqual(result.audits.map(a=>a.AuditID),['a1']);
  assert.ok(result.modules.every(m=>!m.canImport));
  assert.deepEqual((await catalog('PIMPINAN','unknown')).audits,[]);
});
