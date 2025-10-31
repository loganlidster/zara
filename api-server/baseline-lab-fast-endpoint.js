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

/**
 * Baseline Lab — FAST Report
 * 
 * Finds the best performing (method, buy%, sell%) combination for EACH trading day.
 * Also calculates consistency metrics showing which methods win most often.
 * 
 * Request body:
 * {
 *   symbols: string[],        // e.g., ["RIOT", "MARA", "HIVE"]
 *   startDate: string,        // e.g., "2024-10-01"
 *   endDate: string,          // e.g., "2024-10-29"
 *   methods: string[],        // e.g., ["VWAP_RATIO", "WINSORIZED"]
 *   sessionType: string,      // "RTH" | "AH" | "ALL"
 *   buyPcts: number[],        // e.g., [0.5, 1.0, 1.5, 2.0]
 *   sellPcts: number[],       // e.g., [1.0, 1.5, 2.0, 2.5]
 *   initialCapital: number    // e.g., 10000
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   dailyWinners: [
 *     {
 *       symbol: string,
 *       et_date: string,
 *       method: string,
 *       buy_pct: number,
 *       sell_pct: number,
 *       day_return: number,
 *       day_return_pct: number,
 *       n_trades: number,
 *       final_equity: number
 *     }
 *   ],
 *   methodConsistency: [
 *     {
 *       symbol: string,
 *       method: string,
 *       wins: number,
 *       total_days: number,
 *       win_rate_pct: number,
 *       avg_return_pct: number
 *     }
 *   ]
 * }
 */
export async function handleBaselineLabFast(req, res) {
  console.log('🔬 Baseline Lab FAST endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();

  try {
    const {
      symbols,
      startDate,
      endDate,
      methods,
      sessionType,
      buyPcts,
      sellPcts,
      initialCapital = 10000
    } = req.body;

    // Validate required parameters
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid symbols array'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate, endDate'
      });
    }

    if (!methods || !Array.isArray(methods) || methods.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid methods array'
      });
    }

    if (!buyPcts || !Array.isArray(buyPcts) || buyPcts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid buyPcts array'
      });
    }

    if (!sellPcts || !Array.isArray(sellPcts) || sellPcts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid sellPcts array'
      });
    }

    const session = sessionType || 'RTH';
    console.log(`Processing ${symbols.length} symbols, ${methods.length} methods, ${buyPcts.length}×${sellPcts.length} threshold combinations`);

    // Results storage
    const allDailyWinners = [];
    const methodWinCounts = {}; // Track wins per symbol per method

    // Process each symbol
    for (const symbol of symbols) {
      console.log(`\n📊 Processing symbol: ${symbol}`);
      
      // Initialize win tracking for this symbol
      if (!methodWinCounts[symbol]) {
        methodWinCounts[symbol] = {};
        methods.forEach(m => {
          methodWinCounts[symbol][m] = { wins: 0, totalDays: 0, returns: [] };
        });
      }

      // Get all trading days in range for this symbol
      const daysQuery = `
        SELECT DISTINCT trading_day
        FROM baseline_daily
        WHERE symbol = $1
          AND trading_day BETWEEN $2 AND $3
          AND session = $4
        ORDER BY trading_day ASC
      `;
      
      const daysResult = await client.query(daysQuery, [symbol, startDate, endDate, session]);
      const tradingDays = daysResult.rows.map(r => r.trading_day);
      
      console.log(`Found ${tradingDays.length} trading days for ${symbol}`);

      if (tradingDays.length === 0) {
        console.log(`No trading days found for ${symbol}, skipping`);
        continue;
      }

      // For each trading day, find the best combination
      for (const currentDay of tradingDays) {
        let bestCombo = null;
        let bestReturn = -Infinity;

        // Get minute data for this day
        const minuteQuery = `
          SELECT 
            ms.bar_time,
            ms.close as stock_price,
            mb.close as btc_price
          FROM minute_stock ms
          JOIN minute_btc mb ON ms.bar_time = mb.bar_time
          WHERE ms.symbol = $1
            AND ms.et_date = $2
            AND ms.session = $3
          ORDER BY ms.bar_time ASC
        `;

        const minuteResult = await client.query(minuteQuery, [symbol, currentDay, session]);
        const minuteBars = minuteResult.rows;

        if (minuteBars.length === 0) {
          console.log(`No minute data for ${symbol} on ${currentDay}, skipping`);
          continue;
        }

        // Calculate ratios
        const ratios = minuteBars.map(bar => bar.btc_price / bar.stock_price);
        const prices = minuteBars.map(bar => bar.stock_price);

        // Test all method × threshold combinations
        for (const method of methods) {
          // Get baseline for this day (from previous trading day)
          const baselineQuery = `
            SELECT baseline
            FROM baseline_daily
            WHERE symbol = $1
              AND trading_day = $2
              AND session = $3
              AND method = $4
          `;

          const baselineResult = await client.query(baselineQuery, [symbol, currentDay, session, method]);
          
          if (baselineResult.rows.length === 0) {
            continue; // No baseline available
          }

          const baseline = parseFloat(baselineResult.rows[0].baseline);

          // Test all threshold combinations
          for (const buyPct of buyPcts) {
            for (const sellPct of sellPcts) {
              // Simulate trading for this day
              const buyThreshold = baseline * (1 + buyPct / 100);
              const sellThreshold = baseline * (1 - sellPct / 100);

              let cash = initialCapital;
              let shares = 0;
              let nTrades = 0;

              for (let i = 0; i < ratios.length; i++) {
                const ratio = ratios[i];
                const price = prices[i];

                // Buy signal
                if (ratio >= buyThreshold && shares === 0 && cash > 0) {
                  const sharesToBuy = Math.floor(cash / price);
                  if (sharesToBuy > 0) {
                    shares = sharesToBuy;
                    cash -= shares * price;
                    nTrades++;
                  }
                }
                // Sell signal
                else if (ratio <= sellThreshold && shares > 0) {
                  cash += shares * price;
                  shares = 0;
                  nTrades++;
                }
              }

              // Calculate final equity (close any remaining position)
              const finalEquity = cash + shares * prices[prices.length - 1];
              const dayReturn = (finalEquity / initialCapital) - 1;

              // Track if this is the best combination for this day
              if (dayReturn > bestReturn) {
                bestReturn = dayReturn;
                bestCombo = {
                  symbol,
                  et_date: currentDay,
                  method,
                  buy_pct: buyPct,
                  sell_pct: sellPct,
                  day_return: dayReturn,
                  day_return_pct: (dayReturn * 100).toFixed(2),
                  n_trades: nTrades,
                  final_equity: finalEquity.toFixed(2)
                };
              }
            }
          }
        }

        // Store the best combination for this day
        if (bestCombo) {
          allDailyWinners.push(bestCombo);
          
          // Track method wins
          methodWinCounts[symbol][bestCombo.method].wins++;
          methodWinCounts[symbol][bestCombo.method].returns.push(bestCombo.day_return);
        }

        // Update total days for all methods
        methods.forEach(m => {
          methodWinCounts[symbol][m].totalDays++;
        });
      }
    }

    // Calculate method consistency metrics
    const methodConsistency = [];
    for (const symbol of symbols) {
      if (!methodWinCounts[symbol]) continue;

      for (const method of methods) {
        const stats = methodWinCounts[symbol][method];
        if (stats.totalDays > 0) {
          const avgReturn = stats.returns.length > 0
            ? stats.returns.reduce((a, b) => a + b, 0) / stats.returns.length
            : 0;

          methodConsistency.push({
            symbol,
            method,
            wins: stats.wins,
            total_days: stats.totalDays,
            win_rate_pct: ((stats.wins / stats.totalDays) * 100).toFixed(2),
            avg_return_pct: (avgReturn * 100).toFixed(2)
          });
        }
      }
    }

    console.log(`\n✅ Processed ${allDailyWinners.length} daily winners`);
    console.log(`✅ Generated ${methodConsistency.length} consistency metrics`);

    res.json({
      success: true,
      dailyWinners: allDailyWinners,
      methodConsistency: methodConsistency.sort((a, b) => {
        if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
        return parseFloat(b.win_rate_pct) - parseFloat(a.win_rate_pct);
      })
    });

  } catch (error) {
    console.error('❌ Baseline Lab FAST error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}