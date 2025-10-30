import pg from 'pg';

/**
 * Testing Database Connection Pool
 * 
 * Connects to the tradiac_testing database for:
 * - Minute stock data
 * - Minute BTC data
 * - Baseline calculations
 * - Trade events
 */

const isCloudRun = process.env.K_SERVICE !== undefined;

const pool = new pg.Pool({
  host: isCloudRun 
    ? '/cloudsql/tradiac-testing:us-central1:tradiac-testing'
    : (process.env.DB_HOST || '34.41.97.179'),
  port: isCloudRun ? undefined : parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: isCloudRun ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('[DB] Connected to tradiac_testing database');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export default pool;