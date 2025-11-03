#!/usr/bin/env node
/**
 * CRYPTO EVENT GENERATION - CORRECT VERSION
 * Generates individual BUY/SELL events (not trade pairs)
 * Matches the schema used by stock events
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const METHOD = process.env.METHOD;
const BUY_MAX = parseFloat(process.env.BUY_MAX || '3.0');
const SELL_MIN = parseFloat(process.env.SELL_MIN || '0.1');
const SELL_MAX = parseFloat(process.env.SELL_MAX || '3.0');
const START_DATE = process.env.START_DATE || '2024-05-01';
const END_DATE = process.env.END_DATE || '2025-11-02';
const BATCH_SIZE = 1500;

function generateCombinations() {
  const combinations = [];
  const buyStart = Math.round(SELL_MIN * 10);
  const buyEnd = Math.round(BUY_MAX * 10);
  const sellStart = Math.round(SELL_MIN * 10);
  const sellEnd = Math.round(SELL_MAX * 10);
  
  for (let buy = buyStart; buy <= buyEnd; buy++) {
    for (let sell = sellStart; sell <= sellEnd; sell++) {
      combinations.push({
        buy_pct: buy / 10,
        sell_pct: sell / 10
      });
    }
  }
  return combinations;
}

const COMBINATIONS = generateCombinations();
const TABLE_NAME = `trade_events_crypto_${METHOD.toLowerCase()}`;

console.log('\n========================================');
console.log(`Crypto Event Generation`);
console.log(`Table: ${TABLE_NAME}`);
console.log(`Method: ${METHOD}`);
console.log(`Date range: ${START_DATE} to ${END_DATE}`);
console.log(`Combinations: ${COMBINATIONS.length}`);
console.log(`Batch size: ${BATCH_SIZE}`);
console.log('========================================\n');

/**
 * Get the last event state for a symbol/combo
 * Returns true if expecting BUY, false if expecting SELL
 */
async function getLastEventState(client, symbol, buyPct, sellPct, beforeDate) {
  const result = await client.query(`
    SELECT event_type 
    FROM ${TABLE_NAME}
    WHERE symbol = $1 
      AND buy_pct = $2 
      AND sell_pct = $3
      AND event_timestamp < $4
    ORDER BY event_timestamp DESC
    LIMIT 1
  `, [symbol, buyPct, sellPct, beforeDate]);
  
  if (result.rows.length === 0) {
    return true; // No previous events, expecting BUY
  }
  
  // If last event was SELL, we're expecting BUY next
  return result.rows[0].event_type === 'SELL';
}

/**
 * Simulate trading for one symbol/combo
 * Returns array of BUY/SELL events
 */
function simulateTrading(minuteData, buyPct, sellPct, expectingBuy) {
  const events = [];
  
  for (const bar of minuteData) {
    const ratio = bar.btc_close / bar.crypto_close;
    const deviation = ((ratio - bar.baseline) / bar.baseline) * 100;
    const buyThreshold = bar.baseline * (1 + buyPct / 100);
    const sellThreshold = bar.baseline * (1 + sellPct / 100);
    
    // BUY signal
    if (expectingBuy && ratio >= buyThreshold) {
      events.push({
        event_timestamp: bar.timestamp,
        event_type: 'BUY',
        crypto_price: Math.round(bar.crypto_close * 100000000) / 100000000,
        btc_price: Math.round(bar.btc_close * 100) / 100,
        ratio: Math.round(ratio * 10000) / 10000,
        baseline: Math.round(bar.baseline * 10000) / 10000,
        trade_roi_pct: null
      });
      expectingBuy = false;
    }
    // SELL signal
    else if (!expectingBuy && ratio <= sellThreshold) {
      events.push({
        event_timestamp: bar.timestamp,
        event_type: 'SELL',
        crypto_price: Math.round(bar.crypto_close * 100000000) / 100000000,
        btc_price: Math.round(bar.btc_close * 100) / 100,
        ratio: Math.round(ratio * 10000) / 10000,
        baseline: Math.round(bar.baseline * 10000) / 10000,
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
  
  let inserted = 0;
  
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    
    const values = batch.map((_, idx) => {
      const offset = idx * 10;
      return `($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9},$${offset+10})`;
    }).join(',');
    
    const params = [];
    for (const event of batch) {
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
    }
    
    const result = await client.query(`
      INSERT INTO ${TABLE_NAME} (
        symbol, buy_pct, sell_pct, event_timestamp, event_type,
        crypto_price, btc_price, ratio, baseline, trade_roi_pct
      ) VALUES ${values}
      ON CONFLICT (symbol, buy_pct, sell_pct, event_timestamp) DO NOTHING
    `, params);
    
    inserted += result.rowCount;
  }
  
  return inserted;
}

/**
 * Main processing function
 */
async function processEvents() {
  const client = await pool.connect();
  
  try {
    const startTime = Date.now();
    
    // Get all symbols
    const symbolsResult = await client.query(
      'SELECT DISTINCT symbol FROM minute_crypto ORDER BY symbol'
    );
    const symbols = symbolsResult.rows.map(r => r.symbol);
    
    console.log(`Processing ${symbols.length} symbols...\n`);
    
    let totalEvents = 0;
    
    for (const symbol of symbols) {
      console.log(`\n=== Processing ${symbol} ===`);
      
      // Load all data for this symbol
      const dataResult = await client.query(`
        SELECT 
          mc.timestamp,
          mc.close as crypto_close,
          mbc.close as btc_close,
          bd.baseline
        FROM minute_crypto mc
        JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
        JOIN baseline_daily_crypto bd ON 
          DATE(mc.timestamp) = bd.trading_day 
          AND mc.symbol = bd.symbol 
          AND bd.method = $1
        WHERE mc.symbol = $2
          AND DATE(mc.timestamp) >= $3
          AND DATE(mc.timestamp) <= $4
        ORDER BY mc.timestamp
      `, [METHOD, symbol, START_DATE, END_DATE]);
      
      console.log(`  Loaded ${dataResult.rows.length} data points`);
      
      if (dataResult.rows.length === 0) {
        console.log(`  Skipping ${symbol} - no data`);
        continue;
      }
      
      // Process each combination
      let symbolEvents = 0;
      let processedCombos = 0;
      
      for (const combo of COMBINATIONS) {
        // Get starting state
        const expectingBuy = await getLastEventState(
          client, 
          symbol, 
          combo.buy_pct, 
          combo.sell_pct, 
          START_DATE
        );
        
        // Simulate trading
        const events = simulateTrading(
          dataResult.rows, 
          combo.buy_pct, 
          combo.sell_pct, 
          expectingBuy
        );
        
        // Insert events
        if (events.length > 0) {
          const inserted = await insertEventsBatch(
            client, 
            symbol, 
            combo.buy_pct, 
            combo.sell_pct, 
            events
          );
          symbolEvents += inserted;
          totalEvents += inserted;
        }
        
        processedCombos++;
        
        // Progress update
        if (processedCombos % 100 === 0) {
          console.log(`  Progress: ${processedCombos}/${COMBINATIONS.length} combos, ${symbolEvents.toLocaleString()} events`);
        }
      }
      
      console.log(`  ✓ ${symbol} complete: ${symbolEvents.toLocaleString()} events`);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n========================================');
    console.log(`✅ COMPLETE!`);
    console.log(`Total events: ${totalEvents.toLocaleString()}`);
    console.log(`Time: ${elapsed} minutes`);
    console.log('========================================\n');
    
  } finally {
    client.release();
    await pool.end();
  }
}

processEvents().catch(console.error);