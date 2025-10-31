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

// Always use TCP connection for now (Unix socket has auth issues)
const poolConfig = {
  host: process.env.DB_HOST || '34.41.97.179',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

const pool = new pg.Pool(poolConfig);

pool.on('connect', () => {
  console.log('[DB] Connected to tradiac_testing database');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export default pool;