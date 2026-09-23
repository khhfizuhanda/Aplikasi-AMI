const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {stripTypeScriptTypes} = require('node:module');

async function api(seed, failTable) {
  const helpers = await import('../supabase/functions/ami-api/access.mjs');
  const data = structuredClone(seed);
  const client = {from(table) {
    data[table] ||= [];
    let operation = 'select', payload, filters = [];
    const query = {
      select() {return this;}, limit() {return this;},
      eq(key, value) {filters.push(row => row[key] === value); return this;},
      update(value) {operation = 'update'; payload = value; return this;},
      insert(value) {operation = 'insert'; payload = value; return this;},
      then(resolve) {
        if (table === failTable && operation !== 'select') return Promise.resolve({error:{message:'write failed'}}).then(resolve);
        const rows = data[table].filter(row => filters.every(filter => filter(row)));
        if (operation === 'insert') data[table].push(payload);
        if (operation === 'update') rows.forEach(row => Object.assign(row, payload));
        return Promise.resolve({data: rows, error:null}).then(resolve);
      }
    };
    return query;
  }};
  let source = readFileSync('supabase/functions/ami-api/index.ts', 'utf8');
  source = source.replace(/^import .*\r?\n/gm, '').replace(/const supabase = createClient\([\s\S]*?\n\);/, '');
  source = source.slice(0, source.indexOf('Deno.serve('));
  const funcs = new Function('supabase', ...Object.keys(helpers), stripTypeScriptTypes(source) + '\nreturn {readRpc, writeRpc, saveRow};')(client, ...Object.values(helpers));
  return {...funcs, data};
}
const audit = {AuditID:'a1', AuditiType:'PRODI', AuditiID:'p1', Fakultas:'Teknik'};
const seed = {AMI_AUDITI:[audit,{...audit,AuditID:'a2',AuditiID:'p2',Fakultas:'Ekonomi'}], AMI_TEAM:[{AuditID:'a1',LeadAuditorID:'au1'}], MASTER_PIMPINAN:[{PimpinanID:'pim1',Active:'true',Level:'FAKULTAS',AccessName:'Teknik'}]};
test('Edge access is consistent across list, dashboard, catalog and workspace for all roles', async () => {
  const app = await api(seed);
  for (const [user, expected] of [[{Role:'ADMIN_BPM'},2],[{Role:'AUDITI',RefType:'PRODI',RefID:'p1'},1],[{Role:'AUDITOR',RefID:'au1'},1],[{Role:'PIMPINAN',RefID:'pim1'},1],[{Role:'AUDITOR',RefID:''},0],[{Role:'PIMPINAN',RefID:'missing'},0]]) {
    assert.equal((await (await app.readRpc('getAccessibleAudits', [], user)).json()).length, expected);
    assert.equal((await (await app.readRpc('getExecutiveDashboard', [], user)).json()).totalAudits, expected);
    assert.equal((await (await app.readRpc('getImportExportCatalog', [], user)).json()).audits.length, expected);
    assert.equal((await app.readRpc('getAuditWorkspace', ['', 'a2'], user)).status, expected === 2 ? 200 : 403);
  }
});
test('Edge workspace exposes snapshots, named team, approvals and reports', async () => {
  const app = await api({...seed, AMI_STANDARD_ASSIGN:[{AuditID:'a1',AssignID:'as1',StandardID:'s1',Active:'true',IndikatorSnapshot:'Snapshot'}], MASTER_AUDITOR:[{AuditorID:'au1',Nama:'Auditor'}], APPROVAL:[{AuditID:'a1',Stage:'BPM',Approved:'true'}], REPORT_LOG:[{AuditID:'a1',ReportID:'r1'}]});
  const result = await (await app.readRpc('getAuditWorkspace',['','a1'],{Role:'AUDITOR',RefID:'au1'})).json();
  assert.equal(result.assigned[0].standard.Indikator,'Snapshot');
  assert.equal(result.team.Lead.nama,'Auditor');
  assert.equal(result.permissions.isLead,true);
  assert.ok(result.approvals.BPM);
  assert.equal(result.reports.length,1);
});
test('Edge writes reject another audit and composite updates affect only one assignment', async () => {
  const app = await api({...seed, SELF_EVAL:[{SelfEvalID:'s1',AuditID:'a1',AssignID:'as1'},{SelfEvalID:'s2',AuditID:'a1',AssignID:'as2'}]});
  assert.equal((await app.writeRpc('saveAllDeskEvaluation',['','a2',[]],{Role:'AUDITOR',RefID:'au1'})).status,403);
  await app.saveRow('SELF_EVAL',['AuditID','AssignID'],{SelfEvalID:'new',AuditID:'a1',AssignID:'as1',Capaian:'MENCAPAI'});
  assert.equal(app.data.SELF_EVAL[0].SelfEvalID,'s1');
  assert.equal(app.data.SELF_EVAL[1].Capaian,undefined);
});
test('Edge auditi creation surfaces database write failures', async () => {
  const app = await api({AMI_CYCLE:[{CycleID:'c1'}],MASTER_PRODI:[{ProdiID:'p1',Active:'true'}]},'AMI_AUDITI');
  await assert.rejects(app.writeRpc('createAuditiFromMaster',['','c1',{mode:'ALL_PRODI'}],{Role:'ADMIN_BPM'}), /write failed/);
});
test('Edge sync handles username collisions and preserves existing password state', async () => {
  const app = await api({USERS:[{UserID:'u1',Username:'kept',RefType:'PRODI',RefID:'p1',ForceChangePassword:false}],MASTER_PRODI:[{ProdiID:'p1',KodeProdi:'same',Active:true},{ProdiID:'p2',KodeProdi:'same',Active:true}],MASTER_UNIT:[{UnitID:'u2',KodeUnit:'same',Active:true}]});
  await app.writeRpc('syncUsersFromMasters',[],{Role:'ADMIN_BPM'});
  assert.deepEqual(app.data.USERS.map(row=>row.Username),['kept','same','same.1']);
  assert.equal(app.data.USERS[0].ForceChangePassword,false);
});

test('Edge write rejects foreign assignments and submit cannot claim false success', async () => {
  const app = await api({...seed,AMI_STANDARD_ASSIGN:[{AuditID:'a2',AssignID:'foreign',StandardID:'s2',Active:'true'}]});
  const user = {Role:'AUDITI',RefType:'PRODI',RefID:'p1'};
  assert.equal((await app.writeRpc('saveAllSelfEvaluation',['','a1',[{AssignID:'foreign'}]],user)).status,400);
  assert.equal((await app.writeRpc('submitSelfEvaluation',['','a1'],user)).status,501);
});
