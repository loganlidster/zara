import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { batchSimulate } from './batch-endpoint.js';
import { batchDaily } from './batch-daily-endpoint.js';
import { handleFastDaily } from './fast-daily-endpoint.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// FIXED: Add proper CORS configuration for Firebase hosting
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://tradiac-testing-66f6e.web.app',
    'https://tradiac-testing-66f6e.firebaseapp.com',
    'https://raas.help',
    'https://www.raas.help',
    'https://zara-report-ej9cikknp-logans-projects-57bfdedc.vercel.app',
    'https://frontend-dashboard-epth6tc6e-logans-projects-57bfdedc.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// Database configuration
// Use Unix socket for Cloud Run, IP for local development
const isCloudRun = process.env.K_SERVICE !== undefined;
const dbConfig = {
  host: isCloudRun 
    ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME || 'tradiac-testing:us-central1:tradiac-testing-db'}`
    : (process.env.DB_HOST || '34.41.97.179'),
  port: isCloudRun ? undefined : parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: isCloudRun ? false : { rejectUnauthorized: false }
};

// Simulation endpoint
app.post('/api/simulate', async (req, res) => {
  const {
    symbol,
    startDate,
    endDate,
    sessionMode,
    method,
    buyPct,
    sellPct,
    session,
    rthMethod,
    rthBuyPct,
    rthSellPct,
    ahMethod,
    ahBuyPct,
    ahSellPct,
    initialCapital,
      allowShorts = false,
      conservativePricing = true,
      slippage = 0
  } = req.body;

  console.log('Running simulation:', { 
    symbol, startDate, endDate, sessionMode, 
    method, buyPct, sellPct, session,
    rthMethod, rthBuyPct, rthSellPct,
    ahMethod, ahBuyPct, ahSellPct
  });

  const client = new Client(dbConfig);

  try {
    await client.connect();

    // FIXED: Support 'ALL' session - don't filter by session if 'ALL' is selected
    const sessionFilter = session === 'ALL' ? '' : 'AND s.session = $5';
    const queryParams = session === 'ALL' 
      ? [method, symbol, startDate, endDate]
      : [method, symbol, startDate, endDate, session];

    // Query to get data with baselines
    const query = `
      SELECT 
        s.et_date,
        s.et_time,
        s.bar_time,
        s.close as stock_close,
        b.close as btc_close,
        bl.baseline,
        s.session,
        tc.prev_open_date,
        (b.close / NULLIF(s.close, 0)) as current_ratio
      FROM minute_stock s
      INNER JOIN minute_btc b ON s.bar_time = b.bar_time
      INNER JOIN trading_calendar tc ON s.et_date = tc.cal_date
      INNER JOIN baseline_daily bl ON 
        bl.symbol = s.symbol 
        AND bl.trading_day = tc.prev_open_date
        AND bl.session = s.session
        AND bl.method = $1
      WHERE s.symbol = $2
        AND s.et_date >= $3
        AND s.et_date <= $4
        ${sessionFilter}
        AND tc.is_open = true
      ORDER BY s.bar_time ASC
    `;

    const result = await client.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified parameters' });
    }

    // Run simulation
    let cash = initialCapital;
    let shares = 0;
    let position = 'FLAT';
    let trades = [];
    let dailyPerformance = [];
    let currentDay = null;
    let dayStartEquity = initialCapital;
    let dayTrades = 0;

      // Track previous trade for delta calculations
      let prevTradeValue = null;
      let prevTradeBtcPrice = null;
      
    for (const bar of result.rows) {
      const { et_date, et_time, stock_close, btc_close, baseline, current_ratio, prev_open_date , session: barSession } = bar;
   
         // Determine which thresholds to use based on session mode
         let buyThreshold, sellThreshold;
         
         if (sessionMode === 'ALL') {
           // Use session-specific thresholds
           if (barSession === 'RTH') {
             buyThreshold = baseline * (1 + rthBuyPct / 100);
             sellThreshold = baseline * (1 - rthSellPct / 100);
           } else if (barSession === 'AH') {
             buyThreshold = baseline * (1 + ahBuyPct / 100);
             sellThreshold = baseline * (1 - ahSellPct / 100);
           } else {
             // Fallback to single session values
             buyThreshold = baseline * (1 + buyPct / 100);
             sellThreshold = baseline * (1 - sellPct / 100);
           }
         } else {
           // Single session mode - use single values
           buyThreshold = baseline * (1 + buyPct / 100);
           sellThreshold = baseline * (1 - sellPct / 100);
         }

      // Track daily performance
      if (currentDay !== et_date) {
        if (currentDay !== null) {
          const dayEndEquity = cash + (shares * stock_close);
          const dayReturn = ((dayEndEquity - dayStartEquity) / dayStartEquity) * 100;
          
          dailyPerformance.push({
            date: currentDay,
            start_equity: dayStartEquity,
            end_equity: dayEndEquity,
            return_pct: dayReturn,
            trades: dayTrades
          });
        }
        
        currentDay = et_date;
        dayStartEquity = cash + (shares * stock_close);
        dayTrades = 0;
      }

      // Trading logic
      if (position === 'FLAT') {
        if (current_ratio > buyThreshold) {
          const sharesToBuy = Math.floor(cash / stock_close);
          if (sharesToBuy > 0) {
            const buyPrice = Math.ceil(stock_close * 100) / 100;
            const cost = sharesToBuy * buyPrice;
            
            if (cost <= cash) {
              shares = sharesToBuy;
              cash -= cost;
              position = 'LONG';
              
              trades.push({
                date: et_date,
                time: et_time,
                action: 'BUY',
                shares: sharesToBuy,
                price: buyPrice,
                value: cost,
                baseline: baseline,
                prev_baseline_date: prev_open_date,
                current_ratio: current_ratio,
                buy_threshold: buyThreshold,
                   stock_delta: 0,
                   btc_delta: 0
              });
              
                 
                 // Track this trade for delta calculation
                 prevTradeValue = cost;
                 prevTradeBtcPrice = btc_close;
              dayTrades++;
            }
          }
        } else if (current_ratio < sellThreshold && allowShorts) {
          const sharesToShort = Math.floor(cash / stock_close);
          if (sharesToShort > 0) {
            const shortPrice = Math.floor(stock_close * 100) / 100;
            const proceeds = sharesToShort * shortPrice;
            
            shares = -sharesToShort;
            cash += proceeds;
            position = 'SHORT';
            
            trades.push({
              date: et_date,
              time: et_time,
              action: 'SHORT',
              shares: sharesToShort,
              price: shortPrice,
              value: proceeds,
              baseline: baseline,
              prev_baseline_date: prev_open_date,
              current_ratio: current_ratio,
              sell_threshold: sellThreshold,
                 stock_delta: 0,
                 btc_delta: 0
            });
            
               
               // Track this trade for delta calculation
               prevTradeValue = proceeds;
               prevTradeBtcPrice = btc_close;
            dayTrades++;
          }
        }
      } else if (position === 'LONG') {
        if (current_ratio < sellThreshold) {
          const sellPrice = Math.floor(stock_close * 100) / 100;
          const proceeds = shares * sellPrice;
          
             
             // Calculate deltas
             const stockDelta = prevTradeValue ? ((proceeds - prevTradeValue) / prevTradeValue * 100) : 0;
             const btcDelta = prevTradeBtcPrice ? ((btc_close - prevTradeBtcPrice) / prevTradeBtcPrice * 100) : 0;
          trades.push({
            date: et_date,
            time: et_time,
            action: 'SELL',
            shares: shares,
            price: sellPrice,
            value: proceeds,
            baseline: baseline,
            prev_baseline_date: prev_open_date,
            current_ratio: current_ratio,
            sell_threshold: sellThreshold,
               stock_delta: stockDelta,
               btc_delta: btcDelta
          });
          
             
             // Update previous trade tracking
             prevTradeValue = proceeds;
             prevTradeBtcPrice = btc_close;
          cash += proceeds;
          shares = 0;
          position = 'FLAT';
          dayTrades++;
        }
      } else if (position === 'SHORT') {
        if (current_ratio > buyThreshold) {
          const coverPrice = Math.ceil(stock_close * 100) / 100;
          const cost = Math.abs(shares) * coverPrice;
          
             
             // Calculate deltas
             const stockDelta = prevTradeValue ? ((prevTradeValue - cost) / prevTradeValue * 100) : 0;
             const btcDelta = prevTradeBtcPrice ? ((btc_close - prevTradeBtcPrice) / prevTradeBtcPrice * 100) : 0;
          trades.push({
            date: et_date,
            time: et_time,
            action: 'COVER',
            shares: Math.abs(shares),
            price: coverPrice,
            value: cost,
            baseline: baseline,
            prev_baseline_date: prev_open_date,
            current_ratio: current_ratio,
            buy_threshold: buyThreshold,
               stock_delta: stockDelta,
               btc_delta: btcDelta
          });
          
             
             // Update previous trade tracking
             prevTradeValue = cost;
             prevTradeBtcPrice = btc_close;
          cash -= cost;
          shares = 0;
          position = 'FLAT';
          dayTrades++;
        }
      }
    }

    // Close any open position
    const lastBar = result.rows[result.rows.length - 1];
    if (shares !== 0) {
      const closePrice = shares > 0 
        ? Math.floor(lastBar.stock_close * 100) / 100
        : Math.ceil(lastBar.stock_close * 100) / 100;
      
      const value = Math.abs(shares) * closePrice;
      
      trades.push({
        date: lastBar.et_date,
        time: lastBar.et_time,
        action: shares > 0 ? 'SELL' : 'COVER',
        shares: Math.abs(shares),
        price: closePrice,
        value: value,
        baseline: lastBar.baseline,
        prev_baseline_date: lastBar.prev_open_date,
        current_ratio: lastBar.current_ratio,
        note: 'End of period close'
      });
      
      if (shares > 0) {
        cash += value;
      } else {
        cash -= value;
      }
      shares = 0;
    }

    // Final day performance
    if (currentDay !== null) {
      const dayEndEquity = cash;
      const dayReturn = ((dayEndEquity - dayStartEquity) / dayStartEquity) * 100;
      
      dailyPerformance.push({
        date: currentDay,
        start_equity: dayStartEquity,
        end_equity: dayEndEquity,
        return_pct: dayReturn,
        trades: dayTrades
      });
    }

    // Calculate metrics
    const finalEquity = cash;
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
    const winningTrades = trades.filter((t, i) => {
      if (i === 0) return false;
      const prevTrade = trades[i - 1];
      if (t.action === 'SELL' && prevTrade.action === 'BUY') {
        return t.price > prevTrade.price;
      }
      if (t.action === 'COVER' && prevTrade.action === 'SHORT') {
        return t.price < prevTrade.price;
      }
      return false;
    }).length;

    const completedTrades = Math.floor(trades.length / 2);
    const winRate = completedTrades > 0 ? (winningTrades / completedTrades) * 100 : 0;

    const response = {
      symbol,
      method,
      buyPct,
      sellPct,
      session,
      startDate,
      endDate,
      initialCapital,
      finalEquity,
      totalReturn,
      trades: trades.length,
      completedTrades,
      winningTrades,
      winRate,
      tradeLog: trades,
      dailyPerformance
    };

    res.json(response);

  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
});

// Batch simulate endpoint
app.post('/api/batch-simulate', batchSimulate);

// Batch daily endpoint
app.post('/api/batch-daily', batchDaily);

// Fast daily endpoint
app.post('/api/fast-daily', handleFastDaily);

// Event-based endpoints
import eventEndpoints from './event-endpoints.js';
app.use('/api/events', eventEndpoints);

// Flexible query endpoints
import flexibleEndpoints from './flexible-query-endpoints.js';
app.use('/api/flexible', flexibleEndpoints);
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});