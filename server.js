import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '34.41.97.179',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

// Simulation endpoint
app.post('/api/simulate', async (req, res) => {
  const {
    symbol,
    startDate,
    endDate,
    sessionMode = 'SINGLE',
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
    ...(sessionMode === 'SINGLE' ? { method, buyPct, sellPct, session } : { rthMethod, rthBuyPct, rthSellPct, ahMethod, ahBuyPct, ahSellPct })
  });

  const client = new Client(dbConfig);

  try {
    await client.connect();

    let result;

    if (sessionMode === 'SINGLE') {
      // Single session query
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
          AND s.session = $5
          AND tc.is_open = true
        ORDER BY s.bar_time ASC
      `;

      result = await client.query(query, [method, symbol, startDate, endDate, session]);
    } else {
      // All hours query - get both RTH and AH with their respective baselines
      const query = `
        SELECT 
          s.et_date,
          s.et_time,
          s.bar_time,
          s.close as stock_close,
          b.close as btc_close,
          bl_rth.baseline as rth_baseline,
          bl_ah.baseline as ah_baseline,
          s.session,
          tc.prev_open_date,
          (b.close / NULLIF(s.close, 0)) as current_ratio
        FROM minute_stock s
        INNER JOIN minute_btc b ON s.bar_time = b.bar_time
        INNER JOIN trading_calendar tc ON s.et_date = tc.cal_date
        LEFT JOIN baseline_daily bl_rth ON 
          bl_rth.symbol = s.symbol 
          AND bl_rth.trading_day = tc.prev_open_date
          AND bl_rth.session = 'RTH'
          AND bl_rth.method = $1
        LEFT JOIN baseline_daily bl_ah ON 
          bl_ah.symbol = s.symbol 
          AND bl_ah.trading_day = tc.prev_open_date
          AND bl_ah.session = 'AH'
          AND bl_ah.method = $2
        WHERE s.symbol = $3
          AND s.et_date >= $4
          AND s.et_date <= $5
          AND tc.is_open = true
        ORDER BY s.bar_time ASC
      `;

      result = await client.query(query, [rthMethod, ahMethod, symbol, startDate, endDate]);
    }

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

    for (const bar of result.rows) {
      const { et_date, et_time, stock_close, btc_close, session: barSession, current_ratio, prev_open_date } = bar;

      // Determine which baseline and thresholds to use
      let baseline, currentBuyPct, currentSellPct, currentMethod;
      
      if (sessionMode === 'SINGLE') {
        baseline = bar.baseline;
        currentBuyPct = buyPct;
        currentSellPct = sellPct;
        currentMethod = method;
      } else {
        // All hours mode - use session-specific settings
        if (barSession === 'RTH') {
          baseline = bar.rth_baseline;
          currentBuyPct = rthBuyPct;
          currentSellPct = rthSellPct;
          currentMethod = rthMethod;
        } else {
          baseline = bar.ah_baseline;
          currentBuyPct = ahBuyPct;
          currentSellPct = ahSellPct;
          currentMethod = ahMethod;
        }
      }

      if (!baseline) continue; // Skip if no baseline available

      const buyThreshold = baseline * (1 + currentBuyPct / 100);
      const sellThreshold = baseline * (1 - currentSellPct / 100);

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
            // Apply slippage and conservative pricing
            let buyPrice = stock_close;
            if (conservativePricing) {
              // Apply slippage (makes price worse)
              buyPrice = buyPrice * (1 + slippage / 100);
              // Round up (conservative for buys)
              buyPrice = Math.ceil(buyPrice * 100) / 100;
            }
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
                baseline: parseFloat(baseline),
                prev_baseline_date: prev_open_date,
                current_ratio: current_ratio,
                buy_threshold: buyThreshold,
                session: barSession,
                method: currentMethod
              });
              
              dayTrades++;
            }
          }
        } else if (allowShorts && current_ratio < sellThreshold) {
          const sharesToShort = Math.floor(cash / stock_close);
          if (sharesToShort > 0) {
            // Apply slippage and conservative pricing
            let shortPrice = stock_close;
            if (conservativePricing) {
              // Apply slippage (makes price worse)
              shortPrice = shortPrice * (1 - slippage / 100);
              // Round down (conservative for shorts)
              shortPrice = Math.floor(shortPrice * 100) / 100;
            }
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
              baseline: parseFloat(baseline),
              prev_baseline_date: prev_open_date,
              current_ratio: current_ratio,
              sell_threshold: sellThreshold,
              session: barSession,
              method: currentMethod
            });
            
            dayTrades++;
          }
        }
      } else if (position === 'LONG') {
        if (current_ratio < sellThreshold) {
          // Apply slippage and conservative pricing
          let sellPrice = stock_close;
          if (conservativePricing) {
            // Apply slippage (makes price worse)
            sellPrice = sellPrice * (1 - slippage / 100);
            // Round down (conservative for sells)
            sellPrice = Math.floor(sellPrice * 100) / 100;
          }
          const proceeds = shares * sellPrice;
          
          trades.push({
            date: et_date,
            time: et_time,
            action: 'SELL',
            shares: shares,
            price: sellPrice,
            value: proceeds,
            baseline: parseFloat(baseline),
            prev_baseline_date: prev_open_date,
            current_ratio: current_ratio,
            sell_threshold: sellThreshold,
            session: barSession,
            method: currentMethod
          });
          
          cash += proceeds;
          shares = 0;
          position = 'FLAT';
          dayTrades++;
        }
      } else if (position === 'SHORT') {
        if (current_ratio > buyThreshold) {
          // Apply slippage and conservative pricing
          let coverPrice = stock_close;
          if (conservativePricing) {
            // Apply slippage (makes price worse)
            coverPrice = coverPrice * (1 + slippage / 100);
            // Round up (conservative for covering shorts)
            coverPrice = Math.ceil(coverPrice * 100) / 100;
          }
          const cost = Math.abs(shares) * coverPrice;
          
          trades.push({
            date: et_date,
            time: et_time,
            action: 'COVER',
            shares: Math.abs(shares),
            price: coverPrice,
            value: cost,
            baseline: parseFloat(baseline),
            prev_baseline_date: prev_open_date,
            current_ratio: current_ratio,
            buy_threshold: buyThreshold,
            session: barSession,
            method: currentMethod
          });
          
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
         let closePrice = lastBar.stock_close;
         
         if (conservativePricing) {
           if (shares > 0) {
             closePrice = closePrice * (1 - slippage / 100);
             closePrice = Math.floor(closePrice * 100) / 100;
           } else {
             closePrice = closePrice * (1 + slippage / 100);
             closePrice = Math.ceil(closePrice * 100) / 100;
           }
         }
         
         const value = Math.abs(shares) * closePrice;
      
      
      trades.push({
        date: lastBar.et_date,
        time: lastBar.et_time,
        action: shares > 0 ? 'SELL' : 'COVER',
        shares: Math.abs(shares),
        price: closePrice,
        value: value,
        baseline: parseFloat(lastBar.baseline),
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
      sessionMode,
      ...(sessionMode === 'SINGLE' 
        ? { method, buyPct, sellPct, session }
        : { rthMethod, rthBuyPct, rthSellPct, ahMethod, ahBuyPct, ahSellPct }
      ),
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});