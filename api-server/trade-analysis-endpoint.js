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
 * Trade Analysis Endpoint
 * 
 * Deep dive into trade statistics, win rates, and profit distribution.
 * 
 * Request body:
 * {
 *   symbol: string,           // e.g., "RIOT"
 *   startDate: string,        // e.g., "2024-10-01"
 *   endDate: string,          // e.g., "2024-10-29"
 *   method: string,           // e.g., "VWAP_RATIO"
 *   sessionType: string,      // "RTH" | "AH"
 *   buyPct: number,           // e.g., 1.0
 *   sellPct: number,          // e.g., 2.0
 *   initialCapital: number    // e.g., 10000
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   statistics: {
 *     total_trades: number,
 *     winning_trades: number,
 *     losing_trades: number,
 *     win_rate_pct: string,
 *     total_return_pct: string,
 *     avg_win_pct: string,
 *     avg_loss_pct: string,
 *     largest_win_pct: string,
 *     largest_loss_pct: string,
 *     profit_factor: string,
 *     avg_trade_duration_minutes: number,
 *     longest_winning_streak: number,
 *     longest_losing_streak: number
 *   },
 *   trades: [
 *     {
 *       trade_number: number,
 *       entry_date: string,
 *       entry_time: string,
 *       entry_price: string,
 *       exit_date: string,
 *       exit_time: string,
 *       exit_price: string,
 *       shares: number,
 *       profit_loss: string,
 *       profit_loss_pct: string,
 *       duration_minutes: number
 *     }
 *   ],
 *   profitDistribution: [
 *     { range: string, count: number }
 *   ],
 *   dailyPerformance: [
 *     { date: string, trades: number, profit_loss_pct: string }
 *   ]
 * }
 */
export async function handleTradeAnalysis(req, res) {
  console.log('📈 Trade Analysis endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();

  try {
    const {
      symbol,
      startDate,
      endDate,
      method,
      sessionType,
      buyPct,
      sellPct,
      initialCapital = 10000
    } = req.body;

    // Validate required parameters
    if (!symbol || !startDate || !endDate || !method || !sessionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    if (buyPct === undefined || sellPct === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: buyPct, sellPct'
      });
    }

    const session = sessionType.toLowerCase();
    const tableName = `trade_events_${session}_${method.toLowerCase()}`;

    console.log(`Analyzing trades for ${symbol} using ${method} in ${sessionType}`);

    // Get all events
    const eventsQuery = `
      SELECT 
        et_date,
        bar_time,
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
      return res.json({
        success: true,
        statistics: {
          total_trades: 0,
          winning_trades: 0,
          losing_trades: 0,
          win_rate_pct: '0.00',
          total_return_pct: '0.00',
          avg_win_pct: '0.00',
          avg_loss_pct: '0.00',
          largest_win_pct: '0.00',
          largest_loss_pct: '0.00',
          profit_factor: '0.00',
          avg_trade_duration_minutes: 0,
          longest_winning_streak: 0,
          longest_losing_streak: 0
        },
        trades: [],
        profitDistribution: [],
        dailyPerformance: []
      });
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

    // Simulate trading and track detailed trades
    let cash = initialCapital;
    let shares = 0;
    const trades = [];
    let entryPrice = 0;
    let entryDate = '';
    let entryTime = '';
    let entryShares = 0;

    const wins = [];
    const losses = [];
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLoseStreak = 0;
    let isWinStreak = false;

    const dailyProfits: { [key: string]: number } = {};

    for (const event of filteredEvents) {
      const price = parseFloat(event.stock_price);
      const eventDate = event.et_date;
      const eventTime = event.bar_time;

      if (event.event_type === 'BUY' && shares === 0 && cash > 0) {
        const sharesToBuy = Math.floor(cash / price);
        if (sharesToBuy > 0) {
          shares = sharesToBuy;
          cash -= shares * price;
          entryPrice = price;
          entryDate = eventDate;
          entryTime = eventTime;
          entryShares = shares;
        }
      } else if (event.event_type === 'SELL' && shares > 0) {
        const exitPrice = price;
        const saleProceeds = shares * exitPrice;
        const costBasis = entryShares * entryPrice;
        const profitLoss = saleProceeds - costBasis;
        const profitLossPct = (profitLoss / costBasis) * 100;

        // Calculate duration
        const entryDateTime = new Date(`${entryDate}T${entryTime}`);
        const exitDateTime = new Date(`${eventDate}T${eventTime}`);
        const durationMinutes = Math.round((exitDateTime.getTime() - entryDateTime.getTime()) / 60000);

        trades.push({
          trade_number: trades.length + 1,
          entry_date: entryDate,
          entry_time: entryTime,
          entry_price: entryPrice.toFixed(2),
          exit_date: eventDate,
          exit_time: eventTime,
          exit_price: exitPrice.toFixed(2),
          shares: entryShares,
          profit_loss: profitLoss.toFixed(2),
          profit_loss_pct: profitLossPct.toFixed(2),
          duration_minutes: durationMinutes
        });

        // Track wins/losses
        if (profitLoss > 0) {
          wins.push(profitLossPct);
          if (isWinStreak) {
            currentStreak++;
          } else {
            currentStreak = 1;
            isWinStreak = true;
          }
          longestWinStreak = Math.max(longestWinStreak, currentStreak);
        } else {
          losses.push(profitLossPct);
          if (!isWinStreak) {
            currentStreak++;
          } else {
            currentStreak = 1;
            isWinStreak = false;
          }
          longestLoseStreak = Math.max(longestLoseStreak, currentStreak);
        }

        // Track daily performance
        if (!dailyProfits[eventDate]) {
          dailyProfits[eventDate] = 0;
        }
        dailyProfits[eventDate] += profitLossPct;

        cash = saleProceeds;
        shares = 0;
      }
    }

    // Calculate statistics
    const totalTrades = trades.length;
    const winningTrades = wins.length;
    const losingTrades = losses.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const totalWins = wins.reduce((sum, w) => sum + w, 0);
    const totalLosses = Math.abs(losses.reduce((sum, l) => sum + l, 0));
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

    const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses) : 0;

    const avgDuration = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.duration_minutes, 0) / trades.length
      : 0;

    const finalEquity = cash + shares * (filteredEvents.length > 0 ? parseFloat(filteredEvents[filteredEvents.length - 1].stock_price) : 0);
    const totalReturn = ((finalEquity / initialCapital) - 1) * 100;

    // Create profit distribution
    const profitDistribution = [
      { range: '< -5%', count: 0 },
      { range: '-5% to -2%', count: 0 },
      { range: '-2% to 0%', count: 0 },
      { range: '0% to 2%', count: 0 },
      { range: '2% to 5%', count: 0 },
      { range: '> 5%', count: 0 }
    ];

    trades.forEach(trade => {
      const pct = parseFloat(trade.profit_loss_pct);
      if (pct < -5) profitDistribution[0].count++;
      else if (pct < -2) profitDistribution[1].count++;
      else if (pct < 0) profitDistribution[2].count++;
      else if (pct < 2) profitDistribution[3].count++;
      else if (pct < 5) profitDistribution[4].count++;
      else profitDistribution[5].count++;
    });

    // Create daily performance
    const dailyPerformance = Object.entries(dailyProfits).map(([date, profitPct]) => ({
      date,
      trades: trades.filter(t => t.exit_date === date).length,
      profit_loss_pct: profitPct.toFixed(2)
    })).sort((a, b) => a.date.localeCompare(b.date));

    console.log(`✅ Analyzed ${totalTrades} trades`);

    res.json({
      success: true,
      statistics: {
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        win_rate_pct: winRate.toFixed(2),
        total_return_pct: totalReturn.toFixed(2),
        avg_win_pct: avgWin.toFixed(2),
        avg_loss_pct: avgLoss.toFixed(2),
        largest_win_pct: largestWin.toFixed(2),
        largest_loss_pct: largestLoss.toFixed(2),
        profit_factor: profitFactor.toFixed(2),
        avg_trade_duration_minutes: Math.round(avgDuration),
        longest_winning_streak: longestWinStreak,
        longest_losing_streak: longestLoseStreak
      },
      trades,
      profitDistribution,
      dailyPerformance
    });

  } catch (error) {
    console.error('❌ Trade Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
}