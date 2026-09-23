const {test} = require('node:test');
const assert = require('node:assert/strict');
const read = require('../local-read');

const base = {
  MASTER_STANDAR: [
    {StandardID:'s1',StandardFamilyID:'fam1',ItemCode:'A-01',NamaStandar:'Standar A',PernyataanStandar:'Pernyataan',Indikator:'Indikator',Active:'true',StatusStandar:'BERLAKU',Versi:'1.0',TahunBerlakuMulai:'2026'},
    {StandardID:'s2',StandardFamilyID:'fam1',ItemCode:'A-01',NamaStandar:'Standar A lama',Active:'false',StatusStandar:'DRAFT',Versi:'2.0'}
  ],
  AMI_STANDARD_ASSIGN: [{AssignID:'as1',AuditID:'audit1',StandardID:'s1',ItemCode:'A-01',NamaStandar:'Standar A',Active:'true',PernyataanStandarSnapshot:'Pernyataan',IndikatorSnapshot:'Indikator',VersiStandarSnapshot:'1.0'}],
  AMI_AUDITI: [{AuditID:'audit1',CycleID:'cycle1',AuditiType:'PRODI',AuditiID:'prodi1',AuditiName:'Prodi 1',Status:'DRAFT BPM'}],
  AMI_CYCLE: [{CycleID:'cycle1',NamaSiklus:'Siklus 1',Tahun:'2026'}],
  AMI_TEAM: [{TeamID:'team1',AuditID:'audit1',LeadAuditorID:'auditor1'}],
  MASTER_AUDITOR: [{AuditorID:'auditor1',Nama:'Auditor Satu',Unit:'BPM',Sertifikasi:'IYA'}],
  MASTER_PIMPINAN: [],
  USERS: [{UserID:'u1',Username:'admin',Nama:'Admin',Role:'ADMIN_BPM',Active:'true',ForceChangePassword:'false'}],
  SELF_EVAL: [{SelfEvalID:'se1',AuditID:'audit1',AssignID:'as1',Capaian:'MENCAPAI'}],
  EVIDENCE: [], DESK_EVAL: [], FINDINGS: [], SELF_FOLLOW_UP: [], AMI_IMPROVEMENT: [], VISIT: [],
  FORM2_PROGRAM_KERJA: [], FORM3_CATATAN: [], APPROVAL: [], REPORT_LOG: []
};

function fakePool(data = base) {
  return {query: async sql => {
    const match = sql.match(/\.\"([^\"]+)\"/);
    return {rows: (data[match ? match[1] : ''] || []).map(row => ({...row}))};
  }};
}
const admin = {Role:'ADMIN_BPM',UserID:'u1'};

 test('admin standard reads include usage metadata and version history', async () => {
  const pool = fakePool();
  const rows = await read.listStandardsAdmin(pool, 'ami', admin, {});
  assert.equal(rows[0].UsageTotal, 1);
  assert.equal(rows[0].Locked, true);
  assert.equal(rows[0].CanEditContent, false);
  assert.deepEqual((await read.getStandardVersions(pool, 'ami', admin, 's1')).map(row => row.Versi), ['1.0', '2.0']);
  assert.equal((await read.listStandards(pool, 'ami', admin, {})).length, 1);
});

test('read layer enforces admin-only contracts', async () => {
  await assert.rejects(read.listUsers(fakePool(), 'ami', {Role:'AUDITOR'}), error => error.status === 403);
  await assert.rejects(read.listStandards(fakePool(), 'ami', {Role:'AUDITI'}), error => error.status === 403);
});

test('accessible audits are scoped to the logged-in role', async () => {
  const pool = fakePool();
  const rows = await read.getAccessibleAudits(pool, 'ami', {Role:'AUDITI',RefType:'PRODI',RefID:'prodi1'});
  assert.deepEqual(rows.map(row => row.AuditID), ['audit1']);
  assert.equal(rows[0].StandardCount, 1);
  assert.equal(rows[0].SelfDone, 1);
  assert.deepEqual(await read.getAccessibleAudits(pool, 'ami', {Role:'AUDITOR',RefID:'other'}), []);
});

test('cycle audits and workspace preserve UI response shapes', async () => {
  const pool = fakePool();
  const audits = await read.listCycleAudits(pool, 'ami', admin, 'cycle1');
  assert.equal(audits[0].StandardCount, 1);
  assert.equal(audits[0].CanEditAssignment, false);
  assert.equal(audits[0].AssignmentStarted, true);
  const workspace = await read.getAuditWorkspace(pool, 'ami', {Role:'AUDITOR',RefID:'auditor1'}, 'audit1');
  assert.equal(workspace.audit.AuditID, 'audit1');
  assert.equal(workspace.assigned[0].standard.ItemCode, 'A-01');
  assert.equal(workspace.team.Lead.nama, 'Auditor Satu');
  assert.equal(workspace.permissions.isLead, true);
  await assert.rejects(read.getAuditWorkspace(pool, 'ami', {Role:'AUDITI',RefType:'PRODI',RefID:'other'}, 'audit1'), error => error.status === 403);
});
