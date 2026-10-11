import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/db.js';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  if (!config.databaseUrl) {
    console.error('❌ DATABASE_URL is not configured in .env.');
    process.exit(1);
  }

  if (
    config.databaseUrl.includes('REPLACE_WITH_DATABASE_PASSWORD') ||
    config.databaseUrl.includes('yourpassword') ||
    config.databaseUrl.includes('REPLACE_WITH_')
  ) {
    console.error('⚠️ DATABASE_URL contains placeholder "REPLACE_WITH_DATABASE_PASSWORD".');
    console.error('👉 Please configure your actual database password in .env before running migrations.');
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('🔄 Checking database connection and migration status...');

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Fetch applied migrations
    const res = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const appliedVersions = new Set(res.rows.map(r => r.version));

    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️ No migrations directory found at', migrationsDir);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let newMigrationsCount = 0;

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`✓ Migration already applied: ${file}`);
        continue;
      }

      console.log(`🚀 Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Successfully applied: ${file}`);
        newMigrationsCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed: ${file}`, err);
        throw err;
      }
    }

    if (newMigrationsCount === 0) {
      console.log('✨ All migrations are up to date.');
    } else {
      console.log(`🎉 Successfully applied ${newMigrationsCount} new migration(s).`);
    }
  } finally {
    client.release();
  }
}

// Run directly if invoked from CLI
if (process.argv[1] && process.argv[1].endsWith('migrator.ts')) {
  runMigrations()
    .then(() => {
      console.log('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
