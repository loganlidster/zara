#!/usr/bin/env node

/**
 * Event Update Job - Daily Incremental Processor
 * 
 * This job processes ONE day of new data and extends the existing trade_events tables.
 * It handles wallet continuity by checking the last event in each table to determine
 * the starting state (cash vs shares held).
 * 
 * Usage:
 *   TARGET_DATE=2025-10-24 node event-update-job.js
 *   (defaults to yesterday if not specified)
 * 
 * Processes:
 * - 11 symbols
 * - 5 methods (EQUAL_MEAN, VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN)
 * - 2 sessions (RTH, AH)
 * - 900 buy/sell combinations per symbol+method+session
 * 
 * Total: 11 × 5 × 2 × 900 = 99,000 simulations per day
 */

import pg from 'pg';

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
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Configuration
const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH'];
const INITIAL_CASH = 10000;

// Generate all buy/sell combinations (0.1% to 3.0% in 0.1% increments)
function generateCombinations() {
  const combinations = [];
  for (let buy = 0.1; buy <= 3.0; buy += 0.1) {
    for (let sell = 0.1; sell <= 3.0; sell += 0.1) {
      combinations.push({
        buy_pct: Math.round(buy * 10) / 10,
        sell_pct: Math.round(sell * 10) / 10
      });
    }
  }
  return combinations;
}

const COMBINATIONS = generateCombinations();

// Get table name for method+session
function getTableName(method, session) {
  const methodLower = method.toLowerCase();
  const sessionLower = session.toLowerCase();
  return `trade_events_${sessionLower}_${methodLower}`;
}

/**
 * Get the last event for a specific combination to determine starting state
 */
async function getLastEventState(client, tableName, symbol, buyPct, sellPct) {
  const query = `
    SELECT event_type, stock_price, event_date, event_time
    FROM ${tableName}
    WHERE symbol = $1 
      AND buy_pct = $2 
      AND sell_pct = $3
    ORDER BY event_date DESC, event_time DESC
    LIMIT 1
  `;
  
  const result = await client.query(query, [symbol, buyPct, sellPct]);
  
  if (result.rows.length === 0) {
    // No previous events - start with cash
    return { hasCash: true, hasShares: false, lastPrice: null };
  }
  
  const lastEvent = result.rows[0];
  if (lastEvent.event_type === 'BUY') {
    // Last event was BUY - we're holding shares
    return { hasCash: false, hasShares: true, lastPrice: parseFloat(lastEvent.stock_price) };
  } else {
    // Last event was SELL - we have cash
    return { hasCash: true, hasShares: false, lastPrice: null };
  }
}

/**
 * Fetch minute data for a single day
 */
async function fetchDayData(client, symbol, method, session, targetDate) {
  const query = `
    SELECT 
      ms.et_date,
      ms.et_time,
      ms.close as stock_price,
      mb.close as btc_price,
      mb.close / ms.close as ratio,
      bd.baseline
    FROM minute_stock ms
    JOIN minute_btc mb ON ms.et_date = mb.et_date AND ms.et_time = mb.et_time
    JOIN trading_calendar tc ON ms.et_date = tc.cal_date
    JOIN baseline_daily bd ON 
      bd.symbol = ms.symbol 
      AND bd.method = $2
      AND bd.session = ms.session
      AND bd.trading_day = tc.prev_open_date
    WHERE ms.et_date = $1
      AND ms.symbol = $3
      AND ms.session = $4
      AND tc.is_open = true
    ORDER BY ms.et_time
  `;
  
  const result = await client.query(query, [targetDate, method, symbol, session]);
  return result.rows;
}

/**
 * Simulate one day for a single combination, starting from previous state
 */
function simulateDay(minuteData, buyPct, sellPct, startState) {
  const events = [];
  let cash = startState.hasCash ? INITIAL_CASH : 0;
  let shares = startState.hasShares ? Math.floor(INITIAL_CASH / startState.lastPrice) : 0;
  
  for (const bar of minuteData) {
    const stockPrice = parseFloat(bar.stock_price);
    const btcPrice = parseFloat(bar.btc_price);
    const ratio = parseFloat(bar.ratio);
    const baseline = parseFloat(bar.baseline);
    
    const buyThreshold = baseline * (1 + buyPct / 100);
    const sellThreshold = baseline * (1 - sellPct / 100);
    
    // BUY signal
    if (shares === 0 && ratio >= buyThreshold && cash > 0) {
      const sharesToBuy = Math.floor(cash / stockPrice);
      if (sharesToBuy > 0) {
        cash = 0;
        shares = sharesToBuy;
        
        events.push({
          event_date: bar.et_date,
          event_time: bar.et_time,
          event_type: 'BUY',
          stock_price: Math.round(stockPrice * 10000) / 10000,
          btc_price: Math.round(btcPrice * 100) / 100,
          ratio: Math.round(ratio * 10000) / 10000,
          baseline: Math.round(baseline * 10000) / 10000,
          trade_roi_pct: null
        });
      }
    }
    // SELL signal
    else if (shares > 0 && ratio <= sellThreshold) {
      const saleValue = shares * stockPrice;
      const roi = ((saleValue - INITIAL_CASH) / INITIAL_CASH) * 100;
      cash = saleValue;
      shares = 0;
      
      events.push({
        event_date: bar.et_date,
        event_time: bar.et_time,
        event_type: 'SELL',
        stock_price: Math.round(stockPrice * 10000) / 10000,
        btc_price: Math.round(btcPrice * 100) / 100,
        ratio: Math.round(ratio * 10000) / 10000,
        baseline: Math.round(baseline * 10000) / 10000,
        trade_roi_pct: Math.round(roi * 100) / 100
      });
    }
  }
  
  return events;
}

/**
 * Insert events into the appropriate specialized table
 */
async function insertEvents(client, tableName, symbol, buyPct, sellPct, events) {
  if (events.length === 0) return 0;
  
  const insertQuery = `
    INSERT INTO ${tableName} (
      symbol, buy_pct, sell_pct,
      event_date, event_time, event_type,
      stock_price, btc_price, ratio, baseline, trade_roi_pct
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (symbol, buy_pct, sell_pct, event_date, event_time)
    DO NOTHING
  `;
  
  let inserted = 0;
  for (const event of events) {
    const result = await client.query(insertQuery, [
      symbol,
      buyPct,
      sellPct,
      event.event_date,
      event.event_time,
      event.event_type,
      event.stock_price,
      event.btc_price,
      event.ratio,
      event.baseline,
      event.trade_roi_pct
    ]);
    inserted += result.rowCount;
  }
  
  return inserted;
}

/**
 * Process one symbol+method+session combination for the target date
 */
async function processGroup(symbol, method, session, targetDate) {
  const client = await pool.connect();
  const tableName = getTableName(method, session);
  
  try {
    console.log(`\n[${symbol}/${method}/${session}] Starting...`);
    
    // Fetch minute data for this day
    const minuteData = await fetchDayData(client, symbol, method, session, targetDate);
    
    if (minuteData.length === 0) {
      console.log(`[${symbol}/${method}/${session}] No data for ${targetDate}`);
      return { success: true, events: 0, combinations: 0 };
    }
    
    console.log(`[${symbol}/${method}/${session}] Fetched ${minuteData.length} minute bars`);
    
    // Process all 900 combinations
    let totalEvents = 0;
    let processedCombos = 0;
    
    await client.query('BEGIN');
    
    for (const combo of COMBINATIONS) {
      // Get starting state from last event
      const startState = await getLastEventState(client, tableName, symbol, combo.buy_pct, combo.sell_pct);
      
      // Simulate this day
      const events = simulateDay(minuteData, combo.buy_pct, combo.sell_pct, startState);
      
      // Insert events
      if (events.length > 0) {
        const inserted = await insertEvents(client, tableName, symbol, combo.buy_pct, combo.sell_pct, events);
        totalEvents += inserted;
      }
      
      processedCombos++;
      
      // Progress update every 100 combos
      if (processedCombos % 100 === 0) {
        console.log(`[${symbol}/${method}/${session}] Processed ${processedCombos}/900 combinations, ${totalEvents} events`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`[${symbol}/${method}/${session}] ✓ Complete: ${totalEvents} events from ${processedCombos} combinations`);
    
    return { success: true, events: totalEvents, combinations: processedCombos };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[${symbol}/${method}/${session}] ✗ Error:`, error.message);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();
  
  // Get target date (default to yesterday)
  const targetDate = process.env.TARGET_DATE || (() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  })();
  
  console.log('='.repeat(80));
  console.log('EVENT UPDATE JOB - Incremental Daily Processor');
  console.log('='.repeat(80));
  console.log(`Target Date: ${targetDate}`);
  console.log(`Symbols: ${SYMBOLS.length}`);
  console.log(`Methods: ${METHODS.length}`);
  console.log(`Sessions: ${SESSIONS.length}`);
  console.log(`Combinations per group: ${COMBINATIONS.length}`);
  console.log(`Total groups to process: ${SYMBOLS.length * METHODS.length * SESSIONS.length}`);
  console.log('='.repeat(80));
  
  const results = [];
  let totalEvents = 0;
  let successCount = 0;
  let failureCount = 0;
  
  // Process each symbol+method+session combination
  for (const symbol of SYMBOLS) {
    for (const method of METHODS) {
      for (const session of SESSIONS) {
        const result = await processGroup(symbol, method, session, targetDate);
        results.push({ symbol, method, session, ...result });
        
        if (result.success) {
          successCount++;
          totalEvents += result.events;
        } else {
          failureCount++;
        }
      }
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Duration: ${duration} seconds`);
  console.log(`Success: ${successCount}/${results.length}`);
  console.log(`Failures: ${failureCount}/${results.length}`);
  console.log(`Total Events Inserted: ${totalEvents.toLocaleString()}`);
  console.log('='.repeat(80));
  
  if (failureCount > 0) {
    console.log('\nFailed Groups:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.symbol}/${r.method}/${r.session}: ${r.error}`);
    });
  }
  
  await pool.end();
  
  process.exit(failureCount > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { processGroup, getLastEventState, simulateDay };