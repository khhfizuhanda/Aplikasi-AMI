const {test} = require('node:test');
const assert = require('node:assert/strict');
const workflow = require('../local-workflow');

function fakePool(seed) {
  const data = Object.fromEntries(Object.entries(seed).map(([key, rows]) => [key, rows.map(row => ({...row}))]));
  const calls = [];
  const db = {async query(sql, params = []) {
    calls.push({sql, params});
    if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) return {rows: []};
    const match = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+"?ami"?\."?([^"\s(]+)"?/i);
    const name = match && match[1].replace(/"/g, '');
    if (!name) return {rows: []};
    data[name] ||= [];
    if (/^SELECT \*/i.test(sql)) {
      const where = sql.match(/WHERE\s+"([^"]+)"\s*=\s*\$1/i);
      return {rows: (where ? data[name].filter(row => String(row[where[1]] ?? '') === String(params[0] ?? '')) : data[name]).map(row => ({...row}))};
    }
    if (/^INSERT/i.test(sql)) {
      const fields = [...(sql.match(/\(([^)]+)\)\s*VALUES/i) || ['', ''])[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
      data[name].push(Object.fromEntries(fields.map((field, index) => [field, params[index]])));
      return {rows: []};
    }
    if (/^UPDATE/i.test(sql)) {
      const fields = [...sql.matchAll(/"([^"]+)"\s*=\s*\$\d+/g)].map(match => match[1]);
      const key = sql.match(/WHERE\s+"([^"]+)"\s*=\s*\$(\d+)/i);
      if (key) data[name].filter(row => String(row[key[1]] ?? '') === String(params[Number(key[2]) - 1] ?? '')).forEach(row => fields.forEach((field, index) => { row[field] = params[index]; }));
      return {rows: []};
    }
    if (/^DELETE/i.test(sql)) {
      const key = sql.match(/WHERE\s+"([^"]+)"\s*=\s*\$1/i);
      if (key) data[name] = data[name].filter(row => String(row[key[1]] ?? '') !== String(params[0] ?? ''));
    }
    return {rows: []};
  }, release() {}};
  return {data, calls, query: db.query, async connect() { return db; }};
}

const seed = {
  AMI_AUDITI: [{AuditID:'a1', AuditiType:'PRODI', AuditiID:'p1', Status:'PENUGASAN DITERBITKAN'}],
  AMI_STANDARD_ASSIGN: [{AssignID:'as1', AuditID:'a1', StandardID:'s1', ItemCode:'A-01', PernyataanStandarSnapshot:'Kriteria', Active:'true'}],
  AMI_TEAM: [{AuditID:'a1', LeadAuditorID:'aud1'}],
  SELF_EVAL: [], SELF_FOLLOW_UP: [], AMI_IMPROVEMENT: [], EVIDENCE: [], DESK_EVAL: [], FINDINGS: [], VISIT: [], FORM2_PROGRAM_KERJA: [], FORM3_CATATAN: [], APPROVAL: [], AUDIT_LOG: [], MASTER_PIMPINAN: []
};

test('auditi batch save persists self evaluation, follow-up, improvement, and advances status', async () => {
  const pool = fakePool(seed);
  const result = await workflow.saveAllSelfEvaluation(pool, 'ami', {UserID:'u1', Nama:'Auditi', Role:'AUDITI', RefType:'PRODI', RefID:'p1'}, 'a1', [{AssignID:'as1', Capaian:'MENCAPAI', NilaiCapaian:'90%', EvaluasiDiri:'Baik', FaktorPendukung:'Dokumen lengkap', RekomendasiPeningkatanIndikator:'Pertahankan'}]);
  assert.equal(result.saved, 1);
  assert.equal(pool.data.SELF_EVAL[0].Capaian, 'MENCAPAI');
  assert.equal(pool.data.AMI_IMPROVEMENT[0].Status, 'DRAFT AUDITI');
  assert.equal(pool.data.AMI_AUDITI[0].Status, 'EVALUASI DIRI BERJALAN');
});

test('auditor desk save seeds findings and transitions after submitted self evaluation', async () => {
  const pool = fakePool({...seed, AMI_AUDITI:[{AuditID:'a1', AuditiType:'PRODI', AuditiID:'p1', Status:'EVALUASI DIRI DIKIRIM'}], SELF_EVAL:[{SelfEvalID:'se1', AuditID:'a1', AssignID:'as1', StandardID:'s1', Capaian:'MENCAPAI', EvaluasiDiri:'Baik'}]});
  const result = await workflow.saveAllDeskEvaluation(pool, 'ami', {UserID:'aud', Nama:'Auditor', Role:'AUDITOR', RefID:'aud1'}, 'a1', [{AssignID:'as1', StatusDesk:'SESUAI', ButuhVisitasi:false, CatatanDesk:''}]);
  assert.equal(result.autoAssessed, 1);
  assert.equal(pool.data.FINDINGS[0].Kategori, 'MENCAPAI');
  assert.equal(pool.data.AMI_AUDITI[0].Status, 'DESK EVALUATION');
});

test('evidence deletion is scoped to the owning auditi and updates count', async () => {
  const pool = fakePool({...seed, AMI_AUDITI:[{AuditID:'a1', AuditiType:'PRODI', AuditiID:'p1', Status:'EVALUASI DIRI BERJALAN'}], SELF_EVAL:[{SelfEvalID:'se1', AuditID:'a1', AssignID:'as1', StandardID:'s1', BuktiCount:'1'}], EVIDENCE:[{EvidenceID:'ev1', SelfEvalID:'se1', AuditID:'a1', StandardID:'s1', JenisBukti:'LINK', URL:'https://example.test'}]});
  const result = await workflow.deleteEvidence(pool, 'ami', {UserID:'u1', Nama:'Auditi', Role:'AUDITI', RefType:'PRODI', RefID:'p1'}, 'ev1');
  assert.equal(result.ok, true);
  assert.equal(pool.data.EVIDENCE.length, 0);
  assert.equal(pool.data.SELF_EVAL[0].BuktiCount, '0');
  await assert.rejects(workflow.deleteEvidence(pool, 'ami', {Role:'AUDITOR', RefID:'other'}, 'ev1'), /Role Anda/);
});
