import pg from 'pg';

const { Pool } = pg;

// Use Unix socket for Cloud Run, IP for local development
const isCloudRun = process.env.K_SERVICE !== undefined;
const pool = new Pool({
  host: isCloudRun 
    ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME || 'tradiac-testing:us-central1:tradiac-testing-db'}`
    : (process.env.DB_HOST || '34.41.97.179'),
  port: isCloudRun ? undefined : (process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: isCloudRun ? false : { rejectUnauthorized: false },
  max: 50,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  statement_timeout: 120000,
  query_timeout: 120000,
});

// Session time ranges
const SESSION_TIMES = {
  RTH: { start: '09:30:00', end: '16:00:00' },
  AH: [
    { start: '04:00:00', end: '09:30:00' },
    { start: '16:00:00', end: '20:00:00' }
  ],
  ALL: { start: '04:00:00', end: '20:00:00' }
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

function getSessionForTime(time, sessionType) {
  if (sessionType === 'RTH') {
    return 'RTH';
  } else if (sessionType === 'AH') {
    return 'AH';
  } else if (sessionType === 'ALL') {
    const timeStr = time.toString();
    const hour = parseInt(timeStr.split(':')[0]);
    const minute = parseInt(timeStr.split(':')[1]);
    const totalMinutes = hour * 60 + minute;
    
    // RTH: 9:30 AM - 4:00 PM (570 - 960 minutes)
    if (totalMinutes >= 570 && totalMinutes < 960) {
      return 'RTH';
    }
    return 'AH';
  }
  return 'RTH'; // Default
}

async function simulateSingleCombination(client, date, symbol, method, buyThreshold, sellThreshold, sessionType, conservativePricing, slippage, allowShorts) {
  // Get session time filter
  let timeFilter = '';
  if (sessionType === 'RTH') {
    timeFilter = `AND s.et_time >= '09:30:00' AND s.et_time < '16:00:00'`;
  } else if (sessionType === 'AH') {
    timeFilter = `AND ((s.et_time >= '04:00:00' AND s.et_time < '09:30:00') OR (s.et_time >= '16:00:00' AND s.et_time < '20:00:00'))`;
  } else if (sessionType === 'ALL') {
    timeFilter = `AND s.et_time >= '04:00:00' AND s.et_time < '20:00:00'`;
  } else if (sessionType === 'CUSTOM') {
    // Custom time range (passed in request)
    timeFilter = `AND s.et_time >= $7 AND s.et_time < $8`;
  }
  
  // Load stock and BTC data for this day
  const dataResult = await client.query(`
    SELECT 
      s.et_time,
      s.close as stock_price,
      b.close as btc_price
    FROM minute_stock s
    JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
    WHERE s.et_date = $1
      AND s.symbol = $2
      ${timeFilter}
    ORDER BY s.et_time
  `, [date, symbol]);
  
  if (dataResult.rows.length === 0) {
    console.log(`  ❌ No minute data found for ${symbol} on ${date}`);
       return null;
  }
  
     console.log(`  ✅ Found ${dataResult.rows.length} minute bars for ${symbol} on ${date}`);
     
     // Get baselines for the PREVIOUS trading day (lagging baseline strategy)
     // Use trading_calendar to get the correct previous trading day
     const baselineResult = await client.query(`
       SELECT b.session, b.baseline
       FROM trading_calendar tc
       JOIN baseline_daily b ON b.trading_day = tc.prev_open_date
       WHERE tc.cal_date = $1
         AND b.symbol = $2
         AND b.method = $3
     `, [date, symbol, method]);
  const baselines = {};
  for (const row of baselineResult.rows) {
    baselines[row.session] = parseFloat(row.baseline);
  }
  
     console.log(`  Baselines for ${symbol} ${method} on ${date}:`, baselines);
     
  if (Object.keys(baselines).length === 0) {
       console.log(`  ❌ No baselines found for ${symbol} ${method} on ${date}`);
  }
  
  // Simulate trades
  let position = null;
  const trades = [];
     const decisionLog = []; // Track every minute's decision
  
  for (const bar of dataResult.rows) {
    const barTime = bar.et_time;
    const barSession = getSessionForTime(barTime, sessionType);
    const baseline = baselines[barSession];
    
    if (!baseline) continue;
    
    const stockPrice = parseFloat(bar.stock_price);
    const btcPrice = parseFloat(bar.btc_price);
       const ratio = stockPrice / btcPrice;
    
    const buyThr = baseline * (1 + buyThreshold / 100);
    const sellThr = baseline * (1 - sellThreshold / 100);
       
       let decision = 'HOLD';
       let positionStatus = position ? position.type : 'FLAT';
    
    if (!position) {
      // Look for entry
      if (stockPrice >= buyThr) {
        let entryPrice = applySlippage(stockPrice, true, slippage);
        if (conservativePricing) {
          entryPrice = roundPrice(entryPrice, true);
        }
        
        position = {
          type: 'LONG',
          entryTime: barTime,
          entryPrice: entryPrice,
          entryBaseline: baseline,
          entryBtcPrice: btcPrice,
          shares: Math.floor(10000 / entryPrice)
        };
           decision = 'BUY';
      }
    } else {
      // Look for exit
      let shouldExit = false;
      
      if (position.type === 'LONG') {
        shouldExit = stockPrice <= sellThr;
      }
      
      if (shouldExit) {
        let exitPrice = applySlippage(stockPrice, false, slippage);
        if (conservativePricing) {
          exitPrice = roundPrice(exitPrice, false);
        }
        
        const tradeReturn = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
        const stockDelta = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
        const btcDelta = ((btcPrice - position.entryBtcPrice) / position.entryBtcPrice) * 100;
        
        trades.push({
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          exitTime: barTime,
          exitPrice: exitPrice,
          return: tradeReturn,
          stockDelta: stockDelta,
          btcDelta: btcDelta
        });
        
        position = null;
      }
    }
       
       // Log this minute's decision
       decisionLog.push({
         time: barTime,
         session: barSession,
         btc_price: btcPrice,
         stock_price: stockPrice,
         ratio: ratio,
         baseline: baseline,
         buy_threshold: buyThr,
         sell_threshold: sellThr,
         decision: decision,
         position: positionStatus
       });
  }
  
  // Calculate summary
  if (trades.length === 0) {
    return null;
  }
  
  const totalReturn = trades.reduce((sum, t) => sum + t.return, 0);
  const avgReturn = totalReturn / trades.length;
  const winningTrades = trades.filter(t => t.return > 0).length;
  const winRate = (winningTrades / trades.length) * 100;
  
  return {
    symbol,
    method,
    buyThreshold,
    sellThreshold,
    totalReturn,
    avgReturn,
    tradeCount: trades.length,
    winRate,
    trades,
       decisionLog  // Include minute-by-minute decisions
  };
}

export async function handleFastDaily(req, res) {
  console.log('🚀 Fast Daily endpoint called!');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const client = await pool.connect();
  
  try {
    const {
      date,
      symbols,
      methods,
      buyThresholdMin,
      buyThresholdMax,
      sellThresholdMin,
      sellThresholdMax,
      sessionType,
      conservativePricing = true,
      slippage = 0.0,
      allowShorts = false
    } = req.body;
    
    console.log('Fast Daily request:', {
      date,
      symbols: symbols?.length,
      methods: methods?.length,
      buyRange: `${buyThresholdMin}-${buyThresholdMax}`,
      sellRange: `${sellThresholdMin}-${sellThresholdMax}`,
      sessionType
    });
    
    console.log('Symbols:', symbols);
    console.log('Methods:', methods);
    
    // Generate threshold arrays
    const buyThresholds = [];
    for (let i = buyThresholdMin; i <= buyThresholdMax; i += 0.1) {
      buyThresholds.push(parseFloat(i.toFixed(1)));
    }
    
    const sellThresholds = [];
    for (let i = sellThresholdMin; i <= sellThresholdMax; i += 0.1) {
      sellThresholds.push(parseFloat(i.toFixed(1)));
    }
    
    console.log(`Testing ${symbols.length} symbols × ${methods.length} methods × ${buyThresholds.length} buy × ${sellThresholds.length} sell = ${symbols.length * methods.length * buyThresholds.length * sellThresholds.length} combinations`);
    
    const results = [];
    let processed = 0;
    const total = symbols.length * methods.length * buyThresholds.length * sellThresholds.length;
    
    for (const symbol of symbols) {
      for (const method of methods) {
        for (const buyThreshold of buyThresholds) {
          for (const sellThreshold of sellThresholds) {
            const result = await simulateSingleCombination(
              client, date, symbol, method, buyThreshold, sellThreshold,
              sessionType, conservativePricing, slippage, allowShorts
            );
            
            if (result) {
              results.push(result);
              console.log(`  Found result: ${symbol} ${method} ${buyThreshold}/${sellThreshold} = ${result.totalReturn.toFixed(2)}%`);
            } else {
              if (processed === 1) {
                console.log(`  No result for first combo: ${symbol} ${method} ${buyThreshold}/${sellThreshold}`);
              }
            }
            
            processed++;
            if (processed % 100 === 0) {
              console.log(`  Processed ${processed}/${total} combinations`);
            }
          }
        }
      }
    }
    
    // Find best per stock
    const bestPerStock = {};
    for (const result of results) {
      if (!bestPerStock[result.symbol] || result.totalReturn > bestPerStock[result.symbol].totalReturn) {
        bestPerStock[result.symbol] = result;
      }
    }
    
    // Find overall best
    const overallBest = results.reduce((best, current) => {
      return !best || current.totalReturn > best.totalReturn ? current : best;
    }, null);
    
    console.log(`✅ Completed ${processed} combinations, found ${results.length} valid results`);
    
    res.json({
      success: true,
      date,
      sessionType,
      totalCombinations: processed,
      validResults: results.length,
      bestPerStock: Object.values(bestPerStock),
      overallBest,
      allResults: results
    });
    
  } catch (error) {
    console.error('Error in fast daily:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}