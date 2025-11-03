import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

// Configuration
const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const BUY_THRESHOLDS = Array.from({ length: 30 }, (_, i) => (i + 1) * 0.1); // 0.1 to 3.0
const SELL_THRESHOLDS = Array.from({ length: 30 }, (_, i) => (i + 1) * 0.1); // 0.1 to 3.0
const STARTING_CAPITAL = 10000;

// Generate all combinations
function generateCombinations() {
  const combos = [];
  for (const symbol of STOCKS) {
    for (const method of METHODS) {
      for (const buyPct of BUY_THRESHOLDS) {
        for (const sellPct of SELL_THRESHOLDS) {
          combos.push({
            symbol,
            method,
            buyPct: Number(buyPct.toFixed(1)),
            sellPct: Number(sellPct.toFixed(1))
          });
        }
      }
    }
  }
  return combos;
}

// Get or initialize simulation state
async function getSimulationState(client, combo) {
  const result = await client.query(`
    SELECT * FROM simulation_state
    WHERE symbol = $1 
    AND baseline_method = $2 
    AND buy_threshold_pct = $3 
    AND sell_threshold_pct = $4
  `, [combo.symbol, combo.method, combo.buyPct, combo.sellPct]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Initialize new state
  await client.query(`
    INSERT INTO simulation_state (
      symbol, baseline_method, buy_threshold_pct, sell_threshold_pct,
      has_position, last_processed_date, last_processed_time
    ) VALUES ($1, $2, $3, $4, false, '2024-01-01', '00:00:00')
  `, [combo.symbol, combo.method, combo.buyPct, combo.sellPct]);

  return {
    symbol: combo.symbol,
    baseline_method: combo.method,
    buy_threshold_pct: combo.buyPct,
    sell_threshold_pct: combo.sellPct,
    has_position: false,
    last_processed_date: new Date('2024-01-01'),
    last_processed_time: '00:00:00'
  };
}

// Update simulation state
async function updateSimulationState(client, combo, state) {
  await client.query(`
    UPDATE simulation_state
    SET has_position = $1,
        position_type = $2,
        entry_date = $3,
        entry_time = $4,
        entry_session = $5,
        entry_price = $6,
        entry_baseline = $7,
        shares = $8,
        last_processed_date = $9,
        last_processed_time = $10,
        updated_at = CURRENT_TIMESTAMP
    WHERE symbol = $11 
    AND baseline_method = $12 
    AND buy_threshold_pct = $13 
    AND sell_threshold_pct = $14
  `, [
    state.has_position,
    state.position_type,
    state.entry_date,
    state.entry_time,
    state.entry_session,
    state.entry_price,
    state.entry_baseline,
    state.shares,
    state.last_processed_date,
    state.last_processed_time,
    combo.symbol,
    combo.method,
    combo.buyPct,
    combo.sellPct
  ]);
}

// Log completed trade
async function logTrade(client, combo, trade) {
  await client.query(`
    INSERT INTO precomputed_trades (
      symbol, baseline_method, buy_threshold_pct, sell_threshold_pct,
      entry_date, entry_time, entry_session, entry_price, entry_baseline,
      exit_date, exit_time, exit_session, exit_price, exit_baseline,
      position_type, shares, trade_return_pct, trade_return_dollars,
      stock_delta_pct, btc_delta_pct
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (symbol, baseline_method, buy_threshold_pct, sell_threshold_pct, entry_date, entry_time)
    DO NOTHING
  `, [
    combo.symbol,
    combo.method,
    combo.buyPct,
    combo.sellPct,
    trade.entry_date,
    trade.entry_time,
    trade.entry_session,
    trade.entry_price,
    trade.entry_baseline,
    trade.exit_date,
    trade.exit_time,
    trade.exit_session,
    trade.exit_price,
    trade.exit_baseline,
    trade.position_type,
    trade.shares,
    trade.trade_return_pct,
    trade.trade_return_dollars,
    trade.stock_delta_pct,
    trade.btc_delta_pct
  ]);
}

// Simulate one combination for one day
async function simulateComboDay(client, combo, targetDate, state) {
  // Get baseline for previous trading day
  const baselineResult = await client.query(`
    SELECT tc.prev_open_date, bd.baseline
    FROM trading_calendar tc
    JOIN baseline_daily bd ON bd.trading_day = tc.prev_open_date
    WHERE tc.cal_date = $1
    AND bd.symbol = $2
    AND bd.method = $3
    AND bd.session = 'RTH'
  `, [targetDate, combo.symbol, combo.method]);

  if (baselineResult.rows.length === 0) {
    return { state, tradesLogged: 0 };
  }

  const baseline = parseFloat(baselineResult.rows[0].baseline);
  const buyThreshold = baseline * (1 - combo.buyPct / 100);
  const sellThreshold = baseline * (1 + combo.sellPct / 100);

  // Get minute bars for this day
  const barsResult = await client.query(`
    SELECT et_date, et_time, session, open, high, low, close
    FROM minute_stock
    WHERE symbol = $1 AND et_date = $2
    ORDER BY et_date, et_time
  `, [combo.symbol, targetDate]);

  let tradesLogged = 0;
  let currentState = { ...state };

  for (const bar of barsResult.rows) {
    const price = parseFloat(bar.close);

    // Check for entry signal (no position)
    if (!currentState.has_position && price <= buyThreshold) {
      const shares = Math.floor(STARTING_CAPITAL / price);
      currentState = {
        has_position: true,
        position_type: 'LONG',
        entry_date: bar.et_date,
        entry_time: bar.et_time,
        entry_session: bar.session,
        entry_price: price,
        entry_baseline: baseline,
        shares: shares,
        last_processed_date: bar.et_date,
        last_processed_time: bar.et_time
      };
    }
    // Check for exit signal (has position)
    else if (currentState.has_position && price >= sellThreshold) {
      const returnPct = ((price - currentState.entry_price) / currentState.entry_price) * 100;
      const returnDollars = (price - currentState.entry_price) * currentState.shares;
      const stockDelta = ((price - currentState.entry_price) / currentState.entry_price) * 100;

      // Get BTC delta
      const btcResult = await client.query(`
        SELECT 
          (SELECT close FROM minute_btc WHERE et_date = $1 AND et_time = $2) as exit_btc,
          (SELECT close FROM minute_btc WHERE et_date = $3 AND et_time = $4) as entry_btc
      `, [bar.et_date, bar.et_time, currentState.entry_date, currentState.entry_time]);

      let btcDelta = null;
      if (btcResult.rows.length > 0 && btcResult.rows[0].entry_btc && btcResult.rows[0].exit_btc) {
        const entryBtc = parseFloat(btcResult.rows[0].entry_btc);
        const exitBtc = parseFloat(btcResult.rows[0].exit_btc);
        btcDelta = ((exitBtc - entryBtc) / entryBtc) * 100;
      }

      // Log the completed trade
      await logTrade(client, combo, {
        entry_date: currentState.entry_date,
        entry_time: currentState.entry_time,
        entry_session: currentState.entry_session,
        entry_price: currentState.entry_price,
        entry_baseline: currentState.entry_baseline,
        exit_date: bar.et_date,
        exit_time: bar.et_time,
        exit_session: bar.session,
        exit_price: price,
        exit_baseline: baseline,
        position_type: currentState.position_type,
        shares: currentState.shares,
        trade_return_pct: returnPct,
        trade_return_dollars: returnDollars,
        stock_delta_pct: stockDelta,
        btc_delta_pct: btcDelta
      });

      tradesLogged++;

      // Reset position
      currentState = {
        has_position: false,
        position_type: null,
        entry_date: null,
        entry_time: null,
        entry_session: null,
        entry_price: null,
        entry_baseline: null,
        shares: null,
        last_processed_date: bar.et_date,
        last_processed_time: bar.et_time
      };
    } else {
      // Just update last processed time
      currentState.last_processed_date = bar.et_date;
      currentState.last_processed_time = bar.et_time;
    }
  }

  return { state: currentState, tradesLogged };
}

// Process one day for all combinations
async function processDay(targetDate) {
  const client = await pool.connect();
  
  try {
    console.log(`\n📅 Processing ${targetDate}...`);
    
    const combinations = generateCombinations();
    let totalTrades = 0;
    let processedCombos = 0;

    for (const combo of combinations) {
      const state = await getSimulationState(client, combo);
      const result = await simulateComboDay(client, combo, targetDate, state);
      await updateSimulationState(client, combo, result.state);
      
      totalTrades += result.tradesLogged;
      processedCombos++;

      if (processedCombos % 1000 === 0) {
        console.log(`  ✓ Processed ${processedCombos}/${combinations.length} combinations...`);
      }
    }

    console.log(`✅ Day complete: ${totalTrades} trades logged, ${processedCombos} states updated`);
    
    return { tradesLogged: totalTrades, statesUpdated: processedCombos };
    
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node nightly-processor.js <date> [end-date]');
    console.error('Example: node nightly-processor.js 2024-01-02');
    console.error('Example: node nightly-processor.js 2024-01-02 2024-01-09');
    process.exit(1);
  }

  const startDate = args[0];
  const endDate = args[1] || startDate;

  console.log('🚀 TRADIAC Nightly Processor');
  console.log('═══════════════════════════════════════');
  console.log(`Start Date: ${startDate}`);
  console.log(`End Date: ${endDate}`);
  console.log(`Combinations: ${STOCKS.length * METHODS.length * BUY_THRESHOLDS.length * SELL_THRESHOLDS.length}`);
  console.log('═══════════════════════════════════════\n');

  const client = await pool.connect();
  
  try {
    // Get all trading days in range
    const datesResult = await client.query(`
      SELECT cal_date FROM trading_calendar
      WHERE cal_date >= $1 AND cal_date <= $2 AND is_open = true
      ORDER BY cal_date
    `, [startDate, endDate]);

    const tradingDays = datesResult.rows.map(r => r.cal_date.toISOString().split('T')[0]);
    
    console.log(`📊 Found ${tradingDays.length} trading days to process\n`);

    let totalTrades = 0;
    const startTime = Date.now();

    for (let i = 0; i < tradingDays.length; i++) {
      const day = tradingDays[i];
      const result = await processDay(day);
      totalTrades += result.tradesLogged;

      const elapsed = (Date.now() - startTime) / 1000;
      const avgPerDay = elapsed / (i + 1);
      const remaining = avgPerDay * (tradingDays.length - i - 1);
      
      console.log(`⏱️  Progress: ${i + 1}/${tradingDays.length} days | ETA: ${Math.round(remaining / 60)} minutes\n`);
    }

    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ PROCESSING COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`Total Days: ${tradingDays.length}`);
    console.log(`Total Trades: ${totalTrades}`);
    console.log(`Total Time: ${Math.round(totalTime / 60)} minutes`);
    console.log(`Avg per Day: ${(totalTime / tradingDays.length).toFixed(1)} seconds`);
    console.log('═══════════════════════════════════════\n');

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