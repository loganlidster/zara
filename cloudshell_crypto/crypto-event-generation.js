#!/usr/bin/env node
/**
 * CRYPTO EVENT GENERATION SCRIPT
 * 
 * Generates buy/sell trading events for crypto based on baseline deviations
 * Similar to stock event generation but for 24/7 crypto trading
 * 
 * Usage:
 *   METHOD=EQUAL_MEAN node crypto-event-generation.js
 * 
 * Environment Variables:
 *   METHOD - Baseline method (EQUAL_MEAN, VWAP_RATIO, etc.)
 *   BUY_MAX - Maximum buy threshold (default: 3.0)
 *   SELL_MIN - Minimum sell threshold (default: 0.1)
 *   SELL_MAX - Maximum sell threshold (default: 3.0)
 *   START_DATE - Start date (default: 2025-10-26)
 *   END_DATE - End date (default: today)
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Configuration from environment
const METHOD = process.env.METHOD;
const START_DATE = process.env.START_DATE || '2024-10-01'; // 13 months of data (Oct 2024 - Nov 2, 2025)
const END_DATE = process.env.END_DATE || '2025-11-02';

// Crypto symbols (19 total, SHIB removed due to numeric overflow)
const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP'];

// Batch size for inserts
const BATCH_SIZE = 1500;

/**
 * Generate parameter combinations
 * Custom thresholds optimized for 0.3% round-trip fees (0.15% each way)
 * Minimum 0.2% net profit after fees
 */
function generateCombinations() {
  const combinations = [];
  // Custom thresholds: 0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0
  const thresholds = [0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0];
  
  for (const buy of thresholds) {
    for (const sell of thresholds) {
      combinations.push({
        buy_pct: buy,
        sell_pct: sell
      });
    }
  }
  
  console.log(`Custom thresholds: ${thresholds.join(', ')}`);
  console.log(`Total combinations: ${combinations.length} (${thresholds.length}×${thresholds.length})`);
  
  return combinations;
}

const COMBINATIONS = generateCombinations();

/**
 * Get table name for method
 */
function getTableName(method) {
  return `trade_events_crypto_${method.toLowerCase()}`;
}

const TABLE_NAME = getTableName(METHOD);

console.log('\n========================================');
console.log(`Crypto Event Generation`);
console.log(`Table: ${TABLE_NAME}`);
console.log(`Method: ${METHOD}`);
console.log(`Date range: ${START_DATE} to ${END_DATE}`);
console.log(`Symbols: ${CRYPTO_SYMBOLS.length} cryptos`);
console.log(`Combinations: ${COMBINATIONS.length}`);
console.log(`Batch size: ${BATCH_SIZE} events per INSERT`);
console.log(`========================================\n`);

/**
 * Fetch all minute data for a symbol with baselines
 */
async function fetchAllMinuteData(client, symbol) {
  const query = `
    SELECT 
      mc.timestamp,
      mc.close as crypto_price,
      mbc.close as btc_price,
      mbc.close / mc.close as ratio,
      bdc.baseline
    FROM minute_crypto mc
    JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
    JOIN baseline_daily_crypto bdc 
      ON bdc.symbol = mc.symbol 
      AND bdc.method = $1
      AND bdc.trading_day = DATE(mc.timestamp)
    WHERE mc.symbol = $2
      AND mc.timestamp >= $3::timestamp
      AND mc.timestamp <= $4::timestamp + INTERVAL '1 day'
    ORDER BY mc.timestamp
  `;
  
  const result = await client.query(query, [
    METHOD,
    symbol,
    START_DATE,
    END_DATE
  ]);
  
  return result.rows;
}

/**
 * Process symbol combination to generate events
 */
function processSymbolCombination(minuteData, buyPct, sellPct) {
  const events = [];
  let expectingBuy = true;
  
  for (const bar of minuteData) {
    const ratio = parseFloat(bar.ratio);
    const baseline = parseFloat(bar.baseline);
    
    const buyThreshold = baseline * (1 + buyPct / 100);
    const sellThreshold = baseline * (1 - sellPct / 100);
    
    if (expectingBuy && ratio >= buyThreshold) {
      events.push({
        event_timestamp: bar.timestamp,
        event_type: 'BUY',
        crypto_price: Math.round(parseFloat(bar.crypto_price) * 100000000) / 100000000,
        btc_price: Math.round(parseFloat(bar.btc_price) * 100) / 100,
        ratio: Math.round(ratio * 100000000) / 100000000,
        baseline: Math.round(baseline * 100000000) / 100000000,
        trade_roi_pct: null
      });
      expectingBuy = false;
    } else if (!expectingBuy && ratio <= sellThreshold) {
      events.push({
        event_timestamp: bar.timestamp,
        event_type: 'SELL',
        crypto_price: Math.round(parseFloat(bar.crypto_price) * 100000000) / 100000000,
        btc_price: Math.round(parseFloat(bar.btc_price) * 100) / 100,
        ratio: Math.round(ratio * 100000000) / 100000000,
        baseline: Math.round(baseline * 100000000) / 100000000,
        trade_roi_pct: null
      });
      expectingBuy = true;
    }
  }
  
  return events;
}

/**
 * Insert events in batches
 */
async function insertEventsBatch(client, symbol, buyPct, sellPct, events) {
  if (events.length === 0) return 0;
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const event of events) {
    const placeholder = `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9})`;
    values.push(placeholder);
    params.push(
      symbol,
      buyPct,
      sellPct,
      event.event_timestamp,
      event.event_type,
      event.crypto_price,
      event.btc_price,
      event.ratio,
      event.baseline,
      event.trade_roi_pct
    );
    paramIndex += 10;
  }
  
  const insertQuery = `
    INSERT INTO ${TABLE_NAME} 
    (symbol, buy_pct, sell_pct, event_timestamp, event_type, crypto_price, btc_price, ratio, baseline, trade_roi_pct)
    VALUES ${values.join(', ')}
    ON CONFLICT (symbol, buy_pct, sell_pct, event_timestamp) DO NOTHING
  `;
  
  await client.query(insertQuery, params);
  return events.length;
}

/**
 * Insert events in batches
 */
async function insertEventsInBatches(client, symbol, buyPct, sellPct, events) {
  if (events.length === 0) return 0;
  
  let totalInserted = 0;
  
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const inserted = await insertEventsBatch(client, symbol, buyPct, sellPct, batch);
    totalInserted += inserted;
  }
  
  return totalInserted;
}

/**
 * Main execution
 */
async function main() {
  if (!METHOD) {
    console.error('ERROR: METHOD environment variable is required');
    console.error('Example: METHOD=EQUAL_MEAN node crypto-event-generation.js');
    process.exit(1);
  }
  
  const startTime = Date.now();
  let totalEvents = 0;
  
  const client = await pool.connect();
  
  try {
    for (const symbol of CRYPTO_SYMBOLS) {
      console.log(`[${symbol}] Fetching data...`);
      
      const minuteData = await fetchAllMinuteData(client, symbol);
      
      if (minuteData.length === 0) {
        console.log(`[${symbol}] No data available\n`);
        continue;
      }
      
      console.log(`[${symbol}] Processing ${COMBINATIONS.length} combinations...`);
      
      let symbolEvents = 0;
      let processed = 0;
      const reportInterval = 100;
      
      for (const combo of COMBINATIONS) {
        const events = processSymbolCombination(minuteData, combo.buy_pct, combo.sell_pct);
        const inserted = await insertEventsInBatches(client, symbol, combo.buy_pct, combo.sell_pct, events);
        symbolEvents += inserted;
        processed++;
        
        if (processed % reportInterval === 0) {
          console.log(`[${symbol}] ${processed}/${COMBINATIONS.length}, ${symbolEvents.toLocaleString()} events`);
        }
      }
      
      totalEvents += symbolEvents;
      console.log(`[${symbol}] Done! ${symbolEvents.toLocaleString()} events\n`);
    }
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n========================================`);
    console.log(`COMPLETE: ${totalEvents.toLocaleString()} events in ${duration} min`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();