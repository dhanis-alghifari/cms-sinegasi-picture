import pg from 'pg';
import { databaseInventory } from './productionBackupCore.js';

async function main(): Promise<void> {
  if (process.argv[2] !== 'isolated-public-restore') throw new Error();
  const client = new pg.Client({
    host: '127.0.0.1', port: 5432, database: 'sinegasi_backup_restore', user: 'postgres',
    connectionTimeoutMillis: 3000, query_timeout: 5000,
  });
  client.on('error', () => {});
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const info = (await client.query<{ database: string; version: string }>(
      "SELECT current_database() AS database,current_setting('server_version') AS version")).rows[0];
    if (info.database !== 'sinegasi_backup_restore' || !info.version.startsWith('17.11')) throw new Error();
    const inventory = await databaseInventory(client);
    await client.query('ROLLBACK');
    // Parent captures this in memory; never forward definitions/data to a user log.
    process.stdout.write(JSON.stringify({ version: info.version, inventory }));
  } finally {
    await client.end().catch(() => {});
  }
}

void main().catch(() => { process.stderr.write('ISOLATED_RESTORE_INSPECTION_FAILED\n'); process.exitCode = 1; });
