import pg from 'pg';

const { Pool } = pg;

// Database configuration
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

const STARTING_CAPITAL = 10000;

// Calculate baseline from previous N days
function calculateBaseline(minuteData, method) {
  if (minuteData.length === 0) return null;
  
  const ratios = minuteData.map(m => parseFloat(m.btc_c) / parseFloat(m.stock_c)).filter(r => isFinite(r));
  if (ratios.length === 0) return null;
  
  switch (method) {
    case 'EQUAL_MEAN':
      return ratios.reduce((a, b) => a + b, 0) / ratios.length;
      
    case 'VWAP_RATIO':
      const vwapNum = minuteData.reduce((sum, m) => sum + (parseFloat(m.btc_c) / parseFloat(m.stock_c)) * parseFloat(m.stock_v), 0);
      const vwapDen = minuteData.reduce((sum, m) => sum + parseFloat(m.stock_v), 0);
      return vwapDen > 0 ? vwapNum / vwapDen : null;
      
    case 'VOL_WEIGHTED':
      const volNum = minuteData.reduce((sum, m) => {
        const ratio = parseFloat(m.btc_c) / parseFloat(m.stock_c);
        const totalVol = parseFloat(m.stock_v) + parseFloat(m.btc_v);
        return sum + ratio * totalVol;
      }, 0);
      const volDen = minuteData.reduce((sum, m) => sum + parseFloat(m.stock_v) + parseFloat(m.btc_v), 0);
      return volDen > 0 ? volNum / volDen : null;
      
    case 'WINSORIZED':
      const sorted = [...ratios].sort((a, b) => a - b);
      const p5 = sorted[Math.floor(sorted.length * 0.05)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const winsorized = ratios.map(r => Math.max(p5, Math.min(p95, r)));
      return winsorized.reduce((a, b) => a + b, 0) / winsorized.length;
      
    case 'WEIGHTED_MEDIAN':
      const sortedRatios = [...ratios].sort((a, b) => a - b);
      const mid = Math.floor(sortedRatios.length / 2);
      return sortedRatios.length % 2 === 0 
        ? (sortedRatios[mid - 1] + sortedRatios[mid]) / 2 
        : sortedRatios[mid];
      
    default:
      return null;
  }
}

// Simulate one day with given settings
function simulateDay(minuteData, baseline, buyPct, sellPct) {
  let cash = STARTING_CAPITAL;
  let shares = 0;
  let trades = 0;
  
  const buyThreshold = baseline * (1 - buyPct / 100);
  const sellThreshold = baseline * (1 + sellPct / 100);
  
  for (const bar of minuteData) {
    const price = parseFloat(bar.stock_c);
    
    // Buy signal
    if (shares === 0 && price <= buyThreshold) {
      shares = Math.floor(cash / price);
      cash -= shares * price;
      trades++;
    }
    // Sell signal
    else if (shares > 0 && price >= sellThreshold) {
      cash += shares * price;
      shares = 0;
      trades++;
    }
  }
  
  // Calculate final equity
  const lastPrice = minuteData.length > 0 ? parseFloat(minuteData[minuteData.length - 1].stock_c) : 0;
  const equity = cash + shares * lastPrice;
  const returnPct = ((equity - STARTING_CAPITAL) / STARTING_CAPITAL) * 100;
  
  return { returnPct, trades, equity };
}

// Calculate correlation metrics for confidence
function calculateConfidence(minuteData, baseline, horizon = 10) {
  if (minuteData.length < horizon + 1) return { pearson: null, spearman: null, confidence: 0 };
  
  const signals = [];
  const returns = [];
  
  for (let i = 0; i < minuteData.length - horizon; i++) {
    const currentPrice = parseFloat(minuteData[i].stock_c);
    const futurePrice = parseFloat(minuteData[i + horizon].stock_c);
    
    // Signal: deviation from baseline
    const signal = (baseline - currentPrice) / baseline;
    
    // Forward return
    const forwardReturn = (futurePrice - currentPrice) / currentPrice;
    
    signals.push(signal);
    returns.push(forwardReturn);
  }
  
  if (signals.length < 10) return { pearson: null, spearman: null, confidence: 0 };
  
  // Pearson correlation
  const pearson = calculatePearson(signals, returns);
  
  // Spearman correlation (rank-based)
  const spearman = calculateSpearman(signals, returns);
  
  // Fisher confidence transformation
  const confidence = fisherConfidence(pearson, signals.length);
  
  return { pearson, spearman, confidence };
}

function calculatePearson(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateSpearman(x, y) {
  const ranks = (arr) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const result = new Array(arr.length);
    sorted.forEach((item, rank) => result[item.i] = rank + 1);
    return result;
  };
  
  const xRanks = ranks(x);
  const yRanks = ranks(y);
  
  return calculatePearson(xRanks, yRanks);
}

function fisherConfidence(r, n) {
  if (!isFinite(r) || n < 3) return 0;
  
  // Fisher Z-transformation
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  
  // Confidence score (0-1)
  const zScore = Math.abs(z) / se;
  const confidence = Math.min(1, zScore / 3); // Normalize to 0-1
  
  return confidence;
}

// Main batch daily function
export async function batchDaily(req, res) {
  const {
    symbols,
    startDate,
    endDate,
    methods,
    lookbackDays = 1,
    buyThresholds,
    sellThresholds,
    confidenceHorizon = 10
  } = req.body;
  
  const client = await pool.connect();
  
  try {
    const dailyWinners = [];
    
    for (const symbol of symbols) {
      // Get all trading days in range
      const daysResult = await client.query(`
        SELECT DISTINCT et_date
        FROM minute_stock
        WHERE symbol = $1
        AND et_date >= $2
        AND et_date <= $3
        ORDER BY et_date
      `, [symbol, startDate, endDate]);
      
      const tradingDays = daysResult.rows.map(r => r.et_date);
      
      for (let i = 0; i < tradingDays.length; i++) {
        const currentDay = tradingDays[i];
        
        // Get previous N days for baseline
        const prevDays = tradingDays.slice(Math.max(0, i - lookbackDays), i);
        if (prevDays.length < lookbackDays) continue;
        
        // Fetch minute data for previous days
        const prevDataResult = await client.query(`
          SELECT ms.close as stock_c, ms.volume as stock_v, mb.close as btc_c, mb.volume as btc_v
          FROM minute_stock ms
          JOIN minute_btc mb ON ms.et_date = mb.et_date AND ms.et_time = mb.et_time
          WHERE ms.symbol = $1
          AND ms.et_date = ANY($2)
          AND ms.session = 'RTH'
          ORDER BY ms.et_date, ms.et_time
        `, [symbol, prevDays]);
        
        // Fetch minute data for current day
        const currentDataResult = await client.query(`
          SELECT ms.close as stock_c, ms.volume as stock_v, mb.close as btc_c, mb.volume as btc_v
          FROM minute_stock ms
          JOIN minute_btc mb ON ms.et_date = mb.et_date AND ms.et_time = mb.et_time
          WHERE ms.symbol = $1
          AND ms.et_date = $2
          AND ms.session = 'RTH'
          ORDER BY ms.et_time
        `, [symbol, currentDay]);
        
        if (currentDataResult.rows.length === 0) continue;
        
        // Test all combinations for this day
        let bestResult = null;
        
        for (const method of methods) {
          const baseline = calculateBaseline(prevDataResult.rows, method);
          if (!baseline) continue;
          
          for (const buyPct of buyThresholds) {
            for (const sellPct of sellThresholds) {
              const result = simulateDay(currentDataResult.rows, baseline, buyPct, sellPct);
              
              if (!bestResult || result.returnPct > bestResult.returnPct) {
                bestResult = {
                  ...result,
                  method,
                  buyPct,
                  sellPct,
                  baseline
                };
              }
            }
          }
        }
        
        if (bestResult) {
          // Calculate confidence
          const confidence = calculateConfidence(currentDataResult.rows, bestResult.baseline, confidenceHorizon);
          
          dailyWinners.push({
            date: currentDay,
            symbol,
            method: bestResult.method,
            buyPct: bestResult.buyPct,
            sellPct: bestResult.sellPct,
            trades: bestResult.trades,
            returnPct: bestResult.returnPct,
            baseline: bestResult.baseline,
            ...confidence
          });
        }
      }
    }
    
    // Calculate consistency summary
    const summary = {};
    
    for (const winner of dailyWinners) {
      const key = `${winner.symbol}|${winner.method}`;
      if (!summary[key]) {
        summary[key] = {
          symbol: winner.symbol,
          method: winner.method,
          daysWon: 0,
          totalReturn: 0,
          returns: [],
          confidences: []
        };
      }
      
      summary[key].daysWon++;
      summary[key].totalReturn += winner.returnPct;
      summary[key].returns.push(winner.returnPct);
      summary[key].confidences.push(winner.confidence);
    }
    
    const consistencySummary = Object.values(summary).map(s => ({
      symbol: s.symbol,
      method: s.method,
      daysWon: s.daysWon,
      avgReturn: s.totalReturn / s.daysWon,
      medianReturn: s.returns.sort((a, b) => a - b)[Math.floor(s.returns.length / 2)],
      avgConfidence: s.confidences.reduce((a, b) => a + b, 0) / s.confidences.length
    })).sort((a, b) => b.daysWon - a.daysWon || b.avgReturn - a.avgReturn);
    
    res.json({
      dailyWinners,
      consistencySummary
    });
    
  } catch (error) {
    console.error('Batch daily error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}