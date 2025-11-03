// Parallel Grid Processor - Fast version with batching and progress tracking
// Processes multiple combinations in parallel with connection pooling

import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  max: 20,  // Increased pool size for parallel processing
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Grid parameters
const BUY_PERCENTAGES = [];
const SELL_PERCENTAGES = [];

for (let i = 1; i <= 30; i++) {
  const pct = (i * 0.1).toFixed(1);
  BUY_PERCENTAGES.push(parseFloat(pct));
  SELL_PERCENTAGES.push(parseFloat(pct));
}

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH'];

// Parallel processing configuration
const BATCH_SIZE = 10;  // Process 10 combinations at once
const PROGRESS_FILE = 'grid-progress.json';

// Load or initialize progress
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  }
  return { completed: [], totalTrades: 0, lastUpdate: null };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Calculate baseline for a given day using previous trading day's data
async function calculateBaseline(client, symbol, method, session, tradingDay) {
  const prevDayResult = await client.query(`
    SELECT prev_open_date
    FROM trading_calendar
    WHERE cal_date = $1 AND is_open = true
  `, [tradingDay]);

  if (prevDayResult.rows.length === 0) {
    return null;
  }

  const prevDay = prevDayResult.rows[0].prev_open_date;
  if (!prevDay) {
    return null;
  }

  const baselineResult = await client.query(`
    SELECT baseline
    FROM baseline_daily
    WHERE trading_day = $1
      AND symbol = $2
      AND method = $3
      AND session = $4
  `, [prevDay, symbol, method, session]);

  if (baselineResult.rows.length === 0) {
    return null;
  }

  return parseFloat(baselineResult.rows[0].baseline);
}

// Simulate trades for a single day
async function simulateDay(client, symbol, method, session, tradingDay, buyPct, sellPct) {
  const baseline = await calculateBaseline(client, symbol, method, session, tradingDay);
  
  if (!baseline || !isFinite(baseline)) {
    return [];
  }

  const buyStrike = baseline * (1 + buyPct / 100);
  const sellStrike = baseline * (1 - sellPct / 100);

  const sessionFilter = session === 'RTH' 
    ? "AND s.et_time >= '09:30:00' AND s.et_time < '16:00:00'"
    : "AND ((s.et_time >= '04:00:00' AND s.et_time < '09:30:00') OR (s.et_time >= '16:00:00' AND s.et_time < '20:00:00'))";

  const dataResult = await client.query(`
    SELECT 
      s.et_time,
      s.close as stock_price,
      b.close as btc_price
    FROM minute_stock s
    JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
    WHERE s.et_date = $1
      AND s.symbol = $2
      ${sessionFilter}
    ORDER BY s.et_time
  `, [tradingDay, symbol]);

  if (dataResult.rows.length === 0) {
    return [];
  }

  const trades = [];
  let cash = 10000;
  let shares = 0;
  let position = null;

  for (const bar of dataResult.rows) {
    const stockPrice = parseFloat(bar.stock_price);
    const btcPrice = parseFloat(bar.btc_price);
    const currentRatio = btcPrice / stockPrice;

    if (!position) {
      if (currentRatio > buyStrike && cash >= stockPrice) {
        const sharesToBuy = Math.floor(cash / stockPrice);
        const cost = sharesToBuy * stockPrice;
        
        position = {
          entryTime: bar.et_time,
          entryPrice: stockPrice,
          entryBaseline: baseline,
          entryRatio: currentRatio,
          entryBtcPrice: btcPrice,
          shares: sharesToBuy
        };
        
        cash -= cost;
        shares = sharesToBuy;
      }
    } else {
      if (currentRatio < sellStrike && shares > 0) {
        const proceeds = shares * stockPrice;
        const returnDollars = proceeds - (position.shares * position.entryPrice);
        const returnPct = (returnDollars / (position.shares * position.entryPrice)) * 100;
        const stockDelta = ((stockPrice - position.entryPrice) / position.entryPrice) * 100;
        const btcDelta = ((btcPrice - position.entryBtcPrice) / position.entryBtcPrice) * 100;

        trades.push({
          entryDate: tradingDay,
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          entryBaseline: position.entryBaseline,
          entryRatio: position.entryRatio,
          entryBtcPrice: position.entryBtcPrice,
          exitDate: tradingDay,
          exitTime: bar.et_time,
          exitPrice: stockPrice,
          exitBaseline: baseline,
          exitRatio: currentRatio,
          exitBtcPrice: btcPrice,
          shares: position.shares,
          returnPct: returnPct,
          returnDollars: returnDollars,
          stockDelta: stockDelta,
          btcDelta: btcDelta
        });

        cash += proceeds;
        shares = 0;
        position = null;
      }
    }
  }

  return trades;
}

// Process a single combination
async function processCombo(symbol, method, session, buyPct, sellPct, startDate, endDate) {
  const client = await pool.connect();
  
  try {
    const daysResult = await client.query(`
      SELECT cal_date
      FROM trading_calendar
      WHERE cal_date BETWEEN $1 AND $2
        AND is_open = true
      ORDER BY cal_date
    `, [startDate, endDate]);

    const allTrades = [];

    for (const dayRow of daysResult.rows) {
      const tradingDay = dayRow.cal_date;
      const dayTrades = await simulateDay(client, symbol, method, session, tradingDay, buyPct, sellPct);
      allTrades.push(...dayTrades);
    }

    const tableName = session === 'RTH' ? 'precomputed_trades_grid_rth' : 'precomputed_trades_grid_ah';
    
    if (allTrades.length > 0) {
      for (const trade of allTrades) {
        await client.query(`
          INSERT INTO ${tableName} (
            symbol, method, buy_pct, sell_pct,
            entry_date, entry_time, entry_price, entry_baseline, entry_ratio, entry_btc_price,
            exit_date, exit_time, exit_price, exit_baseline, exit_ratio, exit_btc_price,
            shares, trade_return_pct, trade_return_dollars, stock_delta_pct, btc_delta_pct
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (symbol, method, buy_pct, sell_pct, entry_date, entry_time) DO NOTHING
        `, [
          symbol, method, buyPct, sellPct,
          trade.entryDate, trade.entryTime, trade.entryPrice, trade.entryBaseline, trade.entryRatio, trade.entryBtcPrice,
          trade.exitDate, trade.exitTime, trade.exitPrice, trade.exitBaseline, trade.exitRatio, trade.exitBtcPrice,
          trade.shares, trade.returnPct, trade.returnDollars, trade.stockDelta, trade.btcDelta
        ]);
      }
    }

    return allTrades.length;
  } finally {
    client.release();
  }
}

// Process batch of combinations in parallel
async function processBatch(batch, startDate, endDate) {
  const promises = batch.map(combo => 
    processCombo(combo.symbol, combo.method, combo.session, combo.buyPct, combo.sellPct, startDate, endDate)
      .catch(error => {
        console.error(`Error processing ${combo.symbol} ${combo.method} ${combo.session} ${combo.buyPct}/${combo.sellPct}:`, error.message);
        return 0;
      })
  );
  
  const results = await Promise.all(promises);
  return results.reduce((sum, count) => sum + count, 0);
}

// Main processing function
async function processGrid(startDate, endDate, resumeFrom = null) {
  console.log(`\n🚀 Starting Parallel Grid Processing`);
  console.log(`Date Range: ${startDate} to ${endDate}`);
  console.log(`Batch Size: ${BATCH_SIZE} combinations at once`);
  console.log(`Database Pool: ${pool.options.max} connections\n`);

  // Build list of all combinations
  const allCombos = [];
  for (const symbol of SYMBOLS) {
    for (const method of METHODS) {
      for (const session of SESSIONS) {
        for (const buyPct of BUY_PERCENTAGES) {
          for (const sellPct of SELL_PERCENTAGES) {
            allCombos.push({ symbol, method, session, buyPct, sellPct });
          }
        }
      }
    }
  }

  console.log(`Total Combinations: ${allCombos.length}\n`);

  // Load progress
  const progress = loadProgress();
  const completedSet = new Set(progress.completed);
  
  // Filter out already completed
  const remainingCombos = allCombos.filter(combo => {
    const key = `${combo.symbol}_${combo.method}_${combo.session}_${combo.buyPct}_${combo.sellPct}`;
    return !completedSet.has(key);
  });

  if (remainingCombos.length === 0) {
    console.log('✅ All combinations already processed!');
    return;
  }

  console.log(`Resuming: ${remainingCombos.length} combinations remaining\n`);

  let totalTrades = progress.totalTrades;
  let processed = allCombos.length - remainingCombos.length;

  // Process in batches
  for (let i = 0; i < remainingCombos.length; i += BATCH_SIZE) {
    const batch = remainingCombos.slice(i, Math.min(i + BATCH_SIZE, remainingCombos.length));
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(remainingCombos.length / BATCH_SIZE)}...`);
    
    const batchTrades = await processBatch(batch, startDate, endDate);
    totalTrades += batchTrades;
    processed += batch.length;

    // Mark as completed
    batch.forEach(combo => {
      const key = `${combo.symbol}_${combo.method}_${combo.session}_${combo.buyPct}_${combo.sellPct}`;
      progress.completed.push(key);
    });
    progress.totalTrades = totalTrades;
    progress.lastUpdate = new Date().toISOString();
    saveProgress(progress);

    const percentComplete = ((processed / allCombos.length) * 100).toFixed(1);
    console.log(`  ✓ Batch complete: ${processed}/${allCombos.length} (${percentComplete}%) - ${totalTrades} total trades\n`);
  }

  console.log(`\n✅ Grid Processing Complete!`);
  console.log(`Total Combinations: ${allCombos.length}`);
  console.log(`Total Trades: ${totalTrades}`);
  
  // Clean up progress file
  fs.unlinkSync(PROGRESS_FILE);
}

// Run the processor
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: node grid-processor-parallel.js <start_date> <end_date>');
  console.log('Example: node grid-processor-parallel.js 2025-09-01 2025-09-30');
  process.exit(1);
}

const startDate = args[0];
const endDate = args[1];

processGrid(startDate, endDate)
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });