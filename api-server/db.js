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

const poolConfig = {
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (isCloudRun) {
  // Cloud Run: Use Unix socket
  poolConfig.host = '/cloudsql/tradiac-testing:us-central1:tradiac-testing-db';
} else {
  // Local/External: Use TCP connection
  poolConfig.host = process.env.DB_HOST || '34.41.97.179';
  poolConfig.port = parseInt(process.env.DB_PORT || '5432');
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new pg.Pool(poolConfig);

pool.on('connect', () => {
  console.log('[DB] Connected to tradiac_testing database');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export default pool;