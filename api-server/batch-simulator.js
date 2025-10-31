import { Client } from 'pg';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '34.41.97.179',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

// Generate all parameter combinations
export function generateCombinations(params) {
  const {
    symbols,
    methods,
    buyPctMin,
    buyPctMax,
    sellPctMin,
    sellPctMax,
    startDate,
    endDate,
    session,
    initialCapital = 10000,
    allowShorts = false,
    conservativePricing = true,
    slippage = 0
  } = params;

  const combinations = [];
  
  // Generate buy percentages (0.1 increments)
  const buyPcts = [];
  for (let pct = buyPctMin; pct <= buyPctMax; pct += 0.1) {
    buyPcts.push(Math.round(pct * 10) / 10);
  }
  
  // Generate sell percentages (0.1 increments)
  const sellPcts = [];
  for (let pct = sellPctMin; pct <= sellPctMax; pct += 0.1) {
    sellPcts.push(Math.round(pct * 10) / 10);
  }

  // Generate all combinations
  for (const symbol of symbols) {
    for (const method of methods) {
      for (const buyPct of buyPcts) {
        for (const sellPct of sellPcts) {
          combinations.push({
            symbol,
            method,
            buyPct,
            sellPct,
            startDate,
            endDate,
            session,
            initialCapital,
            allowShorts,
            conservativePricing,
            slippage
          });
        }
      }
    }
  }

  return combinations;
}

// Check cache for existing results
export async function checkCache(combination) {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT * FROM simulation_cache
      WHERE symbol = $1
        AND start_date = $2
        AND end_date = $3
        AND session = $4
        AND method = $5
        AND buy_pct = $6
        AND sell_pct = $7
        AND initial_capital = $8
        AND allow_shorts = $9
        AND conservative_pricing = $10
        AND slippage = $11
    `, [
      combination.symbol,
      combination.startDate,
      combination.endDate,
      combination.session,
      combination.method,
      combination.buyPct,
      combination.sellPct,
      combination.initialCapital,
      combination.allowShorts,
      combination.conservativePricing,
      combination.slippage
    ]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
    
  } finally {
    await client.end();
  }
}

// Save result to cache
export async function saveToCache(combination, results) {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    await client.query(`
      INSERT INTO simulation_cache (
        symbol, start_date, end_date, session, method, buy_pct, sell_pct,
        initial_capital, allow_shorts, conservative_pricing, slippage,
        total_return, final_equity, total_trades, winning_trades, losing_trades,
        win_rate, avg_win, avg_loss, max_drawdown, computation_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (symbol, start_date, end_date, session, method, buy_pct, sell_pct,
                   initial_capital, allow_shorts, conservative_pricing, slippage)
      DO UPDATE SET
        total_return = EXCLUDED.total_return,
        final_equity = EXCLUDED.final_equity,
        total_trades = EXCLUDED.total_trades,
        winning_trades = EXCLUDED.winning_trades,
        losing_trades = EXCLUDED.losing_trades,
        win_rate = EXCLUDED.win_rate,
        avg_win = EXCLUDED.avg_win,
        avg_loss = EXCLUDED.avg_loss,
        max_drawdown = EXCLUDED.max_drawdown,
        computation_time_ms = EXCLUDED.computation_time_ms,
        computed_at = NOW()
    `, [
      combination.symbol,
      combination.startDate,
      combination.endDate,
      combination.session,
      combination.method,
      combination.buyPct,
      combination.sellPct,
      combination.initialCapital,
      combination.allowShorts,
      combination.conservativePricing,
      combination.slippage,
      results.totalReturn,
      results.finalEquity,
      results.totalTrades,
      results.winningTrades,
      results.losingTrades,
      results.winRate,
      results.avgWin,
      results.avgLoss,
      results.maxDrawdown,
      results.computationTimeMs
    ]);
    
  } finally {
    await client.end();
  }
}

// Run single simulation (reuse existing logic)
export async function runSimulation(params) {
  const startTime = Date.now();
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const {
      symbol,
      startDate,
      endDate,
      session,
      method,
      buyPct,
      sellPct,
      initialCapital = 10000,
      allowShorts = false,
      conservativePricing = true,
      slippage = 0
    } = params;

    // Fetch data
    const query = `
      SELECT 
        s.et_date,
        s.et_time,
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

    const result = await client.query(query, [method, symbol, startDate, endDate, session]);

    if (result.rows.length === 0) {
      throw new Error('No data found');
    }

    // Run simulation
    let cash = initialCapital;
    let shares = 0;
    let position = 'FLAT';
    let trades = [];
    let equity = initialCapital;
    let maxEquity = initialCapital;
    let maxDrawdown = 0;

    for (const bar of result.rows) {
      const { stock_close, baseline } = bar;
      
      const buyThreshold = baseline * (1 + buyPct / 100);
      const sellThreshold = baseline * (1 - sellPct / 100);
      const currentRatio = bar.current_ratio;

      // Trading logic (simplified for batch)
      if (position === 'FLAT' && currentRatio > buyThreshold) {
        const sharesToBuy = Math.floor(cash / stock_close);
        if (sharesToBuy > 0) {
          let buyPrice = stock_close;
          if (conservativePricing) {
            buyPrice = buyPrice * (1 + slippage / 100);
            buyPrice = Math.ceil(buyPrice * 100) / 100;
          }
          const cost = sharesToBuy * buyPrice;
          if (cost <= cash) {
            shares = sharesToBuy;
            cash -= cost;
            position = 'LONG';
            trades.push({ type: 'BUY', price: buyPrice, value: cost });
          }
        }
      } else if (position === 'LONG' && currentRatio < sellThreshold) {
        let sellPrice = stock_close;
        if (conservativePricing) {
          sellPrice = sellPrice * (1 - slippage / 100);
          sellPrice = Math.floor(sellPrice * 100) / 100;
        }
        const proceeds = shares * sellPrice;
        trades.push({ type: 'SELL', price: sellPrice, value: proceeds });
        cash += proceeds;
        shares = 0;
        position = 'FLAT';
      }

      // Track equity and drawdown
      equity = cash + (shares * stock_close);
      if (equity > maxEquity) maxEquity = equity;
      const drawdown = ((maxEquity - equity) / maxEquity) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Close any open position
    if (shares !== 0) {
      const lastBar = result.rows[result.rows.length - 1];
      const closePrice = lastBar.stock_close;
      const proceeds = shares * closePrice;
      cash += proceeds;
      shares = 0;
    }

    // Calculate metrics
    const finalEquity = cash;
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
    const totalTrades = trades.filter(t => t.type === 'SELL').length;
    
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWin = 0;
    let totalLoss = 0;
    
    for (let i = 0; i < trades.length; i += 2) {
      if (i + 1 < trades.length) {
        const buyValue = trades[i].value;
        const sellValue = trades[i + 1].value;
        const profit = sellValue - buyValue;
        
        if (profit > 0) {
          winningTrades++;
          totalWin += profit;
        } else {
          losingTrades++;
          totalLoss += Math.abs(profit);
        }
      }
    }

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgWin = winningTrades > 0 ? totalWin / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;

    const computationTimeMs = Date.now() - startTime;

    return {
      totalReturn,
      finalEquity,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      maxDrawdown,
      computationTimeMs
    };

  } finally {
    await client.end();
  }
}