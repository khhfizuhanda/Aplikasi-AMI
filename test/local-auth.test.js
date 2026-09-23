const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {app, pool} = require('../server');
const hash = (password, salt) => crypto.createHash('sha256').update(`${salt}|${password}`).digest('hex');
const user = {UserID:'test-admin',Username:'admin',Nama:'Test Admin',Role:'ADMIN_BPM',
  Salt:'test-salt',PasswordHash:hash('test-password','test-salt'),Active:'true',ForceChangePassword:'false'};
const sessions = new Map();
let unavailable = false;
// An isolated database double; these tests never create or alter real accounts.
pool.query = async (sql, args = []) => {
  if (unavailable) throw new Error('Database test unavailable');
  if (sql.includes('INSERT INTO') && sql.includes('"SESSIONS"')) {
    sessions.set(args[0], {Token:args[0],UserID:args[1],ExpiresAt:args[2],ResumeKey:args[4]});
    return {rows:[]};
  }
  if (sql.includes('JOIN') && sql.includes('"SESSIONS"')) {
    const session = [...sessions.values()].find(s => sql.includes('s."ResumeKey" =') ? s.ResumeKey === args[0] : s.Token === args[0]);
    return {rows:session ? [{...user,...session}] : []};
  }
  if (sql.includes('DELETE FROM') && sql.includes('"SESSIONS"')) { sessions.delete(args[0]); return {rows:[]}; }
  if (sql.includes('lower("Username")')) return {rows:args[0] === user.Username ? [user] : []};
  if (sql.startsWith('SELECT * FROM')) return {rows:[]};
  throw new Error('Unexpected test query: ' + sql);
};
const server = app.listen(0, '127.0.0.1');
after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });
async function post(url, body) {
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  return {status:response.status,body:await response.json()};
}
test('login, dashboard, resume, logout and rejected credentials', async () => {
  assert.equal((await post('/api/auth/login',{username:'admin',password:'wrong'})).status,401);
  const login = await post('/api/auth/login',{username:'admin',password:'test-password'});
  assert.equal(login.status,200);
  assert.equal(login.body.user.userId,user.UserID);
  assert.ok(sessions.has(login.body.token));
  const bootstrap = await post('/api/rpc/getBootstrap',{args:[login.body.token]});
  assert.equal(bootstrap.status,200);
  assert.equal(bootstrap.body.bootstrapOk,true);
  assert.equal(bootstrap.body.user.role,'ADMIN_BPM');
  assert.deepEqual(bootstrap.body.warnings,[]);
  const catalog = await post('/api/rpc/getImportExportCatalog',{args:[login.body.token]});
  assert.equal(catalog.status,200);
  assert.equal(catalog.body.role,'ADMIN_BPM');
  assert.ok(catalog.body.modules.some(m => m.key === 'MASTER_PRODI' && m.canImport));
  const masters = await post('/api/rpc/listMaster',{args:[login.body.token,'PRODI']});
  assert.equal(masters.status,200);
  assert.deepEqual(masters.body,[]);
  assert.equal((await post('/api/rpc/listMaster',{args:[login.body.token,'UNKNOWN']})).status,503);
  assert.equal((await post('/api/rpc/getImportExportCatalog',{args:['invalid-token']})).status,401);
  assert.equal((await post('/api/rpc/resumeSession',{args:[login.body.resumeKey]})).body.token,login.body.token);
  assert.equal((await post('/api/rpc/getBootstrap',{args:['invalid-token']})).status,401);
  assert.equal((await post('/api/rpc/logout',{args:[login.body.token]})).status,200);
  assert.equal((await post('/api/rpc/getBootstrap',{args:[login.body.token]})).status,401);
  assert.equal((await post('/api/rpc/getImportExportCatalog',{args:[login.body.token]})).status,401);
  assert.equal((await post('/api/rpc/resumeSession',{args:[login.body.resumeKey]})).status,401);
});
test('database outage returns JSON instead of dropping the connection', async () => {
  unavailable = true;
  try {
    const result = await post('/api/auth/login',{username:'admin',password:'test-password'});
    assert.equal(result.status,503);
    assert.match(result.body.error,/unavailable/);
  } finally { unavailable = false; }
});
test('HTML is rendered on both entry paths; source and environment are not served', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/?view=login','/Index.html?view=login']) {
    const response = await fetch(base + route);
    const html = await response.text();
    assert.equal(response.status,200);
    assert.match(html,/window.AMI_LOCAL_BACKEND = true/);
    assert.doesNotMatch(html,/<\?[!=]/);
  }
  for (const route of ['/server.js','/.env','/postgres/schema.sql']) assert.equal((await fetch(base + route)).status,404);
});
