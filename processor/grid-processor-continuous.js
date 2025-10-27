// Continuous Grid Processor - Three Separate Tables
// Each table is a complete continuous simulation within its session
// RTH Only, AH Only, and ALL Hours

import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';

const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  max: 20,
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
const SESSIONS = ['RTH', 'AH', 'ALL'];

const PROGRESS_FILE = 'grid-progress-continuous.json';

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

// Get baseline for a specific date and session
async function getBaseline(client, symbol, method, session, tradingDay) {
  const prevDayResult = await client.query(`
    SELECT prev_open_date
    FROM trading_calendar
    WHERE cal_date = $1 AND is_open = true
  `, [tradingDay]);

  if (prevDayResult.rows.length === 0) return null;
  
  const prevDay = prevDayResult.rows[0].prev_open_date;
  if (!prevDay) return null;

  const baselineResult = await client.query(`
    SELECT baseline
    FROM baseline_daily
    WHERE trading_day = $1
      AND symbol = $2
      AND method = $3
      AND session = $4
  `, [prevDay, symbol, method, session]);

  if (baselineResult.rows.length === 0) return null;
  
  return parseFloat(baselineResult.rows[0].baseline);
}

// Simulate one continuous combination
async function simulateContinuous(client, symbol, method, session, buyPct, sellPct, startDate, endDate) {
  // Get session filter
  let sessionFilter;
  let baselineSession;
  
  if (session === 'RTH') {
    sessionFilter = "AND s.et_time >= '09:30:00' AND s.et_time < '16:00:00'";
    baselineSession = 'RTH';
  } else if (session === 'AH') {
    sessionFilter = "AND ((s.et_time >= '04:00:00' AND s.et_time < '09:30:00') OR (s.et_time >= '16:00:00' AND s.et_time < '20:00:00'))";
    baselineSession = 'AH';
  } else {
    sessionFilter = "AND s.et_time >= '04:00:00' AND s.et_time < '20:00:00'";
    baselineSession = 'ALL';
  }

  // Get ALL minutes for the entire date range
  const minutesResult = await client.query(`
    SELECT 
      s.et_date,
      s.et_time,
      s.close as stock_price,
      b.close as btc_price
    FROM minute_stock s
    JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
    WHERE s.et_date BETWEEN $1 AND $2
      AND s.symbol = $3
      ${sessionFilter}
    ORDER BY s.et_date, s.et_time
  `, [startDate, endDate, symbol]);

  if (minutesResult.rows.length === 0) {
    return [];
  }

  // Get all trading days and their baselines
  const daysResult = await client.query(`
    SELECT cal_date
    FROM trading_calendar
    WHERE cal_date BETWEEN $1 AND $2
      AND is_open = true
    ORDER BY cal_date
  `, [startDate, endDate]);

  const baselinesByDay = new Map();
  for (const dayRow of daysResult.rows) {
    const baseline = await getBaseline(client, symbol, method, baselineSession, dayRow.cal_date);
    if (baseline) {
      baselinesByDay.set(dayRow.cal_date.toISOString().split('T')[0], baseline);
    }
  }

  // Continuous simulation
  const trades = [];
  let cash = 10000;
  let shares = 0;
  let position = null;
  let cumulativeReturn = 0;

  for (const bar of minutesResult.rows) {
    const dateStr = bar.et_date.toISOString().split('T')[0];
    const baseline = baselinesByDay.get(dateStr);
    
    if (!baseline || !isFinite(baseline)) continue;

    const stockPrice = parseFloat(bar.stock_price);
    const btcPrice = parseFloat(bar.btc_price);
    const currentRatio = btcPrice / stockPrice;
    
    const buyStrike = baseline * (1 + buyPct / 100);
    const sellStrike = baseline * (1 - sellPct / 100);

    if (!position) {
      // Look for entry
      if (currentRatio > buyStrike && cash >= stockPrice) {
        const sharesToBuy = Math.floor(cash / stockPrice);
        if (sharesToBuy > 0) {
          const cost = sharesToBuy * stockPrice;
          
          position = {
            entryDate: bar.et_date,
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
      }
    } else {
      // Look for exit
      if (currentRatio < sellStrike && shares > 0) {
        const proceeds = shares * stockPrice;
        const returnDollars = proceeds - (position.shares * position.entryPrice);
        const returnPct = (returnDollars / (position.shares * position.entryPrice)) * 100;
        const stockDelta = ((stockPrice - position.entryPrice) / position.entryPrice) * 100;
        const btcDelta = ((btcPrice - position.entryBtcPrice) / position.entryBtcPrice) * 100;

        cash += proceeds;
        cumulativeReturn += returnDollars;
        
        trades.push({
          entryDate: position.entryDate,
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          entryBaseline: position.entryBaseline,
          entryRatio: position.entryRatio,
          entryBtcPrice: position.entryBtcPrice,
          exitDate: bar.et_date,
          exitTime: bar.et_time,
          exitPrice: stockPrice,
          exitBaseline: baseline,
          exitRatio: currentRatio,
          exitBtcPrice: btcPrice,
          shares: position.shares,
          returnPct: returnPct,
          returnDollars: returnDollars,
          stockDelta: stockDelta,
          btcDelta: btcDelta,
          cashAfter: cash,
          sharesAfter: 0,
          cumulativeReturn: cumulativeReturn
        });

        shares = 0;
        position = null;
      }
    }
  }

  return trades;
}

// Process one combination
async function processCombo(symbol, method, session, buyPct, sellPct, startDate, endDate) {
  const client = await pool.connect();
  
  try {
    const trades = await simulateContinuous(client, symbol, method, session, buyPct, sellPct, startDate, endDate);
    
    const tableName = session === 'RTH' ? 'precomputed_trades_grid_rth' 
                    : session === 'AH' ? 'precomputed_trades_grid_ah'
                    : 'precomputed_trades_grid_all';
    
    if (trades.length > 0) {
      for (const trade of trades) {
        await client.query(`
          INSERT INTO ${tableName} (
            symbol, method, buy_pct, sell_pct,
            entry_date, entry_time, entry_price, entry_baseline, entry_ratio, entry_btc_price,
            exit_date, exit_time, exit_price, exit_baseline, exit_ratio, exit_btc_price,
            shares, trade_return_pct, trade_return_dollars, stock_delta_pct, btc_delta_pct,
            cash_after_trade, shares_after_trade, cumulative_return
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        `, [
          symbol, method, buyPct, sellPct,
          trade.entryDate, trade.entryTime, trade.entryPrice, trade.entryBaseline, trade.entryRatio, trade.entryBtcPrice,
          trade.exitDate, trade.exitTime, trade.exitPrice, trade.exitBaseline, trade.exitRatio, trade.exitBtcPrice,
          trade.shares, trade.returnPct, trade.returnDollars, trade.stockDelta, trade.btcDelta,
          trade.cashAfter, trade.sharesAfter, trade.cumulativeReturn
        ]);
      }
    }

    return trades.length;
  } finally {
    client.release();
  }
}

// Main processing
async function processGrid(startDate, endDate) {
  console.log(`\n🚀 Starting Continuous Grid Processing`);
  console.log(`Date Range: ${startDate} to ${endDate}`);
  console.log(`Sessions: RTH, AH, ALL (3 separate continuous simulations)\n`);

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

  console.log(`Total Combinations: ${allCombos.length}`);
  console.log(`(11 symbols × 5 methods × 3 sessions × 900 combos)\n`);

  const progress = loadProgress();
  const completedSet = new Set(progress.completed);
  
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

  for (let i = 0; i < remainingCombos.length; i++) {
    const combo = remainingCombos[i];
    
    console.log(`[${processed + 1}/${allCombos.length}] ${combo.symbol} ${combo.method} ${combo.session} ${combo.buyPct}%/${combo.sellPct}%`);
    
    const trades = await processCombo(combo.symbol, combo.method, combo.session, combo.buyPct, combo.sellPct, startDate, endDate);
    totalTrades += trades;
    processed++;

    const key = `${combo.symbol}_${combo.method}_${combo.session}_${combo.buyPct}_${combo.sellPct}`;
    progress.completed.push(key);
    progress.totalTrades = totalTrades;
    progress.lastUpdate = new Date().toISOString();
    
    if (processed % 10 === 0) {
      saveProgress(progress);
      const percentComplete = ((processed / allCombos.length) * 100).toFixed(1);
      console.log(`  Progress: ${percentComplete}% - ${totalTrades} total trades\n`);
    }
  }

  saveProgress(progress);
  console.log(`\n✅ Grid Processing Complete!`);
  console.log(`Total Combinations: ${allCombos.length}`);
  console.log(`Total Trades: ${totalTrades}`);
  
  fs.unlinkSync(PROGRESS_FILE);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: node grid-processor-continuous.js <start_date> <end_date>');
  console.log('Example: node grid-processor-continuous.js 2025-09-01 2025-09-30');
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