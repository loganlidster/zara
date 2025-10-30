import pg from 'pg';

const { Pool } = pg;

// Use Unix socket for Cloud Run, IP for local development
const isCloudRun = process.env.K_SERVICE !== undefined;
const pool = new Pool({
  host: isCloudRun 
    ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME || 'tradiac-testing:us-central1:tradiac-testing-db'}`
    : (process.env.DB_HOST || '34.41.97.179'),
  port: isCloudRun ? undefined : (process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: isCloudRun ? false : { rejectUnauthorized: false },
  max: 50,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  statement_timeout: 120000,
  query_timeout: 120000,
});

/**
 * Get Baseline Values - Pre-calculated baseline values for visualization
 * 
 * Request body:
 * {
 *   symbol: string,           // e.g., "RIOT"
 *   startDate: string,        // e.g., "2024-10-24"
 *   endDate: string,          // e.g., "2024-10-29"
 *   method: string,           // e.g., "VWAP_RATIO"
 *   sessionType?: string      // "RTH" | "AH" | "ALL" (optional, default: all sessions)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   symbol: string,
 *   method: string,
 *   baselines: [
 *     {
 *       trading_day: string,
 *       session: string,
 *       baseline: number,
 *       sample_count: number,
 *       min_ratio: number,
 *       max_ratio: number,
 *       std_dev: number
 *     }
 *   ]
 * }
 */
export async function handleBaselineValues(req, res) {
  console.log('📊 Baseline Values endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();

  try {
    const {
      symbol,
      startDate,
      endDate,
      method,
      sessionType
    } = req.body;

    // Validate required parameters
    if (!symbol || !startDate || !endDate || !method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: symbol, startDate, endDate, method'
      });
    }

    // Build session filter
    let sessionFilter = '';
    const params = [symbol, startDate, endDate, method];
    
    if (sessionType === 'RTH') {
      sessionFilter = `AND b.session = 'RTH'`;
    } else if (sessionType === 'AH') {
      sessionFilter = `AND b.session = 'AH'`;
    }
    // If sessionType is 'ALL' or not specified, get both RTH and AH

    console.log(`Fetching baselines for ${symbol} ${method} from ${startDate} to ${endDate}`);

    // Query to get baseline values
    const query = `
      SELECT 
        b.trading_day,
        b.session,
        b.baseline,
        b.sample_count,
        b.min_ratio,
        b.max_ratio,
        b.std_dev
      FROM baseline_daily b
      WHERE b.symbol = $1
        AND b.trading_day >= $2
        AND b.trading_day <= $3
        AND b.method = $4
        ${sessionFilter}
      ORDER BY b.trading_day, b.session
    `;

    const result = await client.query(query, params);

    console.log(`✅ Found ${result.rows.length} baseline values`);

    // Format the data
    const baselines = result.rows.map(row => ({
      trading_day: row.trading_day,
      session: row.session,
      baseline: parseFloat(row.baseline),
      sample_count: parseInt(row.sample_count),
      min_ratio: row.min_ratio ? parseFloat(row.min_ratio) : null,
      max_ratio: row.max_ratio ? parseFloat(row.max_ratio) : null,
      std_dev: row.std_dev ? parseFloat(row.std_dev) : null
    }));

    // Also get the mapping of current days to their baseline source days
    // (baselines are calculated from PREVIOUS trading day)
    const mappingQuery = `
      SELECT 
        tc.cal_date as current_day,
        tc.prev_open_date as baseline_source_day
      FROM trading_calendar tc
      WHERE tc.cal_date >= $1
        AND tc.cal_date <= $2
        AND tc.is_trading_day = true
      ORDER BY tc.cal_date
    `;

    const mappingResult = await client.query(mappingQuery, [startDate, endDate]);
    
    const baselineMapping = mappingResult.rows.map(row => ({
      current_day: row.current_day,
      baseline_source_day: row.baseline_source_day
    }));

    res.json({
      success: true,
      symbol,
      method,
      sessionType: sessionType || 'ALL',
      baselines,
      baselineMapping
    });

  } catch (error) {
    console.error('❌ Error in baseline-values:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}