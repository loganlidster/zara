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
  
  return data.results.map(bar => ({
    symbol,
    cal_date: date,
    bar_time: new Date(bar.t).toISOString().split('T')[1].substring(0, 8),
    o: bar.o,
    h: bar.h,
    l: bar.l,
    c: bar.c,
    v: bar.v,
    vw: bar.vw || bar.c,
    n: bar.n || 0
  }));
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
  
  return data.results.map(bar => ({
    cal_date: date,
    bar_time: new Date(bar.t).toISOString().split('T')[1].substring(0, 8),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v
  }));
}

// Insert stock minute data
async function insertStockMinuteData(client, data) {
  if (data.length === 0) return 0;
  
  const values = data.map((bar, i) => 
    `($${i*9+1}, $${i*9+2}, $${i*9+3}, $${i*9+4}, $${i*9+5}, $${i*9+6}, $${i*9+7}, $${i*9+8}, $${i*9+9})`
  ).join(',');
  
  const params = data.flatMap(bar => [
    bar.symbol, bar.cal_date, bar.bar_time, bar.o, bar.h, bar.l, bar.c, bar.v, bar.vw, bar.n
  ]);
  
  const query = `
    INSERT INTO minute_stock (symbol, cal_date, bar_time, o, h, l, c, v, vw, n)
    VALUES ${values}
    ON CONFLICT (symbol, cal_date, bar_time) DO UPDATE SET
      o = EXCLUDED.o,
      h = EXCLUDED.h,
      l = EXCLUDED.l,
      c = EXCLUDED.c,
      v = EXCLUDED.v,
      vw = EXCLUDED.vw,
      n = EXCLUDED.n
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
    bar.cal_date, bar.bar_time, bar.open, bar.high, bar.low, bar.close, bar.volume
  ]);
  
  const query = `
    INSERT INTO minute_btc (cal_date, bar_time, open, high, low, close, volume)
    VALUES ${values}
    ON CONFLICT (cal_date, bar_time) DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume
  `;
  
  await client.query(query, params);
  return data.length;
}

// Calculate baselines for a date
async function calculateBaselines(client, date) {
  console.log(`\nCalculating baselines for ${date}...`);
  
  // Delete existing baselines for this date
  await client.query('DELETE FROM baseline_daily WHERE cal_date = $1', [date]);
  
  let totalInserted = 0;
  
  for (const method of METHODS) {
    for (const session of ['RTH', 'AH']) {
      const startTime = session === 'RTH' ? '09:30:00' : '04:00:00';
      const endTime = session === 'RTH' ? '16:00:00' : '09:30:00';
      const excludeRTH = session === 'AH';
      
      let query = '';
      
      switch (method) {
        case 'EQUAL_MEAN':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, cal_date, baseline)
            SELECT 
              symbol,
              'EQUAL_MEAN' as method,
              '${session}' as session,
              '${date}' as cal_date,
              AVG((o + h + l + c) / 4.0) as baseline
            FROM minute_stock
            WHERE cal_date = '${date}'
              AND bar_time >= '${startTime}'
              ${excludeRTH ? "AND bar_time < '09:30:00'" : "AND bar_time < '16:00:00'"}
            GROUP BY symbol
            HAVING COUNT(*) > 0
          `;
          break;
          
        case 'VWAP_RATIO':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, cal_date, baseline)
            SELECT 
              s.symbol,
              'VWAP_RATIO' as method,
              '${session}' as session,
              '${date}' as cal_date,
              (SUM(s.c * s.v) / NULLIF(SUM(s.v), 0)) / 
              NULLIF((SUM(b.close * b.volume) / NULLIF(SUM(b.volume), 0)), 0) as baseline
            FROM minute_stock s
            CROSS JOIN minute_btc b
            WHERE s.cal_date = '${date}'
              AND b.cal_date = '${date}'
              AND s.bar_time = b.bar_time
              AND s.bar_time >= '${startTime}'
              ${excludeRTH ? "AND s.bar_time < '09:30:00'" : "AND s.bar_time < '16:00:00'"}
            GROUP BY s.symbol
            HAVING COUNT(*) > 0
          `;
          break;
          
        case 'VOL_WEIGHTED':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, cal_date, baseline)
            SELECT 
              symbol,
              'VOL_WEIGHTED' as method,
              '${session}' as session,
              '${date}' as cal_date,
              SUM(c * v) / NULLIF(SUM(v), 0) as baseline
            FROM minute_stock
            WHERE cal_date = '${date}'
              AND bar_time >= '${startTime}'
              ${excludeRTH ? "AND bar_time < '09:30:00'" : "AND bar_time < '16:00:00'"}
            GROUP BY symbol
            HAVING COUNT(*) > 0
          `;
          break;
          
        case 'WINSORIZED':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, cal_date, baseline)
            WITH ranked AS (
              SELECT 
                symbol,
                (o + h + l + c) / 4.0 as price,
                ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY (o + h + l + c) / 4.0) as rn,
                COUNT(*) OVER (PARTITION BY symbol) as total
              FROM minute_stock
              WHERE cal_date = '${date}'
                AND bar_time >= '${startTime}'
                ${excludeRTH ? "AND bar_time < '09:30:00'" : "AND bar_time < '16:00:00'"}
            )
            SELECT 
              symbol,
              'WINSORIZED' as method,
              '${session}' as session,
              '${date}' as cal_date,
              AVG(price) as baseline
            FROM ranked
            WHERE rn > total * 0.05 AND rn <= total * 0.95
            GROUP BY symbol
          `;
          break;
          
        case 'WEIGHTED_MEDIAN':
          query = `
            INSERT INTO baseline_daily (symbol, method, session, cal_date, baseline)
            WITH sorted AS (
              SELECT 
                symbol,
                c as price,
                v as volume,
                SUM(v) OVER (PARTITION BY symbol ORDER BY c) as cumulative_volume,
                SUM(v) OVER (PARTITION BY symbol) as total_volume
              FROM minute_stock
              WHERE cal_date = '${date}'
                AND bar_time >= '${startTime}'
                ${excludeRTH ? "AND bar_time < '09:30:00'" : "AND bar_time < '16:00:00'"}
            )
            SELECT 
              symbol,
              'WEIGHTED_MEDIAN' as method,
              '${session}' as session,
              '${date}' as cal_date,
              AVG(price) as baseline
            FROM sorted
            WHERE cumulative_volume >= total_volume * 0.5
              AND cumulative_volume - volume < total_volume * 0.5
            GROUP BY symbol
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