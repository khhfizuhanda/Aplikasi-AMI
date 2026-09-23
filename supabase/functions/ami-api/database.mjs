import pg from 'npm:pg@8.16.3';

const rawPool = new pg.Pool({
  connectionString: Deno.env.get('AMI_DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL'),
  max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000,
  application_name: 'ami-edge',
});
// Do not expose pg.Client.connect: shared services treat its presence as a pool.
export const pool = {
  query: (sql, args) => rawPool.query(sql, args),
  async connect() {
    const client = await rawPool.connect();
    return {
      async query(sql, args) {
        const result = await client.query(sql, args);
        if (sql.trim().toUpperCase() === 'BEGIN') {
          await client.query("SET LOCAL statement_timeout = '45s'");
          await client.query("SELECT pg_advisory_xact_lock(hashtext('ami-edge-write'))");
        }
        return result;
      },
      release: () => client.release(),
    };
  },
};
let ready;
export function ensureRuntimeSchema() {
  if (!ready) ready = (async () => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(`CREATE TABLE IF NOT EXISTS ami."IMPORT_JOBS" (
        "Token" text PRIMARY KEY, "UserID" text NOT NULL, "Payload" jsonb NOT NULL, "ExpiresAt" timestamptz NOT NULL);
        CREATE TABLE IF NOT EXISTS ami."FILE_STORE" (
        "FileID" text PRIMARY KEY, "AuditID" text NOT NULL, "FileName" text NOT NULL,
        "MimeType" text NOT NULL, "Bytes" bytea NOT NULL, "CreatedAt" timestamptz NOT NULL DEFAULT now());
        ALTER TABLE ami."IMPORT_JOBS" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ami."FILE_STORE" ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON ami."IMPORT_JOBS", ami."FILE_STORE" FROM PUBLIC, anon, authenticated;
        CREATE INDEX IF NOT EXISTS ami_import_jobs_expiry ON ami."IMPORT_JOBS" ("ExpiresAt");`);
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  })().catch(error => {ready = undefined; throw error;});
  return ready;
}
export async function transaction(work) {
  const db = await pool.connect();
  try {await db.query('BEGIN');const result = await work(db);await db.query('COMMIT');return result;}
  catch(error) {await db.query('ROLLBACK');throw error;}
  finally {db.release();}
}
