import pg from 'pg';
import axios from 'axios';

const { Pool } = pg;

// Configuration
const POLYGON_API_KEY = 'K_hSDwyuUSqRmD57vOlUmYqZGdcZsoG0';
const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];
const BTC_SYMBOL = 'X:BTCUSD';
const BATCH_SIZE = 1000;
const DELAY_MS = 100; // Small delay to be nice to API

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getSession(time) {
  const hour = parseInt(time.split(':')[0]);
  const minute = parseInt(time.split(':')[1]);
  const totalMinutes = hour * 60 + minute;
  
  // RTH: 9:30 AM - 4:00 PM ET (570 - 960 minutes)
  if (totalMinutes >= 570 && totalMinutes < 960) {
    return 'RTH';
  }
  return 'AH';
}

async function fetchPolygonData(symbol, date) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/minute/${date}/${date}`;
  
  try {
    const response = await axios.get(url, {
      params: {
        adjusted: 'true',
        sort: 'asc',
        limit: 50000,
        apiKey: POLYGON_API_KEY
      }
    });
    
    if (response.data.status === 'OK' && response.data.results) {
      return response.data.results;
    }
    
    return [];
  } catch (error) {
    if (error.response?.status === 404) {
      return []; // No data for this date
    }
    console.error(`   ❌ Error fetching ${symbol} on ${date}:`, error.message);
    return [];
  }
}

async function insertBTCBars(client, bars, date) {
  if (bars.length === 0) return 0;
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const bar of bars) {
    const barTime = new Date(bar.t);
    const etTime = new Date(barTime.getTime() - (5 * 60 * 60 * 1000)); // Convert to ET
    const time = etTime.toTimeString().split(' ')[0];
    const session = getSession(time);
    
    values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9})`);
    params.push(
      barTime.toISOString(),
      date,
      time,
      bar.o,
      bar.h,
      bar.l,
      bar.c,
      bar.v,
      session,
      'polygon'
    );
    paramIndex += 10;
  }
  
  const query = `
    INSERT INTO minute_btc (
      bar_time, et_date, et_time, open, high, low, close, volume, session, source
    ) VALUES ${values.join(', ')}
    ON CONFLICT (bar_time) DO NOTHING
  `;
  
  await client.query(query, params);
  return bars.length;
}

async function insertStockBars(client, symbol, bars, date) {
  if (bars.length === 0) return 0;
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const bar of bars) {
    const barTime = new Date(bar.t);
    const etTime = new Date(barTime.getTime() - (5 * 60 * 60 * 1000)); // Convert to ET
    const time = etTime.toTimeString().split(' ')[0];
    const session = getSession(time);
    
    values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10})`);
    params.push(
      symbol,
      barTime.toISOString(),
      date,
      time,
      bar.o,
      bar.h,
      bar.l,
      bar.c,
      bar.v,
      session,
      'polygon'
    );
    paramIndex += 11;
  }
  
  const query = `
    INSERT INTO minute_stock (
      symbol, bar_time, et_date, et_time, open, high, low, close, volume, session, source
    ) VALUES ${values.join(', ')}
    ON CONFLICT (symbol, bar_time) DO NOTHING
  `;
  
  await client.query(query, params);
  return bars.length;
}

async function getMissingDates(client, symbol = null) {
  let query;
  let params = [];
  
  if (symbol) {
    query = `
      WITH trading_days AS (
        SELECT cal_date
        FROM trading_calendar
        WHERE is_open = true
        AND cal_date >= '2024-01-01'
        ORDER BY cal_date
      ),
      existing_days AS (
        SELECT DISTINCT et_date
        FROM minute_stock
        WHERE symbol = $1
        AND et_date >= '2024-01-01'
      )
      SELECT td.cal_date
      FROM trading_days td
      LEFT JOIN existing_days ed ON td.cal_date = ed.et_date
      WHERE ed.et_date IS NULL
      ORDER BY td.cal_date
    `;
    params = [symbol];
  } else {
    // For BTC
    query = `
      WITH trading_days AS (
        SELECT cal_date
        FROM trading_calendar
        WHERE is_open = true
        AND cal_date >= '2024-01-01'
        ORDER BY cal_date
      ),
      existing_days AS (
        SELECT DISTINCT et_date
        FROM minute_btc
        WHERE et_date >= '2024-01-01'
      )
      SELECT td.cal_date
      FROM trading_days td
      LEFT JOIN existing_days ed ON td.cal_date = ed.et_date
      WHERE ed.et_date IS NULL
      ORDER BY td.cal_date
    `;
  }
  
  const result = await client.query(query, params);
  return result.rows.map(r => formatDate(r.cal_date));
}

async function fetchBTCData(client) {
  console.log('\n🔷 Fetching BTC Data (X:BTCUSD)...');
  
  const missingDates = await getMissingDates(client);
  
  if (missingDates.length === 0) {
    console.log('   ✅ BTC data is complete!\n');
    return;
  }
  
  console.log(`   Found ${missingDates.length} missing dates`);
  console.log(`   Fetching from Polygon.io...\n`);
  
  let totalBars = 0;
  let completed = 0;
  
  for (const date of missingDates) {
    // Reconnect every 100 dates to avoid timeout
    if (completed > 0 && completed % 100 === 0) {
      console.log(`   🔄 Reconnecting to database...`);
      await client.query('SELECT 1'); // Keepalive ping
    }
    
    const bars = await fetchPolygonData(BTC_SYMBOL, date);
    const inserted = await insertBTCBars(client, bars, date);
    totalBars += inserted;
    completed++;
    
    if (completed % 10 === 0 || completed === missingDates.length) {
      console.log(`   Progress: ${completed}/${missingDates.length} dates | ${totalBars.toLocaleString()} bars inserted`);
    }
    
    await sleep(DELAY_MS);
  }
  
  console.log(`   ✅ BTC data complete: ${totalBars.toLocaleString()} bars inserted\n`);
}

async function fetchStockData(client) {
  console.log('📊 Fetching Stock Data...\n');
  
  for (const symbol of STOCKS) {
    console.log(`   Processing ${symbol}...`);
    
    const missingDates = await getMissingDates(client, symbol);
    
    if (missingDates.length === 0) {
      console.log(`      ✅ Complete\n`);
      continue;
    }
    
    console.log(`      Found ${missingDates.length} missing dates`);
    
    let totalBars = 0;
    let completed = 0;
    
    for (const date of missingDates) {
      // Reconnect every 100 dates to avoid timeout
      if (completed > 0 && completed % 100 === 0) {
        console.log(`      🔄 Reconnecting to database...`);
        await client.query('SELECT 1'); // Keepalive ping
      }
      
      const bars = await fetchPolygonData(symbol, date);
      const inserted = await insertStockBars(client, symbol, bars, date);
      totalBars += inserted;
      completed++;
      
      if (completed % 10 === 0 || completed === missingDates.length) {
        console.log(`      Progress: ${completed}/${missingDates.length} dates | ${totalBars.toLocaleString()} bars`);
      }
      
      await sleep(DELAY_MS);
    }
    
    console.log(`      ✅ Complete: ${totalBars.toLocaleString()} bars inserted\n`);
  }
}

async function main() {
  console.log('🚀 TRADIAC Data Fetcher (Polygon.io)');
  console.log('═══════════════════════════════════════');
  console.log(`API Key: ${POLYGON_API_KEY.substring(0, 10)}...`);
  console.log(`Stocks: ${STOCKS.join(', ')}`);
  console.log('═══════════════════════════════════════\n');
  
  const client = await pool.connect();
  
  try {
    const startTime = Date.now();
    
    // Fetch BTC data first
    await fetchBTCData(client);
    
    // Fetch stock data
    await fetchStockData(client);
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('═══════════════════════════════════════');
    console.log('✅ DATA FETCH COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`Total Time: ${totalTime} minutes\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();