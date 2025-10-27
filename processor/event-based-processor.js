/**
 * Event-Based Trade Processor
 * 
 * This processor runs continuous simulations across entire date ranges,
 * logging only BUY and SELL events (not every minute).
 * 
 * Key Features:
 * - Continuous wallet tracking (positions carry overnight)
 * - Fetches minute data once per symbol/method/session
 * - Processes all 900 buy/sell combinations in memory
 * - Batch inserts events to database
 * - Resumable and fault-tolerant
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Configuration
const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];
const INITIAL_CASH = 10000;

// Generate all buy/sell percentage combinations (0.1% to 3.0% in 0.1% increments)
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
console.log(`Generated ${COMBINATIONS.length} buy/sell combinations`);

/**
 * Fetch all minute data for a symbol/method/session combination
 */
async function fetchMinuteData(symbol, method, session, startDate, endDate) {
  const client = await pool.connect();
  try {
    let sessionFilter = '';
    if (session === 'RTH') {
      sessionFilter = "AND ms.is_rth = true";
    } else if (session === 'AH') {
      sessionFilter = "AND ms.is_rth = false";
    }
    // For 'ALL', no filter needed

    const query = `
      SELECT 
        ms.timestamp,
        ms.close as stock_price,
        mb.close as btc_price,
        mb.close / ms.close as ratio,
        bd.baseline,
        ms.is_rth
      FROM minute_stock ms
      JOIN minute_btc mb ON ms.timestamp = mb.timestamp
      JOIN baseline_daily bd ON 
        bd.symbol = ms.symbol 
        AND bd.method = $2
        AND bd.trading_day = (
          SELECT prev_open_date 
          FROM trading_calendar 
          WHERE open_date = ms.timestamp::date
        )
      WHERE ms.symbol = $1
        AND ms.timestamp::date BETWEEN $3 AND $4
        ${sessionFilter}
      ORDER BY ms.timestamp
    `;

    const result = await client.query(query, [symbol, method, startDate, endDate]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Run continuous simulation for a single combination
 * Returns array of trade events
 */
function simulateContinuous(minuteData, buyPct, sellPct) {
  const events = [];
  let cash = INITIAL_CASH;
  let shares = 0;

  for (const bar of minuteData) {
    const { timestamp, stock_price, btc_price, ratio, baseline } = bar;
    
    // Calculate thresholds
    const buyThreshold = baseline * (1 + buyPct / 100);
    const sellThreshold = baseline * (1 - sellPct / 100);

    // Check for BUY signal
    if (shares === 0 && ratio >= buyThreshold && cash > 0) {
      const sharesToBuy = Math.floor(cash / stock_price);
      if (sharesToBuy > 0) {
        const transactionValue = sharesToBuy * stock_price;
        cash -= transactionValue;
        shares = sharesToBuy;

        events.push({
          event_timestamp: timestamp,
          event_type: 'BUY',
          stock_price,
          btc_price,
          ratio,
          shares: sharesToBuy,
          transaction_value: transactionValue,
          cash_balance: cash,
          shares_held: shares,
          position_value: shares * stock_price,
          total_value: cash + (shares * stock_price)
        });
      }
    }
    // Check for SELL signal
    else if (shares > 0 && ratio <= sellThreshold) {
      const transactionValue = shares * stock_price;
      cash += transactionValue;
      const soldShares = shares;
      shares = 0;

      events.push({
        event_timestamp: timestamp,
        event_type: 'SELL',
        stock_price,
        btc_price,
        ratio,
        shares: soldShares,
        transaction_value: transactionValue,
        cash_balance: cash,
        shares_held: shares,
        position_value: 0,
        total_value: cash
      });
    }
  }

  return events;
}

/**
 * Batch insert events to database
 */
async function insertEvents(symbol, method, session, buyPct, sellPct, events) {
  if (events.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert events
    const insertQuery = `
      INSERT INTO trade_events (
        symbol, method, session, buy_pct, sell_pct,
        event_timestamp, event_type, stock_price, btc_price, ratio,
        shares, transaction_value, cash_balance, shares_held,
        position_value, total_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (symbol, method, session, buy_pct, sell_pct, event_timestamp) 
      DO NOTHING
    `;

    for (const event of events) {
      await client.query(insertQuery, [
        symbol, method, session, buyPct, sellPct,
        event.event_timestamp, event.event_type, event.stock_price,
        event.btc_price, event.ratio, event.shares, event.transaction_value,
        event.cash_balance, event.shares_held, event.position_value,
        event.total_value
      ]);
    }

    // Update metadata
    const lastEvent = events[events.length - 1];
    const buyCount = events.filter(e => e.event_type === 'BUY').length;
    const sellCount = events.filter(e => e.event_type === 'SELL').length;
    const finalROI = ((lastEvent.total_value - INITIAL_CASH) / INITIAL_CASH) * 100;

    const metadataQuery = `
      INSERT INTO simulation_metadata (
        symbol, method, session, buy_pct, sell_pct,
        status, first_event_date, last_event_date, last_processed_date,
        total_events, total_buys, total_sells, final_total_value, final_roi_pct,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (symbol, method, session, buy_pct, sell_pct)
      DO UPDATE SET
        status = $6,
        last_event_date = $8,
        last_processed_date = $9,
        total_events = simulation_metadata.total_events + $10,
        total_buys = simulation_metadata.total_buys + $11,
        total_sells = simulation_metadata.total_sells + $12,
        final_total_value = $13,
        final_roi_pct = $14,
        updated_at = NOW()
    `;

    await client.query(metadataQuery, [
      symbol, method, session, buyPct, sellPct,
      'completed',
      events[0].event_timestamp,
      lastEvent.event_timestamp,
      lastEvent.event_timestamp,
      events.length,
      buyCount,
      sellCount,
      lastEvent.total_value,
      finalROI
    ]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Process a single symbol/method/session combination
 */
async function processGroup(symbol, method, session, startDate, endDate) {
  console.log(`\nProcessing: ${symbol} - ${method} - ${session}`);
  console.log(`Date range: ${startDate} to ${endDate}`);

  const startTime = Date.now();

  try {
    // Fetch minute data once
    console.log('Fetching minute data...');
    const minuteData = await fetchMinuteData(symbol, method, session, startDate, endDate);
    console.log(`Fetched ${minuteData.length} minute bars`);

    if (minuteData.length === 0) {
      console.log('No data available, skipping...');
      return;
    }

    // Process all combinations
    let processedCount = 0;
    let totalEvents = 0;

    for (const combo of COMBINATIONS) {
      const { buy_pct, sell_pct } = combo;

      // Run simulation
      const events = simulateContinuous(minuteData, buy_pct, sell_pct);

      // Insert events
      if (events.length > 0) {
        await insertEvents(symbol, method, session, buy_pct, sell_pct, events);
        totalEvents += events.length;
      }

      processedCount++;

      // Progress update every 100 combinations
      if (processedCount % 100 === 0) {
        console.log(`  Processed ${processedCount}/${COMBINATIONS.length} combinations (${totalEvents} events)`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Completed in ${elapsed}s - ${processedCount} combinations, ${totalEvents} events`);

  } catch (error) {
    console.error(`✗ Error processing ${symbol}-${method}-${session}:`, error.message);
    throw error;
  }
}

/**
 * Main processing function
 */
async function processAll(startDate, endDate) {
  console.log('='.repeat(80));
  console.log('EVENT-BASED TRADE PROCESSOR');
  console.log('='.repeat(80));
  console.log(`Start Date: ${startDate}`);
  console.log(`End Date: ${endDate}`);
  console.log(`Symbols: ${SYMBOLS.length}`);
  console.log(`Methods: ${METHODS.length}`);
  console.log(`Sessions: ${SESSIONS.length}`);
  console.log(`Combinations per group: ${COMBINATIONS.length}`);
  console.log(`Total simulations: ${SYMBOLS.length * METHODS.length * SESSIONS.length * COMBINATIONS.length}`);
  console.log('='.repeat(80));

  const overallStart = Date.now();
  let completed = 0;
  let failed = 0;
  const total = SYMBOLS.length * METHODS.length * SESSIONS.length;

  for (const symbol of SYMBOLS) {
    for (const method of METHODS) {
      for (const session of SESSIONS) {
        try {
          await processGroup(symbol, method, session, startDate, endDate);
          completed++;
        } catch (error) {
          console.error(`Failed: ${symbol}-${method}-${session}`);
          failed++;
        }

        const progress = ((completed + failed) / total * 100).toFixed(1);
        console.log(`Progress: ${completed + failed}/${total} (${progress}%) - ${completed} completed, ${failed} failed`);
      }
    }
  }

  const totalElapsed = ((Date.now() - overallStart) / 1000 / 60).toFixed(2);
  console.log('\n' + '='.repeat(80));
  console.log('PROCESSING COMPLETE');
  console.log('='.repeat(80));
  console.log(`Total time: ${totalElapsed} minutes`);
  console.log(`Completed: ${completed}/${total}`);
  console.log(`Failed: ${failed}/${total}`);
  console.log('='.repeat(80));
}

/**
 * Process incremental updates (for nightly runs)
 */
async function processIncremental(targetDate) {
  console.log(`Processing incremental update for ${targetDate}`);
  
  // For incremental updates, we need to:
  // 1. Get the last event for each combination
  // 2. Continue simulation from that point
  // 3. Append new events
  
  // This is more complex and will be implemented after initial backfill
  console.log('Incremental processing not yet implemented');
  console.log('Use processAll() for now to reprocess entire history');
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node event-based-processor.js <start_date> <end_date>');
    console.log('Example: node event-based-processor.js 2024-01-01 2024-12-31');
    process.exit(1);
  }

  const [startDate, endDate] = args;

  processAll(startDate, endDate)
    .then(() => {
      console.log('Processing completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Processing failed:', error);
      process.exit(1);
    });
}

module.exports = {
  processAll,
  processIncremental,
  processGroup
};