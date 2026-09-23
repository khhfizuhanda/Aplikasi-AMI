const {test} = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const {validateImportXlsx, commitImportXlsx, cancelImportXlsx} = require('../local-import-export');

const user = {UserID:'u1', Nama:'Admin', Role:'ADMIN_BPM'};
const pool = {query: async () => ({rows: []})};

function fakePool(seed = {}) {
  const state = {...seed};
  const query = async (sql, args = []) => {
    const select = sql.match(/SELECT \* FROM "ami"\."([^"]+)"/);
    if (select) return {rows: state[select[1]] || []};
    const insert = sql.match(/INSERT INTO "ami"\."([^"]+)" \((.*?)\)/);
    if (insert) {
      const fields = [...insert[2].matchAll(/"([^"]+)"/g)].map(match => match[1]);
      (state[insert[1]] ||= []).push(Object.fromEntries(fields.map((field, index) => [field, args[index]])));
      return {rows: []};
    }
    const update = sql.match(/UPDATE "ami"\."([^"]+)" SET (.*?) WHERE (.*)$/);
    if (update) {
      const fields = [...update[2].matchAll(/"([^"]+)"=\$(\d+)/g)].map(match => [match[1], Number(match[2])]);
      const keys = [...update[3].matchAll(/"([^"]+)"=\$(\d+)/g)].map(match => [match[1], Number(match[2])]);
      const row = (state[update[1]] || []).find(item => keys.every(([field, index]) => String(item[field] ?? '') === String(args[index - 1] ?? '')));
      if (row) fields.forEach(([field, index]) => { row[field] = args[index - 1]; });
      return {rows: []};
    }
    return {rows: []};
  };
  return {state, query, connect: async () => ({query, release() {}})};
}

function workbook(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'DATA');
  return XLSX.write(book, {type:'base64', bookType:'xlsx'});
}

test('validateImportXlsx returns preview, counts, and an in-memory token', async () => {
  const base64 = workbook([
    ['KodeProdi','NamaProdi','Fakultas','Jenjang','Kaprodi','NIDN','Active'],
    ['TI','Teknik Informatika','Teknik','S1','Dr A','123','IYA'],
    ['SI','','Ekonomi','S1','','456','IYA']
  ]);
  const result = await validateImportXlsx(pool, 'ami', user, 'MASTER_PRODI', {}, 'master.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64);
  assert.equal(result.module, 'MASTER_PRODI');
  assert.equal(result.total, 2);
  assert.equal(result.valid, 1);
  assert.equal(result.invalid, 1);
  assert.equal(result.preview[0].ok, true);
  assert.equal(result.preview[1].ok, false);
  assert.ok(result.importToken);
  assert.deepEqual(cancelImportXlsx(user, result.importToken), {ok:true});
});

test('validateImportXlsx rejects a workbook with missing headers', async () => {
  await assert.rejects(
    validateImportXlsx(pool, 'ami', user, 'MASTER_PRODI', {}, 'bad.xlsx', '', workbook([['NamaProdi'], ['Only name']])),
    /Header XLSX kurang/
  );
});

test('validateImportXlsx rejects invalid master enums and Active values', async () => {
  const result = await validateImportXlsx(pool, 'ami', user, 'MASTER_UNIT', {}, 'bad-types.xlsx', '', workbook([
    ['KodeUnit','NamaUnit','JenisUnit','Pimpinan','Active'],
    ['U1','Unit Salah','INVALID','Pimpinan','MUNGKIN']
  ]));
  assert.equal(result.valid, 0);
  assert.equal(result.invalid, 1);
  assert.match(result.errors[0], /JenisUnit/);
  assert.match(result.errors[0], /Active/);
});

test('commitImportXlsx persists FORM2 JSON and resolves DESK_EVALUATION assignment', async () => {
  const seed = {
    AMI_AUDITI: [{AuditID:'a1', CycleID:'c1', AuditiType:'PRODI', AuditiID:'TI', AuditiName:'Teknik Informatika'}],
    AMI_TEAM: [{AuditID:'a1', LeadAuditorID:'aud1'}],
    AMI_STANDARD_ASSIGN: [{AssignID:'as1', AuditID:'a1', StandardID:'st1', ItemCode:'STD-1', VersiStandarSnapshot:'2.0', Active:'IYA', PernyataanStandarSnapshot:'Pernyataan'}],
    MASTER_STANDAR: [{StandardID:'st1', ItemCode:'STD-1', Versi:'2.0', NamaStandar:'Standar 1', PernyataanStandar:'Pernyataan', Indikator:'Indikator'}]
  };
  const testPool = fakePool(seed);
  const form2 = await validateImportXlsx(testPool, 'ami', {UserID:'u2', Nama:'Auditor', Role:'AUDITOR', RefID:'aud1'}, 'FORM2', {auditId:'a1'}, 'form2.xlsx', '', workbook([
    MODULE_HEADERS.FORM2,
    ['1','STD-1','Standar 1','Objektif','Tujuan','1','Periksa dokumen','2 jam','1','Selesai','AB'],
    ['1','STD-1','Standar 1','Objektif','Tujuan','2','Wawancara','1 jam','2','Selesai','CD']
  ]));
  const formResult = await commitImportXlsx(testPool, 'ami', {UserID:'u2', Nama:'Auditor', Role:'AUDITOR', RefID:'aud1'}, form2.importToken);
  assert.equal(formResult.imported, 1);
  assert.equal(JSON.parse(testPool.state.FORM2_PROGRAM_KERJA[0].LangkahJSON)[0].langkahKerja.length, 2);

  const desk = await validateImportXlsx(testPool, 'ami', {UserID:'u2', Nama:'Auditor', Role:'AUDITOR', RefID:'aud1'}, 'DESK_EVALUATION', {auditId:'a1'}, 'desk.xlsx', '', workbook([
    MODULE_HEADERS.DESK_EVALUATION,
    ['STD-1','2.0','Standar 1','Pernyataan','Indikator','','','','','','','','','','','','','','','DITERIMA','Catatan','TIDAK']
  ]));
  const deskResult = await commitImportXlsx(testPool, 'ami', {UserID:'u2', Nama:'Auditor', Role:'AUDITOR', RefID:'aud1'}, desk.importToken);
  assert.equal(deskResult.imported, 1);
  assert.equal(testPool.state.DESK_EVAL[0].AssignID, 'as1');
});

const MODULE_HEADERS = {
  FORM2: ['ProgramNo','NomorStandar','NamaStandar','TentatifAuditObjektif','TujuanAudit','LangkahNo','UraianLangkah','Estimasi','NoPernyataan','Realisasi','InisialAuditor'],
  DESK_EVALUATION: ['ItemCode','VersiStandar','NamaStandar','PernyataanStandar','Indikator','CapaianAuditi','NilaiAktualAuditi','EvaluasiDiriAuditi','AkibatAuditi','AkarPenyebabAuditi','TanggapanAuditiAwal','RencanaPerbaikanAwal','JadwalPerbaikanAwal','PJPerbaikanAwal','RencanaPencegahanAwal','JadwalPencegahanAwal','PJPencegahanAwal','FaktorPendukungAuditi','RekomendasiPeningkatanAuditi','StatusDesk','CatatanDesk','ButuhVisitasi']
};
