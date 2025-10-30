import pg from 'pg';

/**
 * Live Trading Database Connection Pool
 * 
 * Connects to the production trading database to fetch:
 * - Wallet configurations
 * - Stock settings per wallet
 * - Execution orders
 */

let livePool = null;

function getLivePool() {
  if (!livePool) {
    console.log('[Live DB] Initializing connection to tradiac live database');
    livePool = new pg.Pool({
      host: '35.199.155.114',
      port: 5432,
      database: 'tradiac',
      user: 'appuser',
      password: 'Fu3lth3j3t!',
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    livePool.on('connect', () => {
      console.log('[Live DB] Connected to tradiac live database');
    });

    livePool.on('error', (err) => {
      console.error('[Live DB] Unexpected error on idle client', err);
    });
  }
  
  return livePool;
}

export default getLivePool();