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
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: isCloudRun ? false : { rejectUnauthorized: false },
  max: 50,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  statement_timeout: 120000,
  query_timeout: 120000,
});

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
  return 'AH';
}

/**
 * Simulate Trades Detailed - Run multi-day simulation with detailed trade markers
 * 
 * Request body:
 * {
 *   symbol: string,
 *   startDate: string,
 *   endDate: string,
 *   method: string,
 *   buyThreshold: number,
 *   sellThreshold: number,
 *   sessionType: string,
 *   conservativePricing?: boolean,
 *   slippage?: number,
 *   initialCapital?: number,
 *   rthBuyPct?: number,      // For ALL session
 *   rthSellPct?: number,     // For ALL session
 *   ahBuyPct?: number,       // For ALL session
 *   ahSellPct?: number       // For ALL session
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   summary: {
 *     totalReturn: number,
 *     totalReturnPct: number,
 *     tradeCount: number,
 *     winningTrades: number,
 *     losingTrades: number,
 *     winRate: number,
 *     avgReturn: number,
 *     bestTrade: number,
 *     worstTrade: number,
 *     finalEquity: number,
 *     finalCash: number,
 *     finalShares: number
 *   },
 *   trades: [...],
 *   dailyEquity: [...],
 *   parameters: {...}
 * }
 */
export async function handleSimulateTradesDetailed(req, res) {
  console.log('🎯 Simulate Trades Detailed endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();

  try {
    const {
      symbol,
      startDate,
      endDate,
      method,
      buyThreshold,
      sellThreshold,
      sessionType = 'RTH',
      conservativePricing = true,
      slippage = 0.0,
      initialCapital = 10000,
      rthBuyPct,
      rthSellPct,
      ahBuyPct,
      ahSellPct
    } = req.body;

    // Validate required parameters
    if (!symbol || !startDate || !endDate || !method || buyThreshold === undefined || sellThreshold === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    console.log(`Simulating ${symbol} ${method} from ${startDate} to ${endDate}`);
    console.log(`Thresholds: Buy ${buyThreshold}%, Sell ${sellThreshold}%`);
    console.log(`Session: ${sessionType}, Conservative: ${conservativePricing}, Slippage: ${slippage}`);

    // Build session filter
    let sessionFilter = '';
    if (sessionType === 'RTH') {
      sessionFilter = `AND s.et_time >= '09:30:00' AND s.et_time < '16:00:00'`;
    } else if (sessionType === 'AH') {
      sessionFilter = `AND ((s.et_time >= '04:00:00' AND s.et_time < '09:30:00') OR (s.et_time >= '16:00:00' AND s.et_time < '20:00:00'))`;
    } else if (sessionType === 'ALL') {
      sessionFilter = `AND s.et_time >= '04:00:00' AND s.et_time < '20:00:00'`;
    }

    // Get all minute data for the date range
    const dataQuery = `
      SELECT 
        s.et_date,
        s.et_time,
        s.close as stock_price,
        b.close as btc_price
      FROM minute_stock s
      JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
      WHERE s.symbol = $1
        AND s.et_date >= $2
        AND s.et_date <= $3
        ${sessionFilter}
      ORDER BY s.et_date, s.et_time
    `;

    const dataResult = await client.query(dataQuery, [symbol, startDate, endDate]);

    if (dataResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No minute data found for the specified date range'
      });
    }

    console.log(`✅ Found ${dataResult.rows.length} minute bars`);

    // Get baselines for each day (from PREVIOUS trading day)
    const baselineQuery = `
      SELECT 
        tc.cal_date as current_day,
        b.session,
        b.baseline
      FROM trading_calendar tc
      JOIN baseline_daily b ON b.trading_day = tc.prev_open_date AND b.symbol = $1 AND b.method = $2
      WHERE tc.cal_date >= $3
        AND tc.cal_date <= $4
        AND tc.is_trading_day = true
      ORDER BY tc.cal_date, b.session
    `;

    const baselineResult = await client.query(baselineQuery, [symbol, method, startDate, endDate]);

    // Build baseline lookup map
    const baselines = {};
    for (const row of baselineResult.rows) {
      const key = `${row.current_day}_${row.session}`;
      baselines[key] = parseFloat(row.baseline);
    }

    console.log(`✅ Found baselines for ${Object.keys(baselines).length} day-session combinations`);

    // Run simulation
    let cash = initialCapital;
    let shares = 0;
    let position = null;
    const trades = [];
    const dailyEquity = [];
    
    let currentDate = null;
    let dayStartEquity = initialCapital;
    let dayTrades = 0;

    for (const bar of dataResult.rows) {
      const barDate = bar.et_date;
      const barTime = bar.et_time;
      const barSession = getSessionForTime(barTime);
      const stockPrice = parseFloat(bar.stock_price);
      const btcPrice = parseFloat(bar.btc_price);
      const ratio = btcPrice / stockPrice;

      // Check if we're on a new day
      if (currentDate !== barDate) {
        // Record previous day's equity if not first day
        if (currentDate !== null) {
          const dayEndEquity = cash + (shares * stockPrice);
          const dayReturn = ((dayEndEquity - dayStartEquity) / dayStartEquity) * 100;
          
          dailyEquity.push({
            date: currentDate,
            startEquity: dayStartEquity,
            endEquity: dayEndEquity,
            dayReturn: dayReturn,
            trades: dayTrades
          });
        }

        // Start new day
        currentDate = barDate;
        dayStartEquity = cash + (shares * stockPrice);
        dayTrades = 0;
      }

      // Get baseline for this bar
      const baselineKey = `${barDate}_${barSession}`;
      const baseline = baselines[baselineKey];

      if (!baseline) {
        continue; // Skip if no baseline available
      }

      // Determine active thresholds
      let activeBuyThreshold = buyThreshold;
      let activeSellThreshold = sellThreshold;

      if (sessionType === 'ALL' && rthBuyPct !== undefined && ahBuyPct !== undefined) {
        if (barSession === 'RTH') {
          activeBuyThreshold = rthBuyPct;
          activeSellThreshold = rthSellPct;
        } else {
          activeBuyThreshold = ahBuyPct;
          activeSellThreshold = ahSellPct;
        }
      }

      const buyThr = baseline * (1 + activeBuyThreshold / 100);
      const sellThr = baseline * (1 - activeSellThreshold / 100);

      // Check for entry
      if (!position && ratio >= buyThr && cash > 0) {
        let entryPrice = applySlippage(stockPrice, true, slippage);
        if (conservativePricing) {
          entryPrice = roundPrice(entryPrice, true);
        }

        const sharesToBuy = Math.floor(cash / entryPrice);
        
        if (sharesToBuy > 0) {
          position = {
            type: 'LONG',
            entryDate: barDate,
            entryTime: barTime,
            entryPrice: entryPrice,
            entryBaseline: baseline,
            entryBtcPrice: btcPrice,
            entryRatio: ratio,
            shares: sharesToBuy,
            session: barSession
          };

          cash -= sharesToBuy * entryPrice;
          shares = sharesToBuy;

          console.log(`  BUY: ${barDate} ${barTime} - ${sharesToBuy} shares @ $${entryPrice.toFixed(2)}`);
        }
      }
      // Check for exit
      else if (position && ratio <= sellThr) {
        let exitPrice = applySlippage(stockPrice, false, slippage);
        if (conservativePricing) {
          exitPrice = roundPrice(exitPrice, false);
        }

        const tradeReturn = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
        const stockDelta = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
        const btcDelta = ((btcPrice - position.entryBtcPrice) / position.entryBtcPrice) * 100;

        trades.push({
          entryDate: position.entryDate,
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          entryBaseline: position.entryBaseline,
          entryBtcPrice: position.entryBtcPrice,
          entryRatio: position.entryRatio,
          exitDate: barDate,
          exitTime: barTime,
          exitPrice: exitPrice,
          exitBaseline: baseline,
          exitBtcPrice: btcPrice,
          exitRatio: ratio,
          shares: position.shares,
          return: tradeReturn,
          stockDelta: stockDelta,
          btcDelta: btcDelta,
          session: position.session
        });

        cash += shares * exitPrice;
        shares = 0;
        position = null;
        dayTrades++;

        console.log(`  SELL: ${barDate} ${barTime} - ${position?.shares || 0} shares @ $${exitPrice.toFixed(2)} (Return: ${tradeReturn.toFixed(2)}%)`);
      }
    }

    // Record final day's equity
    if (currentDate !== null) {
      const lastBar = dataResult.rows[dataResult.rows.length - 1];
      const finalPrice = parseFloat(lastBar.stock_price);
      const dayEndEquity = cash + (shares * finalPrice);
      const dayReturn = ((dayEndEquity - dayStartEquity) / dayStartEquity) * 100;
      
      dailyEquity.push({
        date: currentDate,
        startEquity: dayStartEquity,
        endEquity: dayEndEquity,
        dayReturn: dayReturn,
        trades: dayTrades
      });
    }

    // Calculate summary statistics
    const finalEquity = cash + (shares * parseFloat(dataResult.rows[dataResult.rows.length - 1].stock_price));
    const totalReturn = finalEquity - initialCapital;
    const totalReturnPct = (totalReturn / initialCapital) * 100;

    const winningTrades = trades.filter(t => t.return > 0).length;
    const losingTrades = trades.filter(t => t.return <= 0).length;
    const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
    const avgReturn = trades.length > 0 ? trades.reduce((sum, t) => sum + t.return, 0) / trades.length : 0;
    const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.return)) : 0;
    const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.return)) : 0;

    console.log(`✅ Simulation complete: ${trades.length} trades, ${totalReturnPct.toFixed(2)}% return`);

    res.json({
      success: true,
      summary: {
        totalReturn,
        totalReturnPct,
        tradeCount: trades.length,
        winningTrades,
        losingTrades,
        winRate,
        avgReturn,
        bestTrade,
        worstTrade,
        finalEquity,
        finalCash: cash,
        finalShares: shares,
        initialCapital
      },
      trades,
      dailyEquity,
      parameters: {
        symbol,
        startDate,
        endDate,
        method,
        buyThreshold,
        sellThreshold,
        sessionType,
        conservativePricing,
        slippage,
        rthBuyPct,
        rthSellPct,
        ahBuyPct,
        ahSellPct
      }
    });

  } catch (error) {
    console.error('❌ Error in simulate-trades-detailed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}