#!/usr/bin/env node

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
  max: 10
});

const SYMBOLS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

// Generate all buy/sell combinations (0.1% to 3.0% in 0.1% increments)
function generateCombinations() {
  const combos = [];
  for (let buy = 0.1; buy <= 3.0; buy += 0.1) {
    for (let sell = 0.1; sell <= 3.0; sell += 0.1) {
      combos.push({
        buy: Math.round(buy * 10) / 10,
        sell: Math.round(sell * 10) / 10
      });
    }
  }
  return combos;
}

// Fetch all data for a symbol/method/session/date in ONE query
async function fetchDayData(client, symbol, method, session, date) {
  const query = `
    SELECT 
      s.et_time,
      s.close as stock_price,
      b.close as btc_price,
      bl.baseline
    FROM minute_stock s
    JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
    JOIN trading_calendar tc ON s.et_date = tc.cal_date
    JOIN baseline_daily bl ON bl.trading_day = tc.prev_open_date 
      AND bl.symbol = s.symbol 
      AND bl.method = $2
      AND bl.session = s.session
    WHERE s.et_date = $1
      AND s.symbol = $3
      AND s.session = $4
      AND tc.is_open = true
    ORDER BY s.et_time
  `;
  
  const result = await client.query(query, [date, method, symbol, session]);
  return result.rows;
}

// Simulate ONE combination on pre-fetched data
function simulateCombo(minuteData, baseline, buyPct, sellPct) {
  let cash = 10000;
  let shares = 0;
  let trades = 0;
  let totalReturn = 0;
  
  const buyThreshold = baseline * (1 + buyPct / 100);
  const sellThreshold = baseline * (1 - sellPct / 100);
  
  for (const bar of minuteData) {
    const stockPrice = parseFloat(bar.stock_price);
    const btcPrice = parseFloat(bar.btc_price);
    const ratio = btcPrice / stockPrice;
    
    // Buy signal
    if (shares === 0 && ratio >= buyThreshold) {
      shares = Math.floor(cash / stockPrice);
      if (shares > 0) {
        cash -= shares * stockPrice;
        trades++;
      }
    }
    // Sell signal
    else if (shares > 0 && ratio <= sellThreshold) {
      cash += shares * stockPrice;
      totalReturn = ((cash - 10000) / 10000) * 100;
      shares = 0;
      trades++;
    }
  }
  
  // Close any open position
  if (shares > 0 && minuteData.length > 0) {
    const lastPrice = parseFloat(minuteData[minuteData.length - 1].stock_price);
    cash += shares * lastPrice;
    shares = 0;
  }
  
  const finalReturn = ((cash - 10000) / 10000) * 100;
  
  return {
    trades,
    totalReturn: finalReturn,
    finalEquity: cash
  };
}

// Process one symbol-method-session-date combination
async function processDay(client, symbol, method, session, date) {
  console.log(`  📊 Processing ${symbol} ${method} ${session} ${date}`);
  
  // Fetch data ONCE
  const minuteData = await fetchDayData(client, symbol, method, session, date);
  
  if (minuteData.length === 0) {
    console.log(`    ⚠️  No data found`);
    return [];
  }
  
  const baseline = parseFloat(minuteData[0].baseline);
  const combos = generateCombinations();
  const results = [];
  
  // Simulate ALL 900 combinations on the same data
  for (const combo of combos) {
    const result = simulateCombo(minuteData, baseline, combo.buy, combo.sell);
    
    results.push({
      symbol,
      method,
      session,
      buy_pct: combo.buy,
      sell_pct: combo.sell,
      start_date: date,
      end_date: date,
      total_trades: result.trades,
      total_return_pct: result.totalReturn,
      total_return_dollars: result.finalEquity - 10000,
      final_equity: result.finalEquity
    });
  }
  
  console.log(`    ✅ Simulated ${combos.length} combinations`);
  return results;
}

// Batch insert results
async function insertResults(client, results) {
  if (results.length === 0) return;
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const r of results) {
    const winningTrades = r.total_return_pct > 0 ? 1 : 0;
    const losingTrades = r.total_return_pct <= 0 ? 1 : 0;
    const winRate = r.total_trades > 0 ? (winningTrades / r.total_trades) * 100 : 0;
    
    values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12})`);
    params.push(
      r.symbol, r.method, r.session, r.buy_pct, r.sell_pct,
      r.start_date, r.end_date, r.total_trades,
      winningTrades, losingTrades, winRate,
      r.total_return_pct, r.total_return_dollars
    );
    paramIndex += 13;
  }
  
  const query = `
    INSERT INTO precomputed_grid_summary (
      symbol, method, session, buy_pct, sell_pct,
      start_date, end_date, total_trades,
      winning_trades, losing_trades, win_rate,
      total_return_pct, total_return_dollars
    ) VALUES ${values.join(', ')}
    ON CONFLICT (symbol, method, session, buy_pct, sell_pct, start_date)
    DO UPDATE SET
      total_trades = EXCLUDED.total_trades,
      winning_trades = EXCLUDED.winning_trades,
      losing_trades = EXCLUDED.losing_trades,
      win_rate = EXCLUDED.win_rate,
      total_return_pct = EXCLUDED.total_return_pct,
      total_return_dollars = EXCLUDED.total_return_dollars,
      calculated_at = CURRENT_TIMESTAMP
  `;
  
  await client.query(query, params);
}

// Main processing function
async function processDateRange(startDate, endDate) {
  console.log(`\n🚀 Fast Grid Processor Starting - Connecting to database...`);
  
  const client = await pool.connect();
  console.log(`✅ Database connected!`);
  
  try {
    console.log(`\n📊 Fast Grid Processor Starting`);
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`📊 Symbols: ${SYMBOLS.length}`);
    console.log(`🎯 Methods: ${METHODS.length}`);
    console.log(`⏰ Sessions: ${SESSIONS.length}`);
    console.log(`🔢 Combinations per day: 900\n`);
    
    // Get all trading days in range
    const daysResult = await client.query(`
      SELECT cal_date
      FROM trading_calendar
      WHERE cal_date >= $1 AND cal_date <= $2
        AND is_open = true
      ORDER BY cal_date
    `, [startDate, endDate]);
    
    const tradingDays = daysResult.rows.map(r => r.cal_date);
    console.log(`📆 Trading days to process: ${tradingDays.length}\n`);
    
    let totalProcessed = 0;
    const startTime = Date.now();
    
    for (const date of tradingDays) {
      console.log(`\n📅 Processing ${date}`);
      
      for (const symbol of SYMBOLS) {
        for (const method of METHODS) {
          for (const session of SESSIONS) {
            const results = await processDay(client, symbol, method, session, date);
            
            if (results.length > 0) {
              await insertResults(client, results);
              totalProcessed += results.length;
            }
          }
        }
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (totalProcessed / (Date.now() - startTime) * 1000).toFixed(0);
      console.log(`  ⏱️  Elapsed: ${elapsed}s | Processed: ${totalProcessed} | Rate: ${rate}/sec`);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Complete! Processed ${totalProcessed} combinations in ${totalTime} seconds`);
    console.log(`📊 Average: ${(totalProcessed / totalTime).toFixed(0)} combinations/second\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly (works on both Unix and Windows)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule || import.meta.url.includes('fast-grid-processor.js')) {
  console.log('🎬 Script started!');
  const startDate = process.argv[2] || '2025-09-24';
  const endDate = process.argv[3] || '2025-09-24';
  
  console.log(`📅 Processing dates: ${startDate} to ${endDate}`);
  
  processDateRange(startDate, endDate)
    .then(() => {
      console.log('✅ Script completed successfully!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Script failed with error:');
      console.error(err);
      process.exit(1);
    });
}

export { processDateRange };