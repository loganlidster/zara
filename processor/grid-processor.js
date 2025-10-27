// Grid Processor - Calculates all 900 buy/sell combinations
// Stores results in precomputed_trades_grid table

import pkg from 'pg';
const { Pool } = pkg;

// Database configuration
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

// Generate 0.1 to 3.0 in 0.1 increments
for (let i = 1; i <= 30; i++) {
  const pct = (i * 0.1).toFixed(1);
  BUY_PERCENTAGES.push(parseFloat(pct));
  SELL_PERCENTAGES.push(parseFloat(pct));
}

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

console.log(`Grid Configuration:`);
console.log(`  Buy %: ${BUY_PERCENTAGES.length} values (${BUY_PERCENTAGES[0]} to ${BUY_PERCENTAGES[BUY_PERCENTAGES.length-1]})`);
console.log(`  Sell %: ${SELL_PERCENTAGES.length} values (${SELL_PERCENTAGES[0]} to ${SELL_PERCENTAGES[SELL_PERCENTAGES.length-1]})`);
console.log(`  Combinations per symbol/method/session: ${BUY_PERCENTAGES.length * SELL_PERCENTAGES.length}`);
console.log(`  Total combinations: ${SYMBOLS.length * METHODS.length * SESSIONS.length * BUY_PERCENTAGES.length * SELL_PERCENTAGES.length}`);

// Calculate baseline for a given day using previous trading day's data
async function calculateBaseline(client, symbol, method, session, tradingDay) {
  // Get previous trading day
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

  // Get baseline from baseline_daily table
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

// Simulate trades for a single day with given parameters
async function simulateDay(client, symbol, method, session, tradingDay, buyPct, sellPct) {
  // Get baseline for this day
  const baseline = await calculateBaseline(client, symbol, method, session, tradingDay);
  
  if (!baseline || !isFinite(baseline)) {
    return [];
  }

  // Calculate strike prices
  const buyStrike = baseline * (1 + buyPct / 100);
  const sellStrike = baseline * (1 - sellPct / 100);

  // Get minute data for this day
  const sessionFilter = session === 'RTH' 
    ? "AND s.et_time >= '09:30:00' AND s.et_time < '16:00:00'"
    : session === 'AH'
    ? "AND ((s.et_time >= '04:00:00' AND s.et_time < '09:30:00') OR (s.et_time >= '16:00:00' AND s.et_time < '20:00:00'))"
    : "AND s.et_time >= '04:00:00' AND s.et_time < '20:00:00'";

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

  // Simulate trades
  const trades = [];
  let cash = 10000;
  let shares = 0;
  let position = null;

  for (const bar of dataResult.rows) {
    const stockPrice = parseFloat(bar.stock_price);
    const btcPrice = parseFloat(bar.btc_price);
    const currentRatio = btcPrice / stockPrice;

    if (!position) {
      // Look for entry
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
      // Look for exit
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
async function processCombo(client, symbol, method, session, buyPct, sellPct, startDate, endDate) {
  console.log(`  Processing ${symbol} ${method} ${session} ${buyPct}%/${sellPct}%`);

  // Get all trading days in range
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

  // Insert trades into database
  if (allTrades.length > 0) {
    for (const trade of allTrades) {
      await client.query(`
        INSERT INTO precomputed_trades_grid (
          symbol, method, session, buy_pct, sell_pct,
          entry_date, entry_time, entry_price, entry_baseline, entry_ratio, entry_btc_price,
          exit_date, exit_time, exit_price, exit_baseline, exit_ratio, exit_btc_price,
          shares, trade_return_pct, trade_return_dollars, stock_delta_pct, btc_delta_pct
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (symbol, method, session, buy_pct, sell_pct, entry_date, entry_time) DO NOTHING
      `, [
        symbol, method, session, buyPct, sellPct,
        trade.entryDate, trade.entryTime, trade.entryPrice, trade.entryBaseline, trade.entryRatio, trade.entryBtcPrice,
        trade.exitDate, trade.exitTime, trade.exitPrice, trade.exitBaseline, trade.exitRatio, trade.exitBtcPrice,
        trade.shares, trade.returnPct, trade.returnDollars, trade.stockDelta, trade.btcDelta
      ]);
    }
  }

  return allTrades.length;
}

// Main processing function
async function processGrid(startDate, endDate) {
  const client = await pool.connect();
  
  try {
    console.log(`\n🚀 Starting Grid Processing`);
    console.log(`Date Range: ${startDate} to ${endDate}`);
    console.log(`Symbols: ${SYMBOLS.join(', ')}`);
    console.log(`Methods: ${METHODS.join(', ')}`);
    console.log(`Sessions: ${SESSIONS.join(', ')}`);
    console.log(`\nProcessing ${SYMBOLS.length * METHODS.length * SESSIONS.length * BUY_PERCENTAGES.length * SELL_PERCENTAGES.length} combinations...\n`);

    let totalTrades = 0;
    let combosProcessed = 0;

    for (const symbol of SYMBOLS) {
      console.log(`\n📊 Processing ${symbol}...`);
      
      for (const method of METHODS) {
        for (const session of SESSIONS) {
          console.log(`  ${method} ${session}:`);
          
          for (const buyPct of BUY_PERCENTAGES) {
            for (const sellPct of SELL_PERCENTAGES) {
              const trades = await processCombo(client, symbol, method, session, buyPct, sellPct, startDate, endDate);
              totalTrades += trades;
              combosProcessed++;
              
              if (combosProcessed % 100 === 0) {
                console.log(`    Progress: ${combosProcessed} combos, ${totalTrades} trades`);
              }
            }
          }
        }
      }
    }

    console.log(`\n✅ Grid Processing Complete!`);
    console.log(`Total Combinations: ${combosProcessed}`);
    console.log(`Total Trades: ${totalTrades}`);

  } catch (error) {
    console.error('Error processing grid:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the processor
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: node grid-processor.js <start_date> <end_date>');
  console.log('Example: node grid-processor.js 2025-09-01 2025-09-30');
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