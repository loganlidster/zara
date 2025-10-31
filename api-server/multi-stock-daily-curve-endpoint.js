import pool from './db.js';

/**
 * Multi-Stock Daily Curve Endpoint
 * 
 * Runs Daily Curve simulation for multiple stocks simultaneously,
 * each with independent settings and $10,000 starting capital.
 * 
 * This eliminates the need to run Daily Curve 11 times manually.
 */

// Helper function to apply slippage
function applySlippage(price, type, slippagePct) {
  if (slippagePct === 0) return price;
  const slippage = price * (slippagePct / 100);
  return type === 'BUY' ? price + slippage : price - slippage;
}

// Helper function to apply conservative rounding
function applyConservativeRounding(price, type) {
  return type === 'BUY' ? Math.ceil(price * 100) / 100 : Math.floor(price * 100) / 100;
}

// Simulate trading for a single stock (reuses Daily Curve logic)
async function simulateSingleStock(params) {
  const {
    symbol,
    method,
    startDate,
    endDate,
    rthBuyPct,
    rthSellPct,
    ahBuyPct,
    ahSellPct,
    slippagePct = 0,
    conservativeRounding = true
  } = params;

  // Fetch events from both RTH and AH tables
  const methodLower = method.toLowerCase();
  const rthTableName = `trade_events_rth_${methodLower}`;
  const ahTableName = `trade_events_ah_${methodLower}`;

  // Fetch RTH events
  const rthEventsQuery = `
    SELECT 
      symbol,
      event_time,
      event_date,
      'RTH' as session,
      event_type,
      stock_price,
      btc_price,
      ratio,
      baseline,
      buy_pct,
      sell_pct
    FROM ${rthTableName}
    WHERE symbol = $1
      AND event_date >= $2
      AND event_date <= $3
  `;

  // Fetch AH events
  const ahEventsQuery = `
    SELECT 
      symbol,
      event_time,
      event_date,
      'AH' as session,
      event_type,
      stock_price,
      btc_price,
      ratio,
      baseline,
      buy_pct,
      sell_pct
    FROM ${ahTableName}
    WHERE symbol = $1
      AND event_date >= $2
      AND event_date <= $3
  `;

  const [rthResult, ahResult] = await Promise.all([
    pool.query(rthEventsQuery, [symbol, startDate, endDate]),
    pool.query(ahEventsQuery, [symbol, startDate, endDate])
  ]);

  // Combine and sort events by time
  const events = [...rthResult.rows, ...ahResult.rows].sort((a, b) => {
    return new Date(a.event_time) - new Date(b.event_time);
  });

  if (events.length === 0) {
    return {
      symbol,
      method,
      dates: [],
      equityCurve: [],
      summary: {
        totalReturn: 0,
        totalReturnPct: 0,
        totalTrades: 0,
        winRate: 0,
        avgTrade: 0,
        finalEquity: 10000
      }
    };
  }

  // Filter events based on session-specific thresholds
  const filteredEvents = events.filter(event => {
    const isRTH = event.session === 'RTH';
    const buyThreshold = isRTH ? rthBuyPct : ahBuyPct;
    const sellThreshold = isRTH ? rthSellPct : ahSellPct;

    if (event.event_type === 'BUY') {
      return event.buy_pct >= buyThreshold;
    } else {
      return event.sell_pct >= sellThreshold;
    }
  });

  // Simulate wallet
  let cash = 10000;
  let shares = 0;
  let lastAction = null;
  const trades = [];
  const dailyEquity = {};

  for (const event of filteredEvents) {
    // Enforce alternating BUY/SELL pattern
    if (lastAction === event.event_type) {
      continue;
    }

    let price = parseFloat(event.stock_price);

    // Apply slippage
    if (slippagePct > 0) {
      price = applySlippage(price, event.event_type, slippagePct);
    }

    // Apply conservative rounding
    if (conservativeRounding) {
      price = applyConservativeRounding(price, event.event_type);
    }

    if (event.event_type === 'BUY' && shares === 0) {
      // Buy with all available cash
      shares = Math.floor(cash / price);
      const cost = shares * price;
      cash -= cost;
      lastAction = 'BUY';

      trades.push({
        date: event.event_date,
        time: event.event_time,
        type: 'BUY',
        price,
        shares,
        value: cost,
        cash,
        equity: cash + (shares * price)
      });
    } else if (event.event_type === 'SELL' && shares > 0) {
      // Sell all shares
      const proceeds = shares * price;
      cash += proceeds;
      const equity = cash;
      
      trades.push({
        date: event.event_date,
        time: event.event_time,
        type: 'SELL',
        price,
        shares,
        value: proceeds,
        cash,
        equity
      });

      shares = 0;
      lastAction = 'SELL';
    }

    // Track daily equity
    const currentEquity = cash + (shares * price);
    dailyEquity[event.event_date] = currentEquity;
  }

  // Calculate final equity (if still holding shares, use last known price)
  let finalEquity = cash;
  if (shares > 0 && filteredEvents.length > 0) {
    const lastEvent = filteredEvents[filteredEvents.length - 1];
    finalEquity = cash + (shares * parseFloat(lastEvent.stock_price));
  }

  // Calculate statistics
  const totalReturn = finalEquity - 10000;
  const totalReturnPct = (totalReturn / 10000) * 100;
  const totalTrades = trades.filter(t => t.type === 'SELL').length;

  // Calculate win rate
  let wins = 0;
  let totalTradeReturn = 0;
  for (let i = 0; i < trades.length; i++) {
    if (trades[i].type === 'SELL' && i > 0) {
      const buyTrade = trades[i - 1];
      const sellTrade = trades[i];
      const tradeReturn = ((sellTrade.price - buyTrade.price) / buyTrade.price) * 100;
      totalTradeReturn += tradeReturn;
      if (tradeReturn > 0) wins++;
    }
  }

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgTrade = totalTrades > 0 ? totalTradeReturn / totalTrades : 0;

  // Prepare equity curve data
  const dates = Object.keys(dailyEquity).sort();
  const equityCurve = dates.map(date => dailyEquity[date]);

  return {
    symbol,
    method,
    dates,
    equityCurve,
    summary: {
      totalReturn,
      totalReturnPct,
      totalTrades,
      winRate,
      avgTrade,
      finalEquity
    },
    trades
  };
}

// Main endpoint handler
async function handleMultiStockDailyCurve(req, res) {
  try {
    const {
      startDate,
      endDate,
      slippagePct = 0,
      conservativeRounding = true,
      stocks = []
    } = req.body;

    // Validation
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    if (!stocks || stocks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one stock configuration is required'
      });
    }

    // Validate each stock configuration
    for (const stock of stocks) {
      if (!stock.symbol || !stock.method) {
        return res.status(400).json({
          success: false,
          error: 'Each stock must have symbol and method'
        });
      }
      if (stock.rthBuyPct === undefined || stock.rthSellPct === undefined ||
          stock.ahBuyPct === undefined || stock.ahSellPct === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Each stock must have RTH and AH buy/sell percentages'
        });
      }
    }

    console.log(`[Multi-Stock Daily Curve] Processing ${stocks.length} stocks from ${startDate} to ${endDate}`);

    // Run simulation for each stock independently
    const results = [];
    const errors = [];

    for (const stock of stocks) {
      try {
        const result = await simulateSingleStock({
          symbol: stock.symbol,
          method: stock.method,
          startDate,
          endDate,
          rthBuyPct: stock.rthBuyPct,
          rthSellPct: stock.rthSellPct,
          ahBuyPct: stock.ahBuyPct,
          ahSellPct: stock.ahSellPct,
          slippagePct,
          conservativeRounding
        });
        results.push(result);
        console.log(`[Multi-Stock Daily Curve] ${stock.symbol} completed: ${result.summary.totalReturnPct.toFixed(2)}% return`);
      } catch (error) {
        console.error(`[Multi-Stock Daily Curve] Error processing ${stock.symbol}:`, error);
        errors.push({
          symbol: stock.symbol,
          error: error.message
        });
      }
    }

    // Return results
    res.json({
      success: true,
      dateRange: { startDate, endDate },
      results,
      errors: errors.length > 0 ? errors : undefined,
      timing: {
        totalStocks: stocks.length,
        successfulStocks: results.length,
        failedStocks: errors.length
      }
    });

  } catch (error) {
    console.error('[Multi-Stock Daily Curve] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default handleMultiStockDailyCurve;