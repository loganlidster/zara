import pool from './db.js';

/**
 * Real vs Projected Comparison Endpoint
 * 
 * Compares simulated (projected) trading results against actual Alpaca execution.
 * Calculates slippage, identifies missed trades, and provides detailed analysis.
 */

let livePool = null;
let alpacaClient = null;

// Lazy load dependencies
async function getLivePool() {
  if (!livePool) {
    const liveDbModule = await import('./live-db.js');
    livePool = liveDbModule.default;
  }
  return livePool;
}

async function getAlpacaClient() {
  if (!alpacaClient) {
    const alpacaModule = await import('./alpaca-client.js');
    alpacaClient = alpacaModule;
  }
  return alpacaClient;
}

// Method name mapping
const METHOD_MAP = {
  'MEDIAN': 'WEIGHTED_MEDIAN',
  'EQUAL_MEAN': 'EQUAL_MEAN',
  'VWAP_RATIO': 'VWAP_RATIO',
  'VOL_WEIGHTED': 'VOL_WEIGHTED',
  'WINSORIZED': 'WINSORIZED'
};

// Helper functions for price adjustments
function applySlippage(price, type, slippagePct) {
  if (slippagePct === 0) return price;
  const slippage = price * (slippagePct / 100);
  return type === 'BUY' ? price + slippage : price - slippage;
}

function applyConservativeRounding(price, type) {
  return type === 'BUY' ? Math.ceil(price * 100) / 100 : Math.floor(price * 100) / 100;
}

// Simulate trading for a single stock (projected)
async function simulateStock(params) {
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

  const tableName = `trade_events_all_${method.toLowerCase()}`;

  // Fetch events
  const eventsQuery = `
    SELECT 
      event_id,
      symbol,
      event_time,
      event_date,
      session,
      event_type,
      stock_price,
      btc_price,
      ratio,
      baseline,
      buy_threshold_pct,
      sell_threshold_pct
    FROM ${tableName}
    WHERE symbol = $1
      AND event_date >= $2
      AND event_date <= $3
    ORDER BY event_time ASC
  `;

  const eventsResult = await pool.query(eventsQuery, [symbol, startDate, endDate]);
  const events = eventsResult.rows;

  if (events.length === 0) {
    return { symbol, method, trades: [], equity: 10000 };
  }

  // Filter events by thresholds
  const filteredEvents = events.filter(event => {
    const isRTH = event.session === 'RTH';
    const buyThreshold = isRTH ? rthBuyPct : ahBuyPct;
    const sellThreshold = isRTH ? rthSellPct : ahSellPct;

    if (event.event_type === 'BUY') {
      return event.buy_threshold_pct >= buyThreshold;
    } else {
      return event.sell_threshold_pct >= sellThreshold;
    }
  });

  // Simulate wallet
  let cash = 10000;
  let shares = 0;
  let lastAction = null;
  const trades = [];

  for (const event of filteredEvents) {
    if (lastAction === event.event_type) continue;

    let price = parseFloat(event.stock_price);

    if (slippagePct > 0) {
      price = applySlippage(price, event.event_type, slippagePct);
    }

    if (conservativeRounding) {
      price = applyConservativeRounding(price, event.event_type);
    }

    if (event.event_type === 'BUY' && shares === 0) {
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
      const proceeds = shares * price;
      cash += proceeds;
      
      trades.push({
        date: event.event_date,
        time: event.event_time,
        type: 'SELL',
        price,
        shares,
        value: proceeds,
        cash,
        equity: cash
      });

      shares = 0;
      lastAction = 'SELL';
    }
  }

  const finalEquity = cash + (shares * (filteredEvents.length > 0 ? parseFloat(filteredEvents[filteredEvents.length - 1].stock_price) : 0));

  return {
    symbol,
    method,
    trades,
    finalEquity,
    totalReturn: finalEquity - 10000,
    totalReturnPct: ((finalEquity - 10000) / 10000) * 100
  };
}

// Main handler
async function handleRealVsProjected(req, res) {
  try {
    const {
      wallet_id,
      startDate,
      endDate,
      slippagePct = 0,
      conservativeRounding = true
    } = req.body;

    if (!wallet_id || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'wallet_id, startDate, and endDate are required'
      });
    }

    console.log(`[Real vs Projected] Processing wallet ${wallet_id} from ${startDate} to ${endDate}`);

    const liveDb = await getLivePool();
    const alpaca = await getAlpacaClient();

    // Step 1: Load wallet settings from live DB
    const walletQuery = `
      SELECT wallet_id, name, env, enabled
      FROM public.wallets
      WHERE wallet_id = $1
    `;
    const walletResult = await liveDb.query(walletQuery, [wallet_id]);

    if (walletResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const wallet = walletResult.rows[0];

    // Step 2: Load stock settings
    const stocksQuery = `
      SELECT 
        symbol,
        method_rth,
        method_ah,
        buy_pct_rth,
        sell_pct_rth,
        buy_pct_ah,
        sell_pct_ah,
        enabled
      FROM public.wallet_symbols
      WHERE wallet_id = $1 AND enabled = true
    `;
    const stocksResult = await liveDb.query(stocksQuery, [wallet_id]);
    const stocks = stocksResult.rows;

    console.log(`[Real vs Projected] Found ${stocks.length} enabled stocks`);

    // Step 3: Run simulations for each stock (PROJECTED)
    const projectedResults = await Promise.all(
      stocks.map(stock => {
        // For now, use RTH method for ALL session
        // TODO: Handle session-specific methods
        const method = METHOD_MAP[stock.method_rth] || stock.method_rth;
        
        return simulateStock({
          symbol: stock.symbol,
          method,
          startDate,
          endDate,
          rthBuyPct: parseFloat(stock.buy_pct_rth),
          rthSellPct: parseFloat(stock.sell_pct_rth),
          ahBuyPct: parseFloat(stock.buy_pct_ah),
          ahSellPct: parseFloat(stock.sell_pct_ah),
          slippagePct,
          conservativeRounding
        });
      })
    );

    // Step 4: Fetch actual orders from Alpaca
    console.log('[Real vs Projected] Fetching actual orders from Alpaca');
    
    const alpacaOrders = await alpaca.getOrders({
      after: startDate,
      until: endDate,
      status: 'all',
      limit: 500
    });

    // Filter orders by wallet's symbols
    const walletSymbols = stocks.map(s => s.symbol);
    const relevantOrders = alpacaOrders.filter(order => 
      walletSymbols.includes(order.symbol)
    );

    console.log(`[Real vs Projected] Found ${relevantOrders.length} relevant Alpaca orders`);

    // Step 5: Process actual orders into trades
    const actualTrades = relevantOrders
      .filter(order => order.status === 'filled' && order.filled_avg_price)
      .map(order => ({
        symbol: order.symbol,
        date: order.filled_at ? order.filled_at.split('T')[0] : order.submitted_at.split('T')[0],
        time: order.filled_at ? order.filled_at.split('T')[1].split('.')[0] : order.submitted_at.split('T')[1].split('.')[0],
        type: order.side.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
        price: parseFloat(order.filled_avg_price),
        shares: parseInt(order.filled_qty),
        alpaca_order_id: order.id,
        status: order.status
      }))
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB;
      });

    // Step 6: Calculate actual equity curve
    let actualCash = 10000;
    let actualPositions = {};
    const actualEquityCurve = [];

    for (const trade of actualTrades) {
      if (trade.type === 'BUY') {
        const cost = trade.price * trade.shares;
        actualCash -= cost;
        actualPositions[trade.symbol] = (actualPositions[trade.symbol] || 0) + trade.shares;
      } else {
        const proceeds = trade.price * trade.shares;
        actualCash += proceeds;
        actualPositions[trade.symbol] = (actualPositions[trade.symbol] || 0) - trade.shares;
      }

      // Calculate equity (simplified - uses last trade price)
      let positionValue = 0;
      for (const [sym, qty] of Object.entries(actualPositions)) {
        if (qty > 0) {
          positionValue += qty * trade.price; // Simplified
        }
      }

      actualEquityCurve.push({
        date: trade.date,
        time: trade.time,
        equity: actualCash + positionValue
      });
    }

    const actualFinalEquity = actualEquityCurve.length > 0 
      ? actualEquityCurve[actualEquityCurve.length - 1].equity 
      : 10000;

    // Step 7: Calculate projected totals
    const projectedFinalEquity = projectedResults.reduce((sum, r) => sum + r.finalEquity, 0);
    const projectedTotalReturn = projectedFinalEquity - (10000 * stocks.length);
    const projectedTotalReturnPct = (projectedTotalReturn / (10000 * stocks.length)) * 100;

    const actualTotalReturn = actualFinalEquity - 10000;
    const actualTotalReturnPct = (actualTotalReturn / 10000) * 100;

    // Step 8: Match trades and calculate slippage
    const tradeComparisons = [];
    
    for (const projectedStock of projectedResults) {
      for (const projTrade of projectedStock.trades) {
        // Find matching actual trade (same symbol, type, similar time)
        const matchingActual = actualTrades.find(at => 
          at.symbol === projectedStock.symbol &&
          at.type === projTrade.type &&
          at.date === projTrade.date &&
          Math.abs(new Date(`${at.date}T${at.time}`) - new Date(`${projTrade.date}T${projTrade.time}`)) < 3600000 // Within 1 hour
        );

        if (matchingActual) {
          const slippage = matchingActual.price - projTrade.price;
          const slippagePct = (slippage / projTrade.price) * 100;

          tradeComparisons.push({
            symbol: projectedStock.symbol,
            date: projTrade.date,
            time: projTrade.time,
            type: projTrade.type,
            projected_price: projTrade.price,
            actual_price: matchingActual.price,
            slippage,
            slippage_pct: slippagePct,
            projected_shares: projTrade.shares,
            actual_shares: matchingActual.shares,
            status: 'matched'
          });
        } else {
          tradeComparisons.push({
            symbol: projectedStock.symbol,
            date: projTrade.date,
            time: projTrade.time,
            type: projTrade.type,
            projected_price: projTrade.price,
            actual_price: null,
            slippage: null,
            slippage_pct: null,
            projected_shares: projTrade.shares,
            actual_shares: null,
            status: 'not_executed'
          });
        }
      }
    }

    // Calculate average slippage
    const matchedTrades = tradeComparisons.filter(t => t.status === 'matched');
    const avgSlippage = matchedTrades.length > 0
      ? matchedTrades.reduce((sum, t) => sum + t.slippage, 0) / matchedTrades.length
      : 0;
    const avgSlippagePct = matchedTrades.length > 0
      ? matchedTrades.reduce((sum, t) => sum + t.slippage_pct, 0) / matchedTrades.length
      : 0;

    // Response
    res.json({
      success: true,
      wallet: {
        wallet_id: wallet.wallet_id,
        name: wallet.name,
        env: wallet.env,
        stock_count: stocks.length
      },
      projected: {
        totalReturn: projectedTotalReturn,
        totalReturnPct: projectedTotalReturnPct,
        finalEquity: projectedFinalEquity,
        totalTrades: projectedResults.reduce((sum, r) => sum + r.trades.length, 0),
        byStock: projectedResults.map(r => ({
          symbol: r.symbol,
          method: r.method,
          finalEquity: r.finalEquity,
          totalReturn: r.totalReturn,
          totalReturnPct: r.totalReturnPct,
          trades: r.trades.length
        }))
      },
      actual: {
        totalReturn: actualTotalReturn,
        totalReturnPct: actualTotalReturnPct,
        finalEquity: actualFinalEquity,
        totalTrades: actualTrades.length,
        trades: actualTrades
      },
      comparison: {
        returnDifference: actualTotalReturn - projectedTotalReturn,
        returnDifferencePct: actualTotalReturnPct - projectedTotalReturnPct,
        tradesDifference: actualTrades.length - projectedResults.reduce((sum, r) => sum + r.trades.length, 0),
        avgSlippage,
        avgSlippagePct,
        matchedTrades: matchedTrades.length,
        missedTrades: tradeComparisons.filter(t => t.status === 'not_executed').length
      },
      tradeComparisons: tradeComparisons.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB;
      })
    });

  } catch (error) {
    console.error('[Real vs Projected] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default handleRealVsProjected;