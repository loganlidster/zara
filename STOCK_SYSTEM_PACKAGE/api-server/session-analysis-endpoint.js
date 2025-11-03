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
 * Session Analysis Endpoint
 * 
 * Compares RTH (Regular Trading Hours) vs AH (After Hours) performance
 * to help optimize trading schedule.
 * 
 * Request body:
 * {
 *   symbols: string[],        // e.g., ["RIOT", "MARA", "HIVE"]
 *   startDate: string,        // e.g., "2024-10-01"
 *   endDate: string,          // e.g., "2024-10-29"
 *   method: string,           // e.g., "VWAP_RATIO"
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
 *       session: "RTH" | "AH",
 *       total_events: number,
 *       buy_events: number,
 *       sell_events: number,
 *       total_return: number,
 *       total_return_pct: string,
 *       win_rate_pct: string,
 *       avg_trade_return_pct: string,
 *       best_day_return_pct: string,
 *       worst_day_return_pct: string
 *     }
 *   ],
 *   summary: {
 *     rth_total_return_pct: string,
 *     ah_total_return_pct: string,
 *     rth_win_rate_pct: string,
 *     ah_win_rate_pct: string,
 *     recommendation: string
 *   }
 * }
 */
export async function handleSessionAnalysis(req, res) {
  console.log('🕐 Session Analysis endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();

  try {
    const {
      symbols,
      startDate,
      endDate,
      method,
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

    if (!startDate || !endDate || !method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: startDate, endDate, method'
      });
    }

    if (buyPct === undefined || sellPct === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: buyPct, sellPct'
      });
    }

    console.log(`Analyzing ${symbols.length} symbols for RTH vs AH performance`);

    const comparison = [];
    const sessions = ['RTH', 'AH'];

    // Process each symbol and session
    for (const symbol of symbols) {
      for (const session of sessions) {
        const tableName = `trade_events_${session.toLowerCase()}_${method.toLowerCase()}`;

        // Get all events for this symbol/session/thresholds
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
          console.log(`No events found for ${symbol} ${session}`);
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
        const dailyReturns = {};

        for (const event of filteredEvents) {
          const price = parseFloat(event.stock_price);
          const eventDate = event.et_date;

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
            
            // Track daily return
            if (!dailyReturns[eventDate]) {
              dailyReturns[eventDate] = 0;
            }
            dailyReturns[eventDate] += profit;
          }
        }

        // Calculate final equity
        const finalEquity = cash + shares * (filteredEvents.length > 0 ? parseFloat(filteredEvents[filteredEvents.length - 1].stock_price) : 0);
        const totalReturn = (finalEquity / initialCapital) - 1;
        const winRate = trades > 0 ? (winningTrades / trades) * 100 : 0;
        const avgTradeReturn = trades > 0 ? (totalReturn / trades) * 100 : 0;

        // Calculate best/worst day returns
        const dailyReturnValues = Object.values(dailyReturns);
        const bestDayReturn = dailyReturnValues.length > 0 ? Math.max(...dailyReturnValues) / initialCapital * 100 : 0;
        const worstDayReturn = dailyReturnValues.length > 0 ? Math.min(...dailyReturnValues) / initialCapital * 100 : 0;

        comparison.push({
          symbol,
          session,
          total_events: events.length,
          buy_events: filteredEvents.filter(e => e.event_type === 'BUY').length,
          sell_events: filteredEvents.filter(e => e.event_type === 'SELL').length,
          total_return: totalReturn,
          total_return_pct: (totalReturn * 100).toFixed(2),
          win_rate_pct: winRate.toFixed(2),
          avg_trade_return_pct: avgTradeReturn.toFixed(2),
          best_day_return_pct: bestDayReturn.toFixed(2),
          worst_day_return_pct: worstDayReturn.toFixed(2),
          total_trades: trades
        });
      }
    }

    // Calculate summary statistics
    const rthResults = comparison.filter(c => c.session === 'RTH');
    const ahResults = comparison.filter(c => c.session === 'AH');

    const rthAvgReturn = rthResults.length > 0
      ? rthResults.reduce((sum, r) => sum + r.total_return, 0) / rthResults.length * 100
      : 0;
    
    const ahAvgReturn = ahResults.length > 0
      ? ahResults.reduce((sum, r) => sum + r.total_return, 0) / ahResults.length * 100
      : 0;

    const rthAvgWinRate = rthResults.length > 0
      ? rthResults.reduce((sum, r) => sum + parseFloat(r.win_rate_pct), 0) / rthResults.length
      : 0;

    const ahAvgWinRate = ahResults.length > 0
      ? ahResults.reduce((sum, r) => sum + parseFloat(r.win_rate_pct), 0) / ahResults.length
      : 0;

    // Generate recommendation
    let recommendation = '';
    if (rthAvgReturn > ahAvgReturn && rthAvgWinRate > ahAvgWinRate) {
      recommendation = 'RTH (Regular Trading Hours) shows better performance in both returns and win rate. Recommended for trading.';
    } else if (ahAvgReturn > rthAvgReturn && ahAvgWinRate > rthAvgWinRate) {
      recommendation = 'AH (After Hours) shows better performance in both returns and win rate. Consider after-hours trading.';
    } else if (rthAvgReturn > ahAvgReturn) {
      recommendation = 'RTH has higher returns but AH has better win rate. RTH recommended for higher profits.';
    } else if (ahAvgReturn > rthAvgReturn) {
      recommendation = 'AH has higher returns but RTH has better win rate. AH recommended for higher profits.';
    } else {
      recommendation = 'Both sessions show similar performance. Consider trading in both RTH and AH.';
    }

    console.log(`✅ Analyzed ${comparison.length} session combinations`);

    res.json({
      success: true,
      comparison: comparison.sort((a, b) => {
        if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
        return a.session.localeCompare(b.session);
      }),
      summary: {
        rth_total_return_pct: rthAvgReturn.toFixed(2),
        ah_total_return_pct: ahAvgReturn.toFixed(2),
        rth_win_rate_pct: rthAvgWinRate.toFixed(2),
        ah_win_rate_pct: ahAvgWinRate.toFixed(2),
        recommendation
      }
    });

  } catch (error) {
    console.error('❌ Session Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}