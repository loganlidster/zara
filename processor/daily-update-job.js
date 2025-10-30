import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

// Configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const STOCKS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];

// Get yesterday's date (the data we want to fetch)
// Or use TARGET_DATE environment variable for backfilling
function getTargetDate() {
  if (process.env.TARGET_DATE) {
    return process.env.TARGET_DATE;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// Determine session based on time
function getSession(etTime) {
  const hour = parseInt(etTime.split(':')[0]);
  const minute = parseInt(etTime.split(':')[1]);
  const totalMinutes = hour * 60 + minute;
  
  // RTH: 09:30 - 16:00 (570 - 960 minutes)
  // AH: 04:00 - 09:30 and 16:00 - 20:00
  if (totalMinutes >= 570 && totalMinutes < 960) {
    return 'RTH';
  } else {
    return 'AH';
  }
}

// Fetch minute data from Polygon.io
async function fetchStockMinuteData(symbol, date) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/minute/${date}/${date}?adjusted=true&sort=asc&limit=50000&apiKey=${POLYGON_API_KEY}`;
  
  console.log(`Fetching ${symbol} data for ${date}...`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK' || !data.results) {
    console.log(`No data for ${symbol} on ${date}`);
    return [];
  }
  
  return data.results.map(bar => {
    const barTime = new Date(bar.t);
    const etDate = date;
    const etTime = barTime.toISOString().split('T')[1].substring(0, 8);
    const session = getSession(etTime);
    
    return {
      symbol,
      bar_time: barTime.toISOString(),
      et_date: etDate,
      et_time: etTime,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw || bar.c,
      trades: bar.n || 0,
      session,
      source: 'polygon'
    };
  });
}

async function fetchBTCMinuteData(date) {
  const url = `https://api.polygon.io/v2/aggs/ticker/X:BTCUSD/range/1/minute/${date}/${date}?adjusted=true&sort=asc&limit=50000&apiKey=${POLYGON_API_KEY}`;
  
  console.log(`Fetching BTC data for ${date}...`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK' || !data.results) {
    console.log(`No BTC data for ${date}`);
    return [];
  }
  
  return data.results.map(bar => {
    const barTime = new Date(bar.t);
    const etDate = date;
    const etTime = barTime.toISOString().split('T')[1].substring(0, 8);
    
    return {
      bar_time: barTime.toISOString(),
      et_date: etDate,
      et_time: etTime,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v
    };
  });
}

// Insert stock minute data
async function insertStockMinuteData(client, data) {
  if (data.length === 0) return 0;
  
  const values = data.map((bar, i) => 
    `($${i*13+1}, $${i*13+2}, $${i*13+3}, $${i*13+4}, $${i*13+5}, $${i*13+6}, $${i*13+7}, $${i*13+8}, $${i*13+9}, $${i*13+10}, $${i*13+11}, $${i*13+12}, $${i*13+13})`
  ).join(',');
  
  const params = data.flatMap(bar => [
    bar.symbol, bar.bar_time, bar.et_date, bar.et_time, bar.open, bar.high, bar.low, bar.close, bar.volume, bar.vwap, bar.trades, bar.session, bar.source
  ]);
  
  const query = `
    INSERT INTO minute_stock (symbol, bar_time, et_date, et_time, open, high, low, close, volume, vwap, trades, session, source)
    VALUES ${values}
    ON CONFLICT (symbol, bar_time) DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      vwap = EXCLUDED.vwap,
      trades = EXCLUDED.trades,
      session = EXCLUDED.session
  `;
  
  await client.query(query, params);
  return data.length;
}

// Insert BTC minute data
async function insertBTCMinuteData(client, data) {
  if (data.length === 0) return 0;
  
  const values = data.map((bar, i) => 
    `($${i*6+1}, $${i*6+2}, $${i*6+3}, $${i*6+4}, $${i*6+5}, $${i*6+6})`
  ).join(',');
  
  const params = data.flatMap(bar => [
    bar.bar_time, bar.et_date, bar.et_time, bar.open, bar.high, bar.low, bar.close, bar.volume
  ]);
  
  // Check the actual minute_btc schema
  const query = `
    INSERT INTO minute_btc (bar_time, et_date, et_time, open, high, low, close, volume)
    VALUES ${values}
    ON CONFLICT (bar_time) DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume
  `;
  
  await client.query(query, params);
  return data.length;
}

// Calculate baselines
async function calculateBaselines(client, date) {
  let totalInserted = 0;
  
  for (const session of ['RTH', 'AH']) {
    const startTime = session === 'RTH' ? '09:30:00' : '04:00:00';
    const endTime = session === 'RTH' ? '16:00:00' : '20:00:00';
    
    for (const method of METHODS) {
      let query;
      
      switch (method) {
        case 'EQUAL_MEAN':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, trading_day, baseline, sample_count)
            SELECT 
              symbol,
              'EQUAL_MEAN' as method,
              '${session}' as session,
              '${date}' as trading_day,
              AVG(close / btc.btc_price) as baseline,
              COUNT(*) as sample_count
            FROM minute_stock ms
            CROSS JOIN LATERAL (
              SELECT close as btc_price
              FROM minute_btc
              WHERE et_date = ms.et_date
                AND et_time = ms.et_time
              LIMIT 1
            ) btc
            WHERE ms.et_date = '${date}'
              AND ms.session = '${session}'
              AND ms.et_time >= '${startTime}'
              AND ms.et_time < '${endTime}'
            GROUP BY symbol
            ON CONFLICT (symbol, session, trading_day, method) DO UPDATE SET
              baseline = EXCLUDED.baseline,
              sample_count = EXCLUDED.sample_count
          `;
          break;
          
        case 'VWAP_RATIO':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, trading_day, baseline, sample_count)
            SELECT 
              symbol,
              'VWAP_RATIO' as method,
              '${session}' as session,
              '${date}' as trading_day,
              SUM(vwap * volume) / SUM(volume) / AVG(btc.btc_price) as baseline,
              COUNT(*) as sample_count
            FROM minute_stock ms
            CROSS JOIN LATERAL (
              SELECT close as btc_price
              FROM minute_btc
              WHERE et_date = ms.et_date
                AND et_time = ms.et_time
              LIMIT 1
            ) btc
            WHERE ms.et_date = '${date}'
              AND ms.session = '${session}'
              AND ms.et_time >= '${startTime}'
              AND ms.et_time < '${endTime}'
            GROUP BY symbol
            ON CONFLICT (symbol, session, trading_day, method) DO UPDATE SET
              baseline = EXCLUDED.baseline,
              sample_count = EXCLUDED.sample_count
          `;
          break;
          
        case 'VOL_WEIGHTED':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, trading_day, baseline, sample_count)
            SELECT 
              symbol,
              'VOL_WEIGHTED' as method,
              '${session}' as session,
              '${date}' as trading_day,
              SUM((close / btc.btc_price) * volume) / SUM(volume) as baseline,
              COUNT(*) as sample_count
            FROM minute_stock ms
            CROSS JOIN LATERAL (
              SELECT close as btc_price
              FROM minute_btc
              WHERE et_date = ms.et_date
                AND et_time = ms.et_time
              LIMIT 1
            ) btc
            WHERE ms.et_date = '${date}'
              AND ms.session = '${session}'
              AND ms.et_time >= '${startTime}'
              AND ms.et_time < '${endTime}'
            GROUP BY symbol
            ON CONFLICT (symbol, session, trading_day, method) DO UPDATE SET
              baseline = EXCLUDED.baseline,
              sample_count = EXCLUDED.sample_count
          `;
          break;
          
        case 'WINSORIZED':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, trading_day, baseline, sample_count)
            WITH ratios AS (
              SELECT 
                symbol,
                close / btc.btc_price as ratio
              FROM minute_stock ms
              CROSS JOIN LATERAL (
                SELECT close as btc_price
                FROM minute_btc
                WHERE et_date = ms.et_date
                  AND et_time = ms.et_time
                LIMIT 1
              ) btc
              WHERE ms.et_date = '${date}'
                AND ms.session = '${session}'
                AND ms.et_time >= '${startTime}'
                AND ms.et_time < '${endTime}'
            ),
            percentiles AS (
              SELECT 
                symbol,
                PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY ratio) as p5,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ratio) as p95
              FROM ratios
              GROUP BY symbol
            )
            SELECT 
              r.symbol,
              'WINSORIZED' as method,
              '${session}' as session,
              '${date}' as trading_day,
              AVG(CASE 
                WHEN r.ratio < p.p5 THEN p.p5
                WHEN r.ratio > p.p95 THEN p.p95
                ELSE r.ratio
              END) as baseline,
              COUNT(*) as sample_count
            FROM ratios r
            JOIN percentiles p ON r.symbol = p.symbol
            GROUP BY r.symbol
            ON CONFLICT (symbol, session, trading_day, method) DO UPDATE SET
              baseline = EXCLUDED.baseline,
              sample_count = EXCLUDED.sample_count
          `;
          break;
          
        case 'WEIGHTED_MEDIAN':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, trading_day, baseline, sample_count)
            WITH sorted AS (
              SELECT 
                symbol,
                close / btc.btc_price as ratio,
                volume,
                SUM(volume) OVER (PARTITION BY symbol ORDER BY close / btc.btc_price) as cumulative_volume,
                SUM(volume) OVER (PARTITION BY symbol) as total_volume
              FROM minute_stock ms
              CROSS JOIN LATERAL (
                SELECT close as btc_price
                FROM minute_btc
                WHERE et_date = ms.et_date
                  AND et_time = ms.et_time
                LIMIT 1
              ) btc
              WHERE ms.et_date = '${date}'
                AND ms.session = '${session}'
                AND ms.et_time >= '${startTime}'
                AND ms.et_time < '${endTime}'
            )
            SELECT 
              symbol,
              'WEIGHTED_MEDIAN' as method,
              '${session}' as session,
              '${date}' as trading_day,
              AVG(ratio) as baseline,
              COUNT(*) as sample_count
            FROM sorted
            WHERE cumulative_volume >= total_volume * 0.5
              AND cumulative_volume - volume < total_volume * 0.5
            GROUP BY symbol
            ON CONFLICT (symbol, session, trading_day, method) DO UPDATE SET
              baseline = EXCLUDED.baseline,
              sample_count = EXCLUDED.sample_count
          `;
          break;
      }
      
      const result = await client.query(query);
      totalInserted += result.rowCount;
      console.log(`  ${method} ${session}: ${result.rowCount} baselines`);
    }
  }
  
  return totalInserted;
}

// Main execution
async function main() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Daily Update Job');
    console.log('================================\n');
    
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY environment variable is required');
    }
    
    const date = getTargetDate();
    console.log(`📅 Processing date: ${date}\n`);
    
    // Step 1: Fetch and insert stock minute data
    console.log('📊 Step 1: Fetching stock minute data...');
    let totalStockBars = 0;
    
    for (const symbol of STOCKS) {
      const data = await fetchStockMinuteData(symbol, date);
      const inserted = await insertStockMinuteData(client, data);
      totalStockBars += inserted;
      console.log(`  ${symbol}: ${inserted} bars`);
      
      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Total stock bars inserted: ${totalStockBars}\n`);
    
    // Step 2: Fetch and insert BTC minute data
    console.log('₿ Step 2: Fetching BTC minute data...');
    const btcData = await fetchBTCMinuteData(date);
    const btcBars = await insertBTCMinuteData(client, btcData);
    console.log(`✅ BTC bars inserted: ${btcBars}\n`);
    
    // Step 3: Calculate baselines
    console.log('📈 Step 3: Calculating baselines...');
    const baselinesInserted = await calculateBaselines(client, date);
    console.log(`✅ Total baselines calculated: ${baselinesInserted}\n`);
    
    console.log('================================');
    console.log('✅ Daily Update Complete!');
    console.log(`   Date: ${date}`);
    console.log(`   Stock bars: ${totalStockBars}`);
    console.log(`   BTC bars: ${btcBars}`);
    console.log(`   Baselines: ${baselinesInserted}`);
    
  } catch (error) {
    console.error('❌ Error during daily update:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the job
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});