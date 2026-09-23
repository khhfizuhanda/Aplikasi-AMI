const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}),
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ami_local',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function migrate() {
  await client.connect();
  await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await client.end();
  console.log('AMI PostgreSQL schema is ready.');
}

migrate().catch(async error => {
  console.error(`AMI schema migration failed: ${error.message}`);
  await client.end().catch(() => {});
  process.exitCode = 1;
});