import { getPool } from '../config/db.js';
import { config } from '../config/env.js';

export async function testConnection(): Promise<boolean> {
  console.log('🔍 Testing Supabase / PostgreSQL Database Connection...');

  if (!config.databaseUrl) {
    console.error('❌ DATABASE_URL is not defined in environment variables.');
    console.error('👉 Please configure DATABASE_URL in your .env file or Render dashboard.');
    return false;
  }

  // Check if placeholder is still present
  if (
    config.databaseUrl.includes('REPLACE_WITH_DATABASE_PASSWORD') ||
    config.databaseUrl.includes('yourpassword') ||
    config.databaseUrl.includes('REPLACE_WITH_')
  ) {
    console.log('⚠️ DATABASE_URL contains placeholder "REPLACE_WITH_DATABASE_PASSWORD".');
    console.log('👉 Please edit .env and replace REPLACE_WITH_DATABASE_PASSWORD with your actual Supabase database password.');
    console.log('ℹ️ Live database connection was NOT tested because the password is not yet configured.');
    return false;
  }

  // Masked URL display (hiding password completely)
  const maskedUrl = config.databaseUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`📡 Target: ${maskedUrl}`);
  console.log(`🔒 SSL Enabled: ${config.databaseSsl}`);

  const pool = getPool();
  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as connected;');
    const latency = Date.now() - startTime;
    client.release();

    console.log(`✅ Supabase database connection verified successfully!`);
    console.log(`⏱️ Query "SELECT 1" returned ${result.rows[0].connected} in ${latency}ms.`);
    return true;
  } catch (error: any) {
    const rawMsg = error.message || 'Unknown database error';
    // Sanitize any password or URI leaking in raw error message
    const sanitizedError = rawMsg.replace(/:[^:@]+@/, ':****@');

    console.error('❌ Failed to connect to the database:');
    console.error(`   ${sanitizedError}`);

    if (rawMsg.includes('password authentication failed')) {
      console.error('💡 Tip: Verify your database password in DATABASE_URL. If it has special characters, ensure it is URL-encoded.');
    } else if (rawMsg.includes('getaddrinfo ENOTFOUND') || rawMsg.includes('timeout')) {
      console.error('💡 Tip: Verify the host name and make sure port 5432 or 6543 is accessible.');
    } else if (rawMsg.includes('SSL')) {
      console.error('💡 Tip: Supabase requires SSL. Ensure DATABASE_SSL=true.');
    }

    return false;
  }
}

if (process.argv[1] && process.argv[1].endsWith('test-connection.ts')) {
  testConnection()
    .then((success) => process.exit(success ? 0 : 1))
    .catch(() => process.exit(1));
}
