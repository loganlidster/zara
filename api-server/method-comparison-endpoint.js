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

/**
 * Method Comparison Endpoint
 * 
 * Compares all 5 baseline methods side-by-side to find the best strategy.
 * 
 * Request body:
 * {
 *   symbols: string[],        // e.g., ["RIOT", "MARA", "HIVE"]
 *   startDate: string,        // e.g., "2024-10-01"
 *   endDate: string,          // e.g., "2024-10-29"
 *   sessionType: string,      // "RTH" | "AH"
 *   buyPct: number,           // e.g., 1.0
 *   sellPct: number,          // e.g., 2.0
 *   initialCapital: number    // e.g., 10000
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   comparison: [
 *     {
 *       symbol: string,
 *       method: string,
 *       total_events: number,
 *       total_trades: number,
 *       total_return: number,
 *       total_return_pct: string,
 *       win_rate_pct: string,
 *       avg_trade_return_pct: string,
 *       final_equity: string
 *     }
 *   ],
 *   summary: {
 *     best_method: string,
 *     best_method_return_pct: string,
 *     method_rankings: [
 *       { method: string, avg_return_pct: string, win_rate_pct: string }
 *     ]
 *   }
 * }
 */
export async function handleMethodComparison(req, res) {
  console.log('📊 Method Comparison endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();

  try {
    const {
      symbols,
      startDate,
      endDate,
      sessionType,
      buyPct,
      sellPct,
      initialCapital = 10000
    } = req.body;

    // Validate required parameters
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid symbols array'
      });
    }

    if (!startDate || !endDate || !sessionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate, endDate, sessionType'
      });
    }

    if (buyPct === undefined || sellPct === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: buyPct, sellPct'
      });
    }

    const methods = ['VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN', 'EQUAL_MEAN'];
    const session = sessionType.toLowerCase();

    console.log(`Comparing ${methods.length} methods for ${symbols.length} symbols`);

    const comparison = [];

    // Process each symbol and method
    for (const symbol of symbols) {
      for (const method of methods) {
        const tableName = `trade_events_${session}_${method.toLowerCase()}`;

        // Get all events for this symbol/method/thresholds
        const eventsQuery = `
          SELECT 
            et_date,
            event_type,
            stock_price,
            btc_price,
            ratio
          FROM ${tableName}
          WHERE symbol = $1
            AND et_date BETWEEN $2 AND $3
            AND buy_pct = $4
            AND sell_pct = $5
          ORDER BY bar_time ASC
        `;

        const eventsResult = await client.query(eventsQuery, [
          symbol,
          startDate,
          endDate,
          buyPct,
          sellPct
        ]);

        const events = eventsResult.rows;

        if (events.length === 0) {
          console.log(`No events found for ${symbol} ${method}`);
          continue;
        }

        // Filter to alternating BUY/SELL pattern
        const filteredEvents = [];
        let lastType = null;
        for (const event of events) {
          if (event.event_type !== lastType) {
            filteredEvents.push(event);
            lastType = event.event_type;
          }
        }

        // Simulate trading
        let cash = initialCapital;
        let shares = 0;
        let trades = 0;
        let winningTrades = 0;

        for (const event of filteredEvents) {
          const price = parseFloat(event.stock_price);

          if (event.event_type === 'BUY' && shares === 0 && cash > 0) {
            const sharesToBuy = Math.floor(cash / price);
            if (sharesToBuy > 0) {
              shares = sharesToBuy;
              cash -= shares * price;
              trades++;
            }
          } else if (event.event_type === 'SELL' && shares > 0) {
            const saleProceeds = shares * price;
            const profit = saleProceeds - (initialCapital - cash);
            cash = saleProceeds;
            shares = 0;
            
            if (profit > 0) winningTrades++;
          }
        }

        // Calculate final equity
        const lastPrice = filteredEvents.length > 0 ? parseFloat(filteredEvents[filteredEvents.length - 1].stock_price) : 0;
        const finalEquity = cash + shares * lastPrice;
        const totalReturn = (finalEquity / initialCapital) - 1;
        const winRate = trades > 0 ? (winningTrades / trades) * 100 : 0;
        const avgTradeReturn = trades > 0 ? (totalReturn / trades) * 100 : 0;

        comparison.push({
          symbol,
          method,
          total_events: events.length,
          total_trades: trades,
          total_return: totalReturn,
          total_return_pct: (totalReturn * 100).toFixed(2),
          win_rate_pct: winRate.toFixed(2),
          avg_trade_return_pct: avgTradeReturn.toFixed(2),
          final_equity: finalEquity.toFixed(2)
        });
      }
    }

    // Calculate summary statistics
    const methodStats = {};
    
    methods.forEach(method => {
      methodStats[method] = { returns: [], winRates: [] };
    });

    comparison.forEach(result => {
      methodStats[result.method].returns.push(result.total_return);
      methodStats[result.method].winRates.push(parseFloat(result.win_rate_pct));
    });

    // Calculate averages and rank methods
    const methodRankings = methods.map(method => {
      const stats = methodStats[method];
      const avgReturn = stats.returns.length > 0
        ? stats.returns.reduce((a, b) => a + b, 0) / stats.returns.length * 100
        : 0;
      const avgWinRate = stats.winRates.length > 0
        ? stats.winRates.reduce((a, b) => a + b, 0) / stats.winRates.length
        : 0;

      return {
        method,
        avg_return_pct: avgReturn.toFixed(2),
        win_rate_pct: avgWinRate.toFixed(2),
        score: avgReturn + avgWinRate // Combined score for ranking
      };
    }).sort((a, b) => b.score - a.score);

    const bestMethod = methodRankings[0];

    console.log(`✅ Compared ${comparison.length} method combinations`);

    res.json({
      success: true,
      comparison: comparison.sort((a, b) => {
        if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
        return b.total_return - a.total_return;
      }),
      summary: {
        best_method: bestMethod.method,
        best_method_return_pct: bestMethod.avg_return_pct,
        method_rankings: methodRankings.map(({ method, avg_return_pct, win_rate_pct }) => ({
          method,
          avg_return_pct,
          win_rate_pct
        }))
      }
    });

  } catch (error) {
    console.error('❌ Method Comparison error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}