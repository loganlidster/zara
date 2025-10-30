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
 * Get BTC Overlay Data - Minute-by-minute stock and BTC prices for charting
 * 
 * Request body:
 * {
 *   symbol: string,           // e.g., "RIOT"
 *   startDate: string,        // e.g., "2024-10-24"
 *   endDate: string,          // e.g., "2024-10-29"
 *   sessionType: string,      // "RTH" | "AH" | "ALL" | "CUSTOM"
 *   customStart?: string,     // e.g., "09:30:00" (for CUSTOM)
 *   customEnd?: string        // e.g., "16:00:00" (for CUSTOM)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   symbol: string,
 *   startDate: string,
 *   endDate: string,
 *   sessionType: string,
 *   dataPoints: number,
 *   data: [
 *     {
 *       et_date: string,
 *       et_time: string,
 *       stock_price: number,
 *       btc_price: number,
 *       ratio: number,
 *       session: string
 *     }
 *   ]
 * }
 */
export async function handleBtcOverlayData(req, res) {
  console.log('🎨 BTC Overlay Data endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();

  try {
    const {
      symbol,
      startDate,
      endDate,
      sessionType = 'RTH',
      customStart,
      customEnd
    } = req.body;

    // Validate required parameters
    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: symbol, startDate, endDate'
      });
    }

    // Build session filter
    let sessionFilter = '';
    const params = [symbol, startDate, endDate];
    
    if (sessionType === 'RTH') {
      sessionFilter = `AND s.et_time >= '09:30:00' AND s.et_time < '16:00:00'`;
    } else if (sessionType === 'AH') {
      sessionFilter = `AND ((s.et_time >= '04:00:00' AND s.et_time < '09:30:00') OR (s.et_time >= '16:00:00' AND s.et_time < '20:00:00'))`;
    } else if (sessionType === 'ALL') {
      sessionFilter = `AND s.et_time >= '04:00:00' AND s.et_time < '20:00:00'`;
    } else if (sessionType === 'CUSTOM') {
      if (!customStart || !customEnd) {
        return res.status(400).json({
          success: false,
          error: 'CUSTOM session type requires customStart and customEnd parameters'
        });
      }
      sessionFilter = `AND s.et_time >= $4 AND s.et_time < $5`;
      params.push(customStart, customEnd);
    }

    console.log(`Fetching data for ${symbol} from ${startDate} to ${endDate}, session: ${sessionType}`);

    // Query to get minute-by-minute data
    const query = `
      SELECT 
        s.et_date,
        s.et_time,
        s.close as stock_price,
        b.close as btc_price,
        (b.close / NULLIF(s.close, 0)) as ratio,
        s.session,
        s.volume as stock_volume,
        b.volume as btc_volume,
        s.vwap as stock_vwap,
        b.vwap as btc_vwap
      FROM minute_stock s
      JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
      WHERE s.symbol = $1
        AND s.et_date >= $2
        AND s.et_date <= $3
        ${sessionFilter}
      ORDER BY s.et_date, s.et_time
    `;

    const result = await client.query(query, params);

    console.log(`✅ Found ${result.rows.length} minute bars`);

    // Format the data
    const data = result.rows.map(row => ({
      et_date: row.et_date,
      et_time: row.et_time,
      stock_price: parseFloat(row.stock_price),
      btc_price: parseFloat(row.btc_price),
      ratio: row.ratio ? parseFloat(row.ratio) : null,
      session: row.session,
      stock_volume: parseInt(row.stock_volume),
      btc_volume: parseInt(row.btc_volume),
      stock_vwap: row.stock_vwap ? parseFloat(row.stock_vwap) : null,
      btc_vwap: row.btc_vwap ? parseFloat(row.btc_vwap) : null
    }));

    res.json({
      success: true,
      symbol,
      startDate,
      endDate,
      sessionType,
      dataPoints: data.length,
      data
    });

  } catch (error) {
    console.error('❌ Error in btc-overlay-data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}