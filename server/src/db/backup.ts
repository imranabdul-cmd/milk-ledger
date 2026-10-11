import fs from 'fs';
import path from 'path';
import { getPool } from '../config/db.js';

async function backup() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('🔄 Backing up current database tables before applying migration 004...');
    const tables = [
      'families',
      'family_members',
      'milk_rate_history',
      'milk_entries',
      'payments',
      'payment_allocations',
      'monthly_closures',
      'audit_logs',
      'invitations',
      'refresh_tokens',
      'schema_migrations'
    ];

    const backupData: Record<string, any[]> = {};

    for (const table of tables) {
      const res = await client.query(`SELECT * FROM ${table}`);
      backupData[table] = res.rows;
      console.log(`✓ Backed up ${table}: ${res.rows.length} rows`);
    }

    const backupDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupDir, `db_backup_pre_004_${timestamp}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✅ Backup successfully saved to ${backupFilePath}`);
  } catch (err: any) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

backup();
