import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? 'https://iabubetffbzsjestjqxp.supabase.co',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { db: { schema: 'ami' } },
);

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://khhfizuhanda.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}|${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function publicUser(user: Record<string, unknown>) {
  return {
    userId: user.UserID,
    username: user.Username,
    nama: user.Nama,
    role: user.Role,
    refType: user.RefType || '',
    refId: user.RefID || '',
    forceChangePassword: String(user.ForceChangePassword).toLowerCase() === 'true',
  };
}

const masterTables: Record<string, string> = {
  PRODI: 'MASTER_PRODI',
  UNIT: 'MASTER_UNIT',
  AUDITOR: 'MASTER_AUDITOR',
  PIMPINAN: 'MASTER_PIMPINAN',
};

const clean = (value: unknown) => String(value ?? '').trim();
const truthy = (value: unknown) => value === true || ['true', '1', 'yes'].includes(clean(value).toLowerCase());

function requireAdmin(user: Record<string, unknown>) {
  if (user.Role !== 'ADMIN_BPM') return response({ error: 'Hanya Admin BPM yang dapat mengakses data ini.' }, 403);
  return null;
}

async function tableRows(table: string) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(error.message);
  return data || [];
}

function filterStandards(rows: Record<string, unknown>[], filters: Record<string, unknown> = {}, adminMode = false) {
  let result = rows.filter(row => adminMode || (truthy(row.Active) && (!clean(row.StatusStandar) || clean(row.StatusStandar).toUpperCase() === 'BERLAKU')));
  const status = clean(filters.status).toUpperCase();
  const group = clean(filters.kelompok);
  const year = Number(filters.tahun) || 0;
  const query = clean(filters.q).toLowerCase();
  if (status) result = result.filter(row => clean(row.StatusStandar).toUpperCase() === status);
  if (group) result = result.filter(row => clean(row.Kelompok) === group);
  if (year) result = result.filter(row => (!Number(row.TahunBerlakuMulai) || year >= Number(row.TahunBerlakuMulai)) && (!Number(row.TahunBerlakuSampai) || year <= Number(row.TahunBerlakuSampai)));
  if (query) result = result.filter(row => [row.ItemCode, row.NamaStandar, row.PernyataanStandar, row.Indikator, row.SumberFile, row.Versi].some(value => clean(value).toLowerCase().includes(query)));
  return result.sort((left, right) => clean(left.ItemCode).localeCompare(clean(right.ItemCode)) || clean(left.Versi).localeCompare(clean(right.Versi), undefined, {numeric: true}));
}

async function readRpc(name: string, args: unknown[], user: Record<string, unknown>) {
  if (name === 'getBootstrap' || name === 'getExecutiveDashboard') {
    const [cycles, audits, standards, prodi, unit, auditors, pimpinan, assignments] = await Promise.all([
      tableRows('AMI_CYCLE'), tableRows('AMI_AUDITI'), tableRows('MASTER_STANDAR'), tableRows('MASTER_PRODI'),
      tableRows('MASTER_UNIT'), tableRows('MASTER_AUDITOR'), tableRows('MASTER_PIMPINAN'), tableRows('AMI_STANDARD_ASSIGN'),
    ]);
    const visibleAudits = user.Role === 'ADMIN_BPM'
      ? audits
      : audits.filter(row => user.Role === 'AUDITI' && clean(row.AuditiType) === clean(user.RefType) && clean(row.AuditiID) === clean(user.RefID));
    const dashboard = {
      activeCycleId: clean(cycles.find(row => truthy(row.Active))?.CycleID),
      totalAudits: visibleAudits.length,
      finalAudits: visibleAudits.filter(row => clean(row.Status).toUpperCase() === 'FINAL').length,
      averageProgress: 0,
      standardCount: standards.filter(row => truthy(row.Active)).length,
      prodiCount: prodi.filter(row => truthy(row.Active)).length,
      auditorCount: auditors.filter(row => truthy(row.Active)).length,
      statusCounts: Object.fromEntries([...new Set(visibleAudits.map(row => clean(row.Status)))].map(status => [status, visibleAudits.filter(row => clean(row.Status) === status).length])),
      findingCounts: {MENYIMPANG: 0, 'BELUM MENCAPAI': 0, MENCAPAI: 0, MELAMPAUI: 0},
      resultTotal: 0, fulfilledTotal: 0, overallFulfillmentPct: 0,
      auditRows: visibleAudits.map(row => ({...row, StandardCount: assignments.filter(item => clean(item.AuditID) === clean(row.AuditID) && truthy(item.Active)).length})),
      prodiResults: [], standardPerformance: [], reports: 0,
    };
    if (name === 'getExecutiveDashboard') return response(dashboard);
    return response({
      user: publicUser(user),
      app: {appName: 'Sistem Audit Mutu Internal (AMI) 2026', orgName: 'Universitas Medan Area', unitName: 'Biro Penjaminan Mutu', version: '1.6.2-supabase'},
      dashboard,
      selections: {cycles, prodi, unit, auditors, pimpinan},
      warnings: [],
      bootstrapOk: true,
    });
  }
  if (name === 'getImportExportCatalog') return response([]);
  const adminOnly = ['listMaster', 'listStandardsAdmin', 'listStandards', 'getStandardVersions', 'listUsers', 'listCycles', 'listCycleAudits'];
  if (adminOnly.includes(name)) {
    const denied = requireAdmin(user);
    if (denied) return denied;
  }
  if (name === 'listMaster') {
    const table = masterTables[clean(args[1]).toUpperCase()];
    if (!table) return response({ error: 'Jenis master tidak dikenali.' }, 400);
    return response(await tableRows(table));
  }
  if (name === 'listUsers') {
    return response((await tableRows('USERS')).map(row => ({UserID: row.UserID, Username: row.Username, Nama: row.Nama, Role: row.Role, RefType: row.RefType, RefID: row.RefID, Active: truthy(row.Active), ForceChangePassword: truthy(row.ForceChangePassword), LastLogin: row.LastLogin || ''})));
  }
  if (name === 'listCycles') return response(await tableRows('AMI_CYCLE'));
  if (name === 'listStandards' || name === 'listStandardsAdmin') return response(filterStandards(await tableRows('MASTER_STANDAR'), (args[1] || {}) as Record<string, unknown>, name === 'listStandardsAdmin'));
  if (name === 'getStandardVersions') {
    const rows = await tableRows('MASTER_STANDAR');
    const selected = rows.find(row => clean(row.StandardID) === clean(args[1]));
    if (!selected) return response({ error: 'Standar tidak ditemukan.' }, 404);
    const family = clean(selected.StandardFamilyID) || `STDFAM-${clean(selected.StandardID)}`;
    return response(rows.filter(row => (clean(row.StandardFamilyID) || `STDFAM-${clean(row.StandardID)}`) === family));
  }
  if (name === 'listCycleAudits') {
    const audits = await tableRows('AMI_AUDITI');
    const assignments = await tableRows('AMI_STANDARD_ASSIGN');
    return response(audits.filter(row => clean(row.CycleID) === clean(args[1])).map(row => ({...row, StandardCount: assignments.filter(item => clean(item.AuditID) === clean(row.AuditID) && truthy(item.Active)).length})));
  }
  if (name === 'getAccessibleAudits') {
    const audits = await tableRows('AMI_AUDITI');
    const assignments = await tableRows('AMI_STANDARD_ASSIGN');
    if (user.Role === 'ADMIN_BPM') return response(audits.map(row => ({...row, StandardCount: assignments.filter(item => clean(item.AuditID) === clean(row.AuditID) && truthy(item.Active)).length})));
    return response(audits.filter(row => user.Role === 'AUDITI' && clean(row.AuditiType) === clean(user.RefType) && clean(row.AuditiID) === clean(user.RefID)));
  }
  return null;
}

async function getSession(token: string, column = 'Token') {
  const { data: sessionData, error: sessionError } = await supabase
    .from('SESSIONS')
    .select('*')
    .eq(column, token)
    .maybeSingle();
  if (sessionError || !sessionData || Date.parse(String(sessionData.ExpiresAt)) <= Date.now()) {
    return null;
  }
  const { data: user, error: userError } = await supabase
    .from('USERS')
    .select('*')
    .eq('UserID', sessionData.UserID)
    .maybeSingle();
  if (userError || !user || String(user.Active).toLowerCase() !== 'true') return null;
  return { session: sessionData, user: user as Record<string, unknown> };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const functionIndex = pathSegments.lastIndexOf('ami-api');
  const route = (functionIndex >= 0 ? pathSegments.slice(functionIndex + 1) : pathSegments).join('/');

  try {
    if (request.method === 'GET' && route === 'health') {
      const { error } = await supabase.from('SETTINGS').select('Key').limit(1);
      return response({ ok: !error, database: 'supabase', schema: 'ami', error: error?.message });
    }

    if (request.method !== 'POST') return response({ error: 'Method tidak didukung.' }, 405);
    const body = await request.json();

    if (route === 'auth/login') {
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const { data: users, error } = await supabase.from('USERS').select('*').ilike('Username', username).limit(1);
      const user = users?.[0] as Record<string, unknown> | undefined;
      if (error || !user || String(user.Active).toLowerCase() !== 'true' || await hashPassword(password, String(user.Salt)) !== user.PasswordHash) {
        return response({ ok: false, error: 'Username atau password tidak benar.' }, 401);
      }
      const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      const resumeKey = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      const now = new Date().toISOString();
      const { error: sessionError } = await supabase.from('SESSIONS').insert({ Token: token, UserID: user.UserID, ExpiresAt: new Date(Date.now() + 12 * 3600000).toISOString(), CreatedAt: now, LastSeenAt: now, ResumeKey: resumeKey });
      if (sessionError) return response({ ok: false, error: sessionError.message }, 503);
      return response({ ok: true, token, resumeKey, user: publicUser(user) });
    }

    if (route === 'rpc') return response({ error: 'Gunakan endpoint RPC dengan nama fungsi.' }, 400);
    const rpcMatch = route.match(/^rpc\/(.+)$/);
    if (!rpcMatch || !Array.isArray(body.args)) return response({ error: 'Endpoint belum tersedia pada Edge Function.' }, 501);
    const args = body.args as unknown[];
    const session = await getSession(String(args[0] || ''), rpcMatch[1] === 'resumeSession' ? 'ResumeKey' : 'Token');
    if (!session) return response({ error: 'Sesi sudah berakhir. Silakan login kembali.' }, 401);
    const readResult = await readRpc(rpcMatch[1], args, session.user);
    if (readResult) return readResult;
    if (rpcMatch[1] === 'resumeSession') return response({ ok: true, token: session.session.Token, resumeKey: session.session.ResumeKey, user: publicUser(session.user) });
    if (rpcMatch[1] === 'createResumeKey') return response({ ok: true, resumeKey: session.session.ResumeKey });
    if (rpcMatch[1] === 'logout') {
      await supabase.from('SESSIONS').delete().eq('Token', session.session.Token);
      return response({ ok: true });
    }
    if (rpcMatch[1] === 'changePassword') {
      const oldPassword = String(args[1] || '');
      const newPassword = String(args[2] || '');
      if (await hashPassword(oldPassword, String(session.user.Salt)) !== session.user.PasswordHash) {
        return response({ error: 'Password lama tidak benar.' }, 400);
      }
      if (newPassword.length < 8) return response({ error: 'Password baru minimal 8 karakter.' }, 400);
      const salt = [...crypto.getRandomValues(new Uint8Array(24))].map(value => value.toString(16).padStart(2, '0')).join('');
      const passwordHash = await hashPassword(newPassword, salt);
      const { error } = await supabase.from('USERS').update({ Salt: salt, PasswordHash: passwordHash, ForceChangePassword: 'false', UpdatedAt: new Date().toISOString() }).eq('UserID', session.user.UserID);
      if (error) return response({ error: error.message }, 503);
      await supabase.from('SESSIONS').delete().eq('UserID', session.user.UserID).neq('Token', session.session.Token);
      return response({ ok: true });
    }
    return response({ error: `Fitur ${rpcMatch[1]} belum dimigrasikan ke Supabase Edge Function.` }, 501);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Kesalahan server.' }, 500);
  }
});