import pg from 'pg';

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
const BUY_THRESHOLDS = Array.from({ length: 30 }, (_, i) => (i + 1) * 0.1);
const SELL_THRESHOLDS = Array.from({ length: 30 }, (_, i) => (i + 1) * 0.1);
const STARTING_CAPITAL = 10000;
const BATCH_SIZE = 500; // Insert trades in batches

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

// Initialize all simulation states in batches
async function initializeAllStates(client, startDate) {
  console.log('🔧 Initializing simulation states...');
  
  const combos = generateCombinations();
  const batchSize = 1000;
  let initialized = 0;
  
  for (let i = 0; i < combos.length; i += batchSize) {
    const batch = combos.slice(i, i + batchSize);
    const values = [];
    const params = [];
    let paramIndex = 1;
    
    for (const combo of batch) {
      values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, false, $${paramIndex+4}, $${paramIndex+5})`);
      params.push(combo.symbol, combo.method, combo.buyPct, combo.sellPct, startDate, '00:00:00');
      paramIndex += 6;
    }
    
    const query = `
      INSERT INTO simulation_state (
        symbol, baseline_method, buy_threshold_pct, sell_threshold_pct,
        has_position, last_processed_date, last_processed_time
      ) VALUES ${values.join(', ')}
      ON CONFLICT (symbol, baseline_method, buy_threshold_pct, sell_threshold_pct) 
      DO NOTHING
    `;
    
    await client.query(query, params);
    initialized += batch.length;
    
    if (initialized % 5000 === 0) {
      console.log(`  ✓ Initialized ${initialized}/${combos.length} states...`);
    }
  }
  
  console.log(`✅ Initialized ${combos.length} simulation states\n`);
}

// Load all states into memory
async function loadAllStates(client) {
  const result = await client.query(`
    SELECT * FROM simulation_state
    ORDER BY symbol, baseline_method, buy_threshold_pct, sell_threshold_pct
  `);
  
  const stateMap = {};
  for (const row of result.rows) {
    const key = `${row.symbol}|${row.baseline_method}|${row.buy_threshold_pct}|${row.sell_threshold_pct}`;
    stateMap[key] = {
      has_position: row.has_position,
      position_type: row.position_type,
      entry_date: row.entry_date,
      entry_time: row.entry_time,
      entry_session: row.entry_session,
      entry_price: row.entry_price ? parseFloat(row.entry_price) : null,
      entry_baseline: row.entry_baseline ? parseFloat(row.entry_baseline) : null,
      shares: row.shares,
      last_processed_date: row.last_processed_date,
      last_processed_time: row.last_processed_time
    };
  }
  
  return stateMap;
}

// Load baseline data for date range
async function loadBaselines(client, startDate, endDate) {
  console.log('📊 Loading baseline data...');
  
  const result = await client.query(`
    SELECT 
      bd.symbol,
      bd.method,
      bd.trading_day,
      bd.baseline,
      tc.cal_date
    FROM baseline_daily bd
    JOIN trading_calendar tc ON bd.trading_day = tc.prev_open_date
    WHERE tc.cal_date >= $1 AND tc.cal_date <= $2
    AND bd.session = 'RTH'
    ORDER BY tc.cal_date, bd.symbol, bd.method
  `, [startDate, endDate]);
  
  const baselineMap = {};
  for (const row of result.rows) {
    const key = `${row.cal_date.toISOString().split('T')[0]}|${row.symbol}|${row.method}`;
    baselineMap[key] = parseFloat(row.baseline);
  }
  
  console.log(`✅ Loaded ${result.rows.length} baselines\n`);
  return baselineMap;
}

// Load all minute bars for a day
async function loadDayBars(client, date) {
  const result = await client.query(`
    SELECT symbol, et_date, et_time, session, close
    FROM minute_stock
    WHERE et_date = $1
    ORDER BY symbol, et_time
  `, [date]);
  
  const barsBySymbol = {};
  for (const row of result.rows) {
    if (!barsBySymbol[row.symbol]) {
      barsBySymbol[row.symbol] = [];
    }
    barsBySymbol[row.symbol].push({
      date: row.et_date,
      time: row.et_time,
      session: row.session,
      close: parseFloat(row.close)
    });
  }
  
  return barsBySymbol;
}

// Batch insert trades
async function batchInsertTrades(client, trades) {
  if (trades.length === 0) return;
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const trade of trades) {
    values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13}, $${paramIndex+14}, $${paramIndex+15}, $${paramIndex+16}, $${paramIndex+17}, $${paramIndex+18}, $${paramIndex+19})`);
    params.push(
      trade.symbol, trade.method, trade.buyPct, trade.sellPct,
      trade.entry_date, trade.entry_time, trade.entry_session, trade.entry_price, trade.entry_baseline,
      trade.exit_date, trade.exit_time, trade.exit_session, trade.exit_price, trade.exit_baseline,
      trade.position_type, trade.shares, trade.trade_return_pct, trade.trade_return_dollars,
      trade.stock_delta_pct, trade.btc_delta_pct
    );
    paramIndex += 20;
  }
  
  const query = `
    INSERT INTO precomputed_trades (
      symbol, baseline_method, buy_threshold_pct, sell_threshold_pct,
      entry_date, entry_time, entry_session, entry_price, entry_baseline,
      exit_date, exit_time, exit_session, exit_price, exit_baseline,
      position_type, shares, trade_return_pct, trade_return_dollars,
      stock_delta_pct, btc_delta_pct
    ) VALUES ${values.join(', ')}
    ON CONFLICT (symbol, baseline_method, buy_threshold_pct, sell_threshold_pct, entry_date, entry_time)
    DO NOTHING
  `;
  
  await client.query(query, params);
}

// Batch update states in chunks
async function batchUpdateStates(client, states) {
  if (states.length === 0) return;
  
  const chunkSize = 1000;
  
  for (let i = 0; i < states.length; i += chunkSize) {
    const chunk = states.slice(i, i + chunkSize);
    
    // Use temporary table for bulk update
    await client.query('CREATE TEMP TABLE temp_states (LIKE simulation_state INCLUDING ALL) ON COMMIT DROP');
    
    const values = [];
    const params = [];
    let paramIndex = 1;
    
    for (const state of chunk) {
      values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12}, $${paramIndex+13})`);
      params.push(
        state.symbol, state.method, state.buyPct, state.sellPct,
        state.has_position, state.position_type, state.entry_date, state.entry_time,
        state.entry_session, state.entry_price, state.entry_baseline, state.shares,
        state.last_processed_date, state.last_processed_time
      );
      paramIndex += 14;
    }
    
    await client.query(`
      INSERT INTO temp_states (
        symbol, baseline_method, buy_threshold_pct, sell_threshold_pct,
        has_position, position_type, entry_date, entry_time, entry_session,
        entry_price, entry_baseline, shares, last_processed_date, last_processed_time
      ) VALUES ${values.join(', ')}
    `, params);
    
    await client.query(`
      UPDATE simulation_state s
      SET 
        has_position = t.has_position,
        position_type = t.position_type,
        entry_date = t.entry_date,
        entry_time = t.entry_time,
        entry_session = t.entry_session,
        entry_price = t.entry_price,
        entry_baseline = t.entry_baseline,
        shares = t.shares,
        last_processed_date = t.last_processed_date,
        last_processed_time = t.last_processed_time,
        updated_at = CURRENT_TIMESTAMP
      FROM temp_states t
      WHERE s.symbol = t.symbol
      AND s.baseline_method = t.baseline_method
      AND s.buy_threshold_pct = t.buy_threshold_pct
      AND s.sell_threshold_pct = t.sell_threshold_pct
    `);
  }
}

// Process one day for all combinations (IN MEMORY)
async function processDay(date, stateMap, baselineMap, barsBySymbol) {
  const combos = generateCombinations();
  const tradeBatch = [];
  const stateUpdates = [];
  let tradesLogged = 0;
  
  for (const combo of combos) {
    const key = `${combo.symbol}|${combo.method}|${combo.buyPct}|${combo.sellPct}`;
    const state = stateMap[key];
    
    if (!state) continue;
    
    const baselineKey = `${date}|${combo.symbol}|${combo.method}`;
    const baseline = baselineMap[baselineKey];
    
    if (!baseline) continue;
    
    const bars = barsBySymbol[combo.symbol] || [];
    const buyThreshold = baseline * (1 - combo.buyPct / 100);
    const sellThreshold = baseline * (1 + combo.sellPct / 100);
    
    for (const bar of bars) {
      const price = bar.close;
      
      // Check for entry
      if (!state.has_position && price <= buyThreshold) {
        const shares = Math.floor(STARTING_CAPITAL / price);
        state.has_position = true;
        state.position_type = 'LONG';
        state.entry_date = bar.date;
        state.entry_time = bar.time;
        state.entry_session = bar.session;
        state.entry_price = price;
        state.entry_baseline = baseline;
        state.shares = shares;
      }
      // Check for exit
      else if (state.has_position && price >= sellThreshold) {
        const returnPct = ((price - state.entry_price) / state.entry_price) * 100;
        const returnDollars = (price - state.entry_price) * state.shares;
        const stockDelta = returnPct;
        
        tradeBatch.push({
          symbol: combo.symbol,
          method: combo.method,
          buyPct: combo.buyPct,
          sellPct: combo.sellPct,
          entry_date: state.entry_date,
          entry_time: state.entry_time,
          entry_session: state.entry_session,
          entry_price: state.entry_price,
          entry_baseline: state.entry_baseline,
          exit_date: bar.date,
          exit_time: bar.time,
          exit_session: bar.session,
          exit_price: price,
          exit_baseline: baseline,
          position_type: state.position_type,
          shares: state.shares,
          trade_return_pct: returnPct,
          trade_return_dollars: returnDollars,
          stock_delta_pct: stockDelta,
          btc_delta_pct: null
        });
        
        tradesLogged++;
        
        // Reset position
        state.has_position = false;
        state.position_type = null;
        state.entry_date = null;
        state.entry_time = null;
        state.entry_session = null;
        state.entry_price = null;
        state.entry_baseline = null;
        state.shares = null;
      }
      
      state.last_processed_date = bar.date;
      state.last_processed_time = bar.time;
    }
    
    stateUpdates.push({
      symbol: combo.symbol,
      method: combo.method,
      buyPct: combo.buyPct,
      sellPct: combo.sellPct,
      ...state
    });
  }
  
  return { tradeBatch, stateUpdates, tradesLogged };
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node nightly-processor-optimized.js <date> [end-date]');
    console.error('Example: node nightly-processor-optimized.js 2024-01-02');
    console.error('Example: node nightly-processor-optimized.js 2024-01-02 2024-01-09');
    process.exit(1);
  }

  const startDate = args[0];
  const endDate = args[1] || startDate;

  console.log('🚀 TRADIAC Nightly Processor (OPTIMIZED)');
  console.log('═══════════════════════════════════════');
  console.log(`Start Date: ${startDate}`);
  console.log(`End Date: ${endDate}`);
  console.log(`Combinations: ${STOCKS.length * METHODS.length * BUY_THRESHOLDS.length * SELL_THRESHOLDS.length}`);
  console.log('═══════════════════════════════════════\n');

  const client = await pool.connect();
  
  try {
    // Get trading days
    const datesResult = await client.query(`
      SELECT cal_date FROM trading_calendar
      WHERE cal_date >= $1 AND cal_date <= $2 AND is_open = true
      ORDER BY cal_date
    `, [startDate, endDate]);

    const tradingDays = datesResult.rows.map(r => r.cal_date.toISOString().split('T')[0]);
    console.log(`📊 Found ${tradingDays.length} trading days to process\n`);

    // Initialize states
    await initializeAllStates(client, tradingDays[0]);
    
    // Load all data into memory
    const stateMap = await loadAllStates(client);
    const baselineMap = await loadBaselines(client, startDate, endDate);
    
    console.log('🔥 Processing days...\n');
    
    let totalTrades = 0;
    const startTime = Date.now();

    for (let i = 0; i < tradingDays.length; i++) {
      const day = tradingDays[i];
      const dayStart = Date.now();
      
      console.log(`📅 Processing ${day}...`);
      
      // Load bars for this day
      const barsBySymbol = await loadDayBars(client, day);
      
      // Process in memory
      const result = await processDay(day, stateMap, baselineMap, barsBySymbol);
      
      // Batch insert trades
      if (result.tradeBatch.length > 0) {
        await batchInsertTrades(client, result.tradeBatch);
      }
      
      // Batch update states
      await batchUpdateStates(client, result.stateUpdates);
      
      totalTrades += result.tradesLogged;
      
      const dayTime = ((Date.now() - dayStart) / 1000).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const avgPerDay = elapsed / (i + 1);
      const remaining = avgPerDay * (tradingDays.length - i - 1);
      
      console.log(`✅ Complete: ${result.tradesLogged} trades | ${dayTime}s | ETA: ${Math.round(remaining / 60)} min\n`);
    }

    const totalTime = (Date.now() - startTime) / 1000;
    
    console.log('═══════════════════════════════════════');
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