import pg from 'pg';

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: false,
  connectionTimeoutMillis: 30000,
});

// Configuration
const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const BUY_THRESHOLDS = Array.from({ length: 30 }, (_, i) => (i + 1) * 0.1); // 0.1 to 3.0
const SELL_THRESHOLDS = Array.from({ length: 30 }, (_, i) => (i + 1) * 0.1); // 0.1 to 3.0
const ALLOW_SHORTS = false;
const CONSERVATIVE_PRICING = true;
const SLIPPAGE = 0.0;

// Session definitions
const SESSIONS = {
  RTH: {
    name: 'RTH',
    startTime: '09:30:00',
    endTime: '16:00:00',
    forceExitAtEnd: true,
    tradesTable: 'precomputed_trades_rth',
    stateTable: 'simulation_state_rth'
  },
  ALL: {
    name: 'ALL',
    startTime: '04:00:00',
    endTime: '20:00:00',
    forceExitAtEnd: true,
    tradesTable: 'precomputed_trades_all',
    stateTable: 'simulation_state_all'
  }
};

function roundPrice(price, roundUp) {
  if (roundUp) {
    return Math.ceil(price * 100) / 100;
  } else {
    return Math.floor(price * 100) / 100;
  }
}

function applySlippage(price, isBuy, slippage) {
  if (slippage === 0) return price;
  
  if (isBuy) {
    return price * (1 + slippage);
  } else {
    return price * (1 - slippage);
  }
}

function getSessionForTime(time) {
  const timeStr = time.toString();
  const hour = parseInt(timeStr.split(':')[0]);
  const minute = parseInt(timeStr.split(':')[1]);
  const totalMinutes = hour * 60 + minute;
  
  // RTH: 9:30 AM - 4:00 PM (570 - 960 minutes)
  if (totalMinutes >= 570 && totalMinutes < 960) {
    return 'RTH';
  }
  // AH: Everything else within 4:00 AM - 8:00 PM
  return 'AH';
}

async function processDayForSession(client, date, sessionConfig, stockData, btcData, baselineData) {
  const { name: sessionName, startTime, endTime, forceExitAtEnd, tradesTable, stateTable } = sessionConfig;
  
  console.log(`\n  📊 Processing ${sessionName} session for ${date}...`);
  
  // Load all states for this session
  const statesResult = await client.query(`
    SELECT * FROM ${stateTable}
  `);
  
  const states = new Map();
  for (const row of statesResult.rows) {
    const key = `${row.symbol}_${row.method}_${row.buy_threshold}_${row.sell_threshold}`;
    states.set(key, {
      hasPosition: row.has_position,
      positionType: row.position_type,
      entryDate: row.entry_date,
      entryTime: row.entry_time,
      entryPrice: parseFloat(row.entry_price),
      entryBaseline: parseFloat(row.entry_baseline),
      entryBtcPrice: parseFloat(row.entry_btc_price),
      shares: row.shares
    });
  }
  
  // Filter bars for this session's time range
  const sessionBars = stockData.filter(bar => {
    return bar.et_time >= startTime && bar.et_time < endTime;
  });
  
  if (sessionBars.length === 0) {
    console.log(`    ⚠️  No bars in ${sessionName} session`);
    return { tradesCreated: 0, statesUpdated: 0 };
  }
  
  console.log(`    📈 Processing ${sessionBars.length} bars`);
  
  let tradesCreated = 0;
  const statesToUpdate = [];
  const tradesToInsert = [];
  
  // Process each combination
  for (const symbol of STOCKS) {
    const symbolBars = sessionBars.filter(b => b.symbol === symbol);
    if (symbolBars.length === 0) continue;
    
    for (const method of METHODS) {
      for (const buyThreshold of BUY_THRESHOLDS) {
        for (const sellThreshold of SELL_THRESHOLDS) {
          const key = `${symbol}_${method}_${buyThreshold}_${sellThreshold}`;
          let state = states.get(key) || {
            hasPosition: false,
            positionType: null,
            entryDate: null,
            entryTime: null,
            entryPrice: null,
            entryBaseline: null,
            entryBtcPrice: null,
            shares: null
          };
          
          // Process each bar
          for (const bar of symbolBars) {
            const barTime = bar.et_time;
            const barSession = getSessionForTime(barTime);
            
            // Get baseline for this bar's session
            const baselineKey = `${symbol}_${method}_${barSession}`;
            const baseline = baselineData.get(baselineKey);
            
            if (!baseline) continue;
            
            const btcBar = btcData.find(b => b.et_time === barTime);
            if (!btcBar) continue;
            
            const btcPrice = parseFloat(btcBar.close);
            const stockPrice = parseFloat(bar.close);
            const ratio = stockPrice / baseline;
            
            // Calculate thresholds
            const buyThr = baseline * (1 + buyThreshold / 100);
            const sellThr = baseline * (1 - sellThreshold / 100);
            
            // Check for signals
            if (!state.hasPosition) {
              // Look for BUY signal (LONG only for now)
              if (stockPrice >= buyThr) {
                let entryPrice = applySlippage(stockPrice, true, SLIPPAGE);
                if (CONSERVATIVE_PRICING) {
                  entryPrice = roundPrice(entryPrice, true);
                }
                
                state = {
                  hasPosition: true,
                  positionType: 'LONG',
                  entryDate: date,
                  entryTime: barTime,
                  entryPrice: entryPrice,
                  entryBaseline: baseline,
                  entryBtcPrice: btcPrice,
                  shares: Math.floor(10000 / entryPrice)
                };
              }
            } else {
              // Look for SELL signal
              let shouldExit = false;
              
              if (state.positionType === 'LONG') {
                shouldExit = stockPrice <= sellThr;
              }
              
              // Force exit at end of session
              if (forceExitAtEnd && barTime >= endTime) {
                shouldExit = true;
              }
              
              if (shouldExit) {
                let exitPrice = applySlippage(stockPrice, false, SLIPPAGE);
                if (CONSERVATIVE_PRICING) {
                  exitPrice = roundPrice(exitPrice, false);
                }
                
                const tradeReturn = ((exitPrice - state.entryPrice) / state.entryPrice) * 100;
                const stockDelta = ((exitPrice - state.entryPrice) / state.entryPrice) * 100;
                const btcDelta = ((btcPrice - state.entryBtcPrice) / state.entryBtcPrice) * 100;
                
                tradesToInsert.push({
                  symbol,
                  method,
                  buyThreshold,
                  sellThreshold,
                  allowShorts: ALLOW_SHORTS,
                  conservativePricing: CONSERVATIVE_PRICING,
                  slippage: SLIPPAGE,
                  entryDate: state.entryDate,
                  entryTime: state.entryTime,
                  entryPrice: state.entryPrice,
                  entryBaseline: state.entryBaseline,
                  entryBtcPrice: state.entryBtcPrice,
                  exitDate: date,
                  exitTime: barTime,
                  exitPrice: exitPrice,
                  exitBaseline: baseline,
                  exitBtcPrice: btcPrice,
                  positionType: state.positionType,
                  shares: state.shares,
                  tradeReturn: tradeReturn,
                  stockDelta: stockDelta,
                  btcDelta: btcDelta,
                  sessionType: sessionName
                });
                
                tradesCreated++;
                
                // Reset state
                state = {
                  hasPosition: false,
                  positionType: null,
                  entryDate: null,
                  entryTime: null,
                  entryPrice: null,
                  entryBaseline: null,
                  entryBtcPrice: null,
                  shares: null
                };
              }
            }
          }
          
          // Save state
          statesToUpdate.push({
            key,
            symbol,
            method,
            buyThreshold,
            sellThreshold,
            state,
            sessionType: sessionName
          });
        }
      }
    }
  }
  
  // Batch insert trades
  if (tradesToInsert.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < tradesToInsert.length; i += batchSize) {
      const batch = tradesToInsert.slice(i, i + batchSize);
      
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (const trade of batch) {
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, $${paramIndex + 15}, $${paramIndex + 16}, $${paramIndex + 17}, $${paramIndex + 18}, $${paramIndex + 19}, $${paramIndex + 20}, $${paramIndex + 21}, $${paramIndex + 22})`
        );
        
        values.push(
          trade.symbol, trade.method, trade.buyThreshold, trade.sellThreshold,
          trade.allowShorts, trade.conservativePricing, trade.slippage,
          trade.entryDate, trade.entryTime, trade.entryPrice, trade.entryBaseline, trade.entryBtcPrice,
          trade.exitDate, trade.exitTime, trade.exitPrice, trade.exitBaseline, trade.exitBtcPrice,
          trade.positionType, trade.shares, trade.tradeReturn, trade.stockDelta, trade.btcDelta,
          trade.sessionType
        );
        
        paramIndex += 23;
      }
      
      const query = `
        INSERT INTO ${tradesTable} (
          symbol, method, buy_threshold, sell_threshold,
          allow_shorts, conservative_pricing, slippage,
          entry_date, entry_time, entry_price, entry_baseline, entry_btc_price,
          exit_date, exit_time, exit_price, exit_baseline, exit_btc_price,
          position_type, shares, trade_return, stock_delta, btc_delta,
          session_type
        ) VALUES ${placeholders.join(', ')}
      `;
      
      await client.query(query, values);
    }
  }
  
  // Batch update states
  if (statesToUpdate.length > 0) {
    for (const item of statesToUpdate) {
      const { symbol, method, buyThreshold, sellThreshold, state, sessionType } = item;
      
      await client.query(`
        INSERT INTO ${stateTable} (
          symbol, method, buy_threshold, sell_threshold,
          allow_shorts, conservative_pricing, slippage,
          has_position, position_type, entry_date, entry_time,
          entry_price, entry_baseline, entry_btc_price, shares,
          last_processed_date, session_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (symbol, method, buy_threshold, sell_threshold, allow_shorts, conservative_pricing, slippage, session_type)
        DO UPDATE SET
          has_position = EXCLUDED.has_position,
          position_type = EXCLUDED.position_type,
          entry_date = EXCLUDED.entry_date,
          entry_time = EXCLUDED.entry_time,
          entry_price = EXCLUDED.entry_price,
          entry_baseline = EXCLUDED.entry_baseline,
          entry_btc_price = EXCLUDED.entry_btc_price,
          shares = EXCLUDED.shares,
          last_processed_date = EXCLUDED.last_processed_date,
          updated_at = CURRENT_TIMESTAMP
      `, [
        symbol, method, buyThreshold, sellThreshold,
        ALLOW_SHORTS, CONSERVATIVE_PRICING, SLIPPAGE,
        state.hasPosition, state.positionType, state.entryDate, state.entryTime,
        state.entryPrice, state.entryBaseline, state.entryBtcPrice, state.shares,
        date, sessionType
      ]);
    }
  }
  
  console.log(`    ✅ ${sessionName}: ${tradesCreated} trades created, ${statesToUpdate.length} states updated`);
  
  return { tradesCreated, statesUpdated: statesToUpdate.length };
}

async function processDateRange(startDate, endDate) {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting dual session processor...\n');
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    console.log(`📊 Stocks: ${STOCKS.join(', ')}`);
    console.log(`🔧 Methods: ${METHODS.join(', ')}`);
    console.log(`💰 Buy thresholds: ${BUY_THRESHOLDS.length} (0.1% to 3.0%)`);
    console.log(`💰 Sell thresholds: ${SELL_THRESHOLDS.length} (0.1% to 3.0%)`);
    console.log(`🔢 Total combinations per session: ${STOCKS.length * METHODS.length * BUY_THRESHOLDS.length * SELL_THRESHOLDS.length}`);
    console.log(`📈 Sessions: RTH, ALL\n`);
    
    // Get trading days
    const datesResult = await client.query(`
      SELECT cal_date
      FROM trading_calendar
      WHERE cal_date >= $1 AND cal_date <= $2
        AND is_open = true
      ORDER BY cal_date
    `, [startDate, endDate]);
    
    const tradingDays = datesResult.rows.map(r => r.cal_date);
    console.log(`📅 Found ${tradingDays.length} trading days\n`);
    
    let totalTradesRTH = 0;
    let totalTradesALL = 0;
    
    for (const date of tradingDays) {
      console.log(`\n📅 Processing ${date}...`);
      
      // Load stock data for this day
      const stockResult = await client.query(`
        SELECT symbol, et_time, close
        FROM minute_stock
        WHERE et_date = $1
        ORDER BY symbol, et_time
      `, [date]);
      
      // Load BTC data for this day
      const btcResult = await client.query(`
        SELECT et_time, close
        FROM minute_btc
        WHERE et_date = $1
        ORDER BY et_time
      `, [date]);
      
      // Load baselines for the PREVIOUS trading day (lagging baseline strategy)
      // For each symbol/method/session, get the most recent baseline before this date
      const baselineResult = await client.query(`
        SELECT DISTINCT ON (symbol, method, session) 
          symbol, method, session, baseline
        FROM baseline_daily
        WHERE trading_day < $1
        ORDER BY symbol, method, session, trading_day DESC
      `, [date]);
      
      const baselineData = new Map();
      for (const row of baselineResult.rows) {
        const key = `${row.symbol}_${row.method}_${row.session}`;
        baselineData.set(key, parseFloat(row.baseline));
      }
      // Process RTH session
      const rthResult = await processDayForSession(
        client, date, SESSIONS.RTH,
        stockResult.rows, btcResult.rows, baselineData
      );
      totalTradesRTH += rthResult.tradesCreated;
      
      // Process ALL session
      const allResult = await processDayForSession(
        client, date, SESSIONS.ALL,
        stockResult.rows, btcResult.rows, baselineData
      );
      totalTradesALL += allResult.tradesCreated;
      
      // Log progress
      await client.query(`
        INSERT INTO processing_log (
          process_date, session_type, start_time, end_time, status,
          combinations_processed, trades_created
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        date, 'RTH', new Date(), new Date(), 'completed',
        STOCKS.length * METHODS.length * BUY_THRESHOLDS.length * SELL_THRESHOLDS.length,
        rthResult.tradesCreated
      ]);
      
      await client.query(`
        INSERT INTO processing_log (
          process_date, session_type, start_time, end_time, status,
          combinations_processed, trades_created
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        date, 'ALL', new Date(), new Date(), 'completed',
        STOCKS.length * METHODS.length * BUY_THRESHOLDS.length * SELL_THRESHOLDS.length,
        allResult.tradesCreated
      ]);
    }
    
    console.log('\n\n✅ Processing complete!');
    console.log(`📊 Total RTH trades: ${totalTradesRTH}`);
    console.log(`📊 Total ALL trades: ${totalTradesALL}`);
    
  } catch (error) {
    console.error('❌ Error processing:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node nightly-processor-dual.js START_DATE END_DATE');
  console.error('Example: node nightly-processor-dual.js 2024-01-01 2024-01-31');
  process.exit(1);
}

const [startDate, endDate] = args;
processDateRange(startDate, endDate);