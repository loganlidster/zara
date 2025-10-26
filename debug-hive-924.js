// DIAGNOSTIC SCRIPT - HIVE 9/24/2025 Trade Analysis
// Compare with old system results

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '34.41.97.179',
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  port: 5432,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  statement_timeout: 120000,
});

async function debugHive924() {
  console.log('\n🔍 DIAGNOSTIC: HIVE 9/24/2025 - EQUAL_MEAN, 0.5% buy, 1.0% sell\n');
  
  try {
    // 1. Get the baseline for 9/24
    const baselineQuery = `
      SELECT trading_day, method, session, baseline
      FROM baseline_daily
      WHERE symbol = 'HIVE'
        AND trading_day = '2025-09-24'
        AND method = 'EQUAL_MEAN'
      ORDER BY session;
    `;
    
    const baselineResult = await pool.query(baselineQuery);
    console.log('📊 BASELINES FOR 9/24:');
    baselineResult.rows.forEach(row => {
      console.log(`  ${row.session}: ${row.baseline}`);
    });
    
    // 2. Get ALL minute bars for HIVE on 9/24
    const barsQuery = `
      SELECT et_date, et_time, open, high, low, close, volume
      FROM minute_stock
      WHERE symbol = 'HIVE'
        AND et_date = '2025-09-24'
      ORDER BY et_time;
    `;
    
    const barsResult = await pool.query(barsQuery);
    console.log(`\n📈 TOTAL BARS FOR 9/24: ${barsResult.rows.length}`);
    
    // 3. Get BTC data for same day
    const btcQuery = `
      SELECT et_date, et_time, close as btc_close
      FROM minute_btc
      WHERE et_date = '2025-09-24'
      ORDER BY et_time;
    `;
    
    const btcResult = await pool.query(btcQuery);
    console.log(`📈 TOTAL BTC BARS FOR 9/24: ${btcResult.rows.length}`);
    
    // 4. Create lookup map for BTC prices
    const btcMap = {};
    btcResult.rows.forEach(row => {
      btcMap[row.et_time] = parseFloat(row.btc_close);
    });
    
    // 5. Simulate trades step-by-step
    const buyThreshold = 0.5; // 0.5%
    const sellThreshold = 1.0; // 1.0%
    
    let position = null;
    let trades = [];
    let equity = 10000;
    let shares = 0;
    
    console.log('\n🎯 TRADE SIGNALS:\n');
    
    for (const bar of barsResult.rows) {
      const stockPrice = parseFloat(bar.close);
      const btcPrice = btcMap[bar.et_time];
      
      if (!btcPrice) continue; // Skip if no BTC data
      
      // Determine session
      const time = bar.et_time;
      const hour = parseInt(time.split(':')[0]);
      const minute = parseInt(time.split(':')[1]);
      const totalMinutes = hour * 60 + minute;
      
      const isRTH = totalMinutes >= 570 && totalMinutes < 960; // 9:30 AM - 4:00 PM
      const session = isRTH ? 'RTH' : 'AH';
      
      // Get baseline for this session
      const baselineRow = baselineResult.rows.find(r => r.session === session);
      if (!baselineRow) continue;
      
      const baseline = parseFloat(baselineRow.baseline);
      const ratio = btcPrice / stockPrice;
      const deviation = ((ratio - baseline) / baseline) * 100;
      
      // Check for signals
      if (!position) {
        // Looking for BUY signal
        const buyThresholdValue = baseline * (1 + buyThreshold / 100);
        if (ratio >= buyThresholdValue) {
          // BUY SIGNAL
          shares = Math.floor(equity / stockPrice);
          const cost = shares * stockPrice;
          equity -= cost;
          
          position = {
            entryTime: bar.et_time,
            entryPrice: stockPrice,
            entryBTC: btcPrice,
            shares: shares,
            session: session,
            baseline: baseline
          };
          
          console.log(`✅ BUY at ${bar.et_time}`);
          console.log(`   Stock: $${stockPrice.toFixed(2)}, BTC: $${btcPrice.toFixed(2)}`);
          console.log(`   Ratio: ${ratio.toFixed(2)}, Baseline: ${baseline.toFixed(2)}`);
          console.log(`   Deviation: ${deviation.toFixed(2)}%`);
          console.log(`   Shares: ${shares}, Cost: $${cost.toFixed(2)}`);
          console.log(`   Remaining Cash: $${equity.toFixed(2)}\n`);
        }
      } else {
        // Looking for SELL signal
        const sellThresholdValue = baseline * (1 - sellThreshold / 100);
        if (ratio <= sellThresholdValue) {
          // SELL SIGNAL
          const proceeds = shares * stockPrice;
          equity += proceeds;
          
          const returnPct = ((stockPrice - position.entryPrice) / position.entryPrice) * 100;
          
          console.log(`💰 SELL at ${bar.et_time}`);
          console.log(`   Stock: $${stockPrice.toFixed(2)}, BTC: $${btcPrice.toFixed(2)}`);
          console.log(`   Ratio: ${ratio.toFixed(2)}, Baseline: ${baseline.toFixed(2)}`);
          console.log(`   Deviation: ${deviation.toFixed(2)}%`);
          console.log(`   Shares: ${shares}, Proceeds: $${proceeds.toFixed(2)}`);
          console.log(`   Return: ${returnPct.toFixed(2)}%`);
          console.log(`   Total Equity: $${equity.toFixed(2)}\n`);
          
          trades.push({
            entry: position.entryTime,
            exit: bar.et_time,
            entryPrice: position.entryPrice,
            exitPrice: stockPrice,
            shares: shares,
            returnPct: returnPct
          });
          
          position = null;
          shares = 0;
        }
      }
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`Total Trades: ${trades.length}`);
    console.log(`Final Equity: $${equity.toFixed(2)}`);
    console.log(`Total Return: ${((equity - 10000) / 10000 * 100).toFixed(2)}%`);
    
    console.log('\n📋 TRADE LOG:');
    trades.forEach((trade, i) => {
      console.log(`${i + 1}. ${trade.entry} → ${trade.exit}: ${trade.returnPct.toFixed(2)}%`);
    });
    
    // 6. Now check 9/25 if position carried over
    if (position) {
      console.log('\n⚠️ POSITION CARRIED TO 9/25');
      console.log(`   Entry: ${position.entryTime} at $${position.entryPrice.toFixed(2)}`);
      console.log(`   Shares: ${position.shares}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugHive924();