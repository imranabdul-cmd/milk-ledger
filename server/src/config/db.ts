import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from './env.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!config.databaseUrl) {
      console.warn('⚠️ DATABASE_URL is not set. Database queries will fail until DATABASE_URL is configured.');
    }

    const sslConfig = config.databaseSsl
      ? { rejectUnauthorized: false }
      : false;

    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl ? sslConfig : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }

  return pool;
}

export function setCustomPool(customPool: Pool): void {
  pool = customPool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const activePool = getPool();
  const start = Date.now();
  try {
    const res = await activePool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_QUERIES) {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error });
    throw error;
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const activePool = getPool();
  const client = await activePool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
