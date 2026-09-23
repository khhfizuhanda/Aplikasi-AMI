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

async function getSession(token: string, column = 'Token') {
  const { data, error } = await supabase
    .from('SESSIONS')
    .select('*, USERS(*)')
    .eq(column, token)
    .maybeSingle();
  const user = data?.USERS as Record<string, unknown> | undefined;
  if (error || !data || !user || String(user.Active).toLowerCase() !== 'true' || Date.parse(String(data.ExpiresAt)) <= Date.now()) {
    return null;
  }
  return { session: data, user };
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
    if (rpcMatch[1] === 'resumeSession') return response({ ok: true, token: session.session.Token, resumeKey: session.session.ResumeKey, user: publicUser(session.user) });
    if (rpcMatch[1] === 'createResumeKey') return response({ ok: true, resumeKey: session.session.ResumeKey });
    if (rpcMatch[1] === 'logout') {
      await supabase.from('SESSIONS').delete().eq('Token', session.session.Token);
      return response({ ok: true });
    }
    return response({ error: `Fitur ${rpcMatch[1]} belum dimigrasikan ke Supabase Edge Function.` }, 501);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Kesalahan server.' }, 500);
  }
});