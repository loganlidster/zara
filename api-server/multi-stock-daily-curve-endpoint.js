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

// Filter to alternating BUY/SELL events (matches Daily Curve logic)
function filterToAlternating(events) {
  const filtered = [];
  let lastType = null;
  
  for (const event of events) {
    if (event.event_type !== lastType) {
      filtered.push(event);
      lastType = event.event_type;
    }
  }
  
  return filtered;
}

// Simulate trading for a single stock (MATCHES Daily Curve logic exactly)
async function simulateSingleStock(params) {
  const {
    symbol,
    rthMethod,
    ahMethod,
    startDate,
    endDate,
    rthBuyPct,
    rthSellPct,
    ahBuyPct,
    ahSellPct,
    slippagePct = 0,
    conservativeRounding = true
  } = params;

  // Fetch events from both RTH and AH tables with EXACT threshold matching
  // Each session can use a different baseline method
  const rthMethodLower = rthMethod.toLowerCase();
  const ahMethodLower = ahMethod.toLowerCase();
  const rthTableName = `trade_events_rth_${rthMethodLower}`;
  const ahTableName = `trade_events_ah_${ahMethodLower}`;

  // Fetch RTH events with EXACT buy_pct and sell_pct match
  const rthEventsQuery = `
    SELECT 
      event_date,
      event_time,
      event_type,
      stock_price,
      btc_price,
      ratio,
      baseline,
      'RTH' as session
    FROM ${rthTableName}
    WHERE symbol = $1
      AND buy_pct = $2
      AND sell_pct = $3
      AND event_date >= $4
      AND event_date <= $5
    ORDER BY event_date, event_time
  `;

  // Fetch AH events with EXACT buy_pct and sell_pct match
  const ahEventsQuery = `
    SELECT 
      event_date,
      event_time,
      event_type,
      stock_price,
      btc_price,
      ratio,
      baseline,
      'AH' as session
    FROM ${ahTableName}
    WHERE symbol = $1
      AND buy_pct = $2
      AND sell_pct = $3
      AND event_date >= $4
      AND event_date <= $5
    ORDER BY event_date, event_time
  `;

  const [rthResult, ahResult] = await Promise.all([
    pool.query(rthEventsQuery, [symbol, parseFloat(rthBuyPct), parseFloat(rthSellPct), startDate, endDate]),
    pool.query(ahEventsQuery, [symbol, parseFloat(ahBuyPct), parseFloat(ahSellPct), startDate, endDate])
  ]);

  // Combine and sort events chronologically
  const allEvents = [...rthResult.rows, ...ahResult.rows];
  allEvents.sort((a, b) => {
    const dateCompare = a.event_date.localeCompare(b.event_date);
    if (dateCompare !== 0) return dateCompare;
    return a.event_time.localeCompare(b.event_time);
  });

  if (allEvents.length === 0) {
    return {
      symbol,
      rthMethod,
      ahMethod,
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

  // Filter to alternating BUY/SELL pattern (matches Daily Curve)
  const filteredEvents = filterToAlternating(allEvents);

  // Simulate wallet (EXACT Daily Curve logic)
  let cash = 10000;
  let shares = 0;
  const trades = [];
  const dailyEquity = {};

  for (const event of filteredEvents) {
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
      const sharesToBuy = Math.floor(cash / price);
      if (sharesToBuy > 0) {
        shares = sharesToBuy;
        cash -= sharesToBuy * price;

        trades.push({
          date: event.event_date,
          time: event.event_time,
          type: 'BUY',
          price,
          shares,
          value: sharesToBuy * price
        });
      }
    } else if (event.event_type === 'SELL' && shares > 0) {
      // Sell all shares
      const proceeds = shares * price;
      cash += proceeds;

      trades.push({
        date: event.event_date,
        time: event.event_time,
        type: 'SELL',
        price,
        shares,
        value: proceeds
      });

      shares = 0;
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
    rthMethod,
    ahMethod,
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
      if (!stock.symbol || !stock.rthMethod || !stock.ahMethod) {
        return res.status(400).json({
          success: false,
          error: 'Each stock must have symbol, rthMethod, and ahMethod'
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
          rthMethod: stock.rthMethod,
            ahMethod: stock.ahMethod,
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
        console.log(`[Multi-Stock Daily Curve] ${stock.symbol} (RTH:${stock.rthMethod}, AH:${stock.ahMethod}) completed: ${result.summary.totalReturnPct.toFixed(2)}% return`);
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