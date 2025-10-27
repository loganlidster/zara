/**
 * Flexible Query Endpoints
 * 
 * These endpoints leverage the power of event-based state changes to provide
 * ultimate flexibility in querying and analyzing trading data.
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/flexible/custom-window
 * 
 * Query events within specific time windows across multiple days
 * Example: Analyze only 11am-2pm trading every day
 */
router.get('/custom-window', async (req, res) => {
  try {
    const { 
      symbol, method, session, buyPct, sellPct,
      startDate, endDate,
      startTime, endTime
    } = req.query;

    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate', 'startTime', 'endTime']
      });
    }

    const query = `
      SELECT 
        event_timestamp,
        event_type,
        stock_price,
        btc_price,
        ratio,
        shares,
        transaction_value,
        cash_balance,
        shares_held,
        total_value
      FROM trade_events
      WHERE symbol = $1
        AND method = $2
        AND session = $3
        AND buy_pct = $4
        AND sell_pct = $5
        AND event_timestamp::date BETWEEN $6 AND $7
        AND event_timestamp::time BETWEEN $8 AND $9
      ORDER BY event_timestamp
    `;

    const result = await req.db.query(query, [
      symbol, method, session,
      parseFloat(buyPct), parseFloat(sellPct),
      startDate, endDate,
      startTime, endTime
    ]);

    // Calculate ROI for this time window
    let startValue = 10000;
    let endValue = 10000;
    
    if (result.rows.length > 0) {
      const firstEvent = result.rows[0];
      const lastEvent = result.rows[result.rows.length - 1];
      
      startValue = firstEvent.total_value - firstEvent.transaction_value;
      endValue = lastEvent.total_value;
    }

    const roi = ((endValue - startValue) / startValue) * 100;

    res.json({
      success: true,
      timeWindow: { startTime, endTime },
      dateRange: { startDate, endDate },
      eventCount: result.rows.length,
      startValue,
      endValue,
      roiPct: roi,
      events: result.rows
    });

  } catch (error) {
    console.error('Error in custom window query:', error);
    res.status(500).json({
      error: 'Failed to query custom window',
      message: error.message
    });
  }
});

/**
 * GET /api/flexible/btc-impact
 * 
 * Analyze how BTC price affects trading decisions
 */
router.get('/btc-impact', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;

    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    const query = `
      WITH price_buckets AS (
        SELECT 
          CASE 
            WHEN btc_price < 40000 THEN 'Low (<$40k)'
            WHEN btc_price < 50000 THEN 'Medium ($40-50k)'
            WHEN btc_price < 60000 THEN 'High ($50-60k)'
            ELSE 'Very High (>$60k)'
          END as btc_range,
          event_type,
          COUNT(*) as event_count,
          AVG(ratio) as avg_ratio,
          AVG(stock_price) as avg_stock_price,
          AVG(btc_price) as avg_btc_price
        FROM trade_events
        WHERE symbol = $1
          AND method = $2
          AND session = $3
          AND buy_pct = $4
          AND sell_pct = $5
          AND event_timestamp::date BETWEEN $6 AND $7
        GROUP BY btc_range, event_type
      )
      SELECT * FROM price_buckets
      ORDER BY 
        CASE btc_range
          WHEN 'Low (<$40k)' THEN 1
          WHEN 'Medium ($40-50k)' THEN 2
          WHEN 'High ($50-60k)' THEN 3
          ELSE 4
        END,
        event_type
    `;

    const result = await req.db.query(query, [
      symbol, method, session,
      parseFloat(buyPct), parseFloat(sellPct),
      startDate, endDate
    ]);

    res.json({
      success: true,
      symbol,
      method,
      session,
      dateRange: { startDate, endDate },
      analysis: result.rows
    });

  } catch (error) {
    console.error('Error in BTC impact analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze BTC impact',
      message: error.message
    });
  }
});

/**
 * GET /api/flexible/intraday-patterns
 * 
 * Analyze trading patterns by hour of day
 */
router.get('/intraday-patterns', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;

    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    const query = `
      SELECT 
        EXTRACT(HOUR FROM event_timestamp) as hour,
        event_type,
        COUNT(*) as event_count,
        AVG(stock_price) as avg_stock_price,
        AVG(btc_price) as avg_btc_price,
        AVG(ratio) as avg_ratio
      FROM trade_events
      WHERE symbol = $1
        AND method = $2
        AND session = $3
        AND buy_pct = $4
        AND sell_pct = $5
        AND event_timestamp::date BETWEEN $6 AND $7
      GROUP BY hour, event_type
      ORDER BY hour, event_type
    `;

    const result = await req.db.query(query, [
      symbol, method, session,
      parseFloat(buyPct), parseFloat(sellPct),
      startDate, endDate
    ]);

    res.json({
      success: true,
      symbol,
      method,
      session,
      dateRange: { startDate, endDate },
      patterns: result.rows
    });

  } catch (error) {
    console.error('Error in intraday patterns analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze intraday patterns',
      message: error.message
    });
  }
});

/**
 * GET /api/flexible/holding-periods
 * 
 * Analyze how long positions are typically held
 */
router.get('/holding-periods', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;

    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    const query = `
      WITH buy_sell_pairs AS (
        SELECT 
          b.event_timestamp as buy_time,
          s.event_timestamp as sell_time,
          EXTRACT(EPOCH FROM (s.event_timestamp - b.event_timestamp))/3600 as hours_held,
          s.total_value - b.total_value as profit,
          b.stock_price as buy_price,
          s.stock_price as sell_price,
          b.btc_price as buy_btc_price,
          s.btc_price as sell_btc_price
        FROM trade_events b
        JOIN LATERAL (
          SELECT * FROM trade_events
          WHERE symbol = b.symbol
            AND method = b.method
            AND session = b.session
            AND buy_pct = b.buy_pct
            AND sell_pct = b.sell_pct
            AND event_type = 'SELL'
            AND event_timestamp > b.event_timestamp
          ORDER BY event_timestamp
          LIMIT 1
        ) s ON true
        WHERE b.event_type = 'BUY'
          AND b.symbol = $1
          AND b.method = $2
          AND b.session = $3
          AND b.buy_pct = $4
          AND b.sell_pct = $5
          AND b.event_timestamp::date BETWEEN $6 AND $7
      )
      SELECT 
        COUNT(*) as total_trades,
        AVG(hours_held) as avg_hours_held,
        MIN(hours_held) as min_hours_held,
        MAX(hours_held) as max_hours_held,
        STDDEV(hours_held) as stddev_hours_held,
        AVG(profit) as avg_profit_per_trade,
        SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN profit <= 0 THEN 1 ELSE 0 END) as losing_trades,
        AVG(CASE WHEN profit > 0 THEN profit ELSE NULL END) as avg_winning_profit,
        AVG(CASE WHEN profit <= 0 THEN profit ELSE NULL END) as avg_losing_profit
      FROM buy_sell_pairs
    `;

    const result = await req.db.query(query, [
      symbol, method, session,
      parseFloat(buyPct), parseFloat(sellPct),
      startDate, endDate
    ]);

    const stats = result.rows[0];
    const winRate = stats.total_trades > 0 
      ? (stats.winning_trades / stats.total_trades * 100) 
      : 0;

    res.json({
      success: true,
      symbol,
      method,
      session,
      dateRange: { startDate, endDate },
      statistics: {
        totalTrades: parseInt(stats.total_trades),
        avgHoursHeld: parseFloat(stats.avg_hours_held),
        minHoursHeld: parseFloat(stats.min_hours_held),
        maxHoursHeld: parseFloat(stats.max_hours_held),
        stddevHoursHeld: parseFloat(stats.stddev_hours_held),
        avgProfitPerTrade: parseFloat(stats.avg_profit_per_trade),
        winningTrades: parseInt(stats.winning_trades),
        losingTrades: parseInt(stats.losing_trades),
        winRate: winRate,
        avgWinningProfit: parseFloat(stats.avg_winning_profit),
        avgLosingProfit: parseFloat(stats.avg_losing_profit)
      }
    });

  } catch (error) {
    console.error('Error in holding periods analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze holding periods',
      message: error.message
    });
  }
});

/**
 * GET /api/flexible/portfolio-at-time
 * 
 * Get portfolio state at a specific moment in time
 */
router.get('/portfolio-at-time', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct, timestamp } = req.query;

    if (!symbol || !method || !session || !buyPct || !sellPct || !timestamp) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'timestamp']
      });
    }

    const query = `
      SELECT 
        event_timestamp,
        event_type,
        stock_price,
        btc_price,
        ratio,
        cash_balance,
        shares_held,
        position_value,
        total_value
      FROM trade_events
      WHERE symbol = $1
        AND method = $2
        AND session = $3
        AND buy_pct = $4
        AND sell_pct = $5
        AND event_timestamp <= $6
      ORDER BY event_timestamp DESC
      LIMIT 1
    `;

    const result = await req.db.query(query, [
      symbol, method, session,
      parseFloat(buyPct), parseFloat(sellPct),
      timestamp
    ]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        timestamp,
        portfolioState: {
          position: 'CASH',
          cashBalance: 10000,
          sharesHeld: 0,
          positionValue: 0,
          totalValue: 10000,
          message: 'No events before this timestamp - starting state'
        }
      });
    }

    const state = result.rows[0];

    res.json({
      success: true,
      timestamp,
      lastEventTimestamp: state.event_timestamp,
      portfolioState: {
        position: state.shares_held > 0 ? 'SHARES' : 'CASH',
        lastEventType: state.event_type,
        stockPrice: parseFloat(state.stock_price),
        btcPrice: parseFloat(state.btc_price),
        ratio: parseFloat(state.ratio),
        cashBalance: parseFloat(state.cash_balance),
        sharesHeld: parseInt(state.shares_held),
        positionValue: parseFloat(state.position_value),
        totalValue: parseFloat(state.total_value),
        roiPct: ((state.total_value - 10000) / 10000 * 100)
      }
    });

  } catch (error) {
    console.error('Error getting portfolio at time:', error);
    res.status(500).json({
      error: 'Failed to get portfolio state',
      message: error.message
    });
  }
});

/**
 * POST /api/flexible/best-time-window
 * 
 * Find the best performing time window for trading
 */
router.post('/best-time-window', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct, startDate, endDate, windowSizeHours } = req.body;

    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    const windowSize = windowSizeHours || 2; // Default 2-hour windows

    // Generate time windows (e.g., 9:30-11:30, 10:00-12:00, etc.)
    const windows = [];
    for (let hour = 9; hour <= 14; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startHour = hour;
        const startMinute = minute;
        const endHour = hour + windowSize;
        const endMinute = minute;
        
        if (endHour <= 16) {
          windows.push({
            startTime: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`
          });
        }
      }
    }

    const results = [];

    for (const window of windows) {
      const query = `
        SELECT 
          COUNT(*) as event_count,
          COALESCE(MAX(total_value) - MIN(total_value), 0) as profit
        FROM trade_events
        WHERE symbol = $1
          AND method = $2
          AND session = $3
          AND buy_pct = $4
          AND sell_pct = $5
          AND event_timestamp::date BETWEEN $6 AND $7
          AND event_timestamp::time BETWEEN $8 AND $9
      `;

      const result = await req.db.query(query, [
        symbol, method, session,
        parseFloat(buyPct), parseFloat(sellPct),
        startDate, endDate,
        window.startTime, window.endTime
      ]);

      const stats = result.rows[0];
      
      if (parseInt(stats.event_count) > 0) {
        results.push({
          timeWindow: `${window.startTime} - ${window.endTime}`,
          eventCount: parseInt(stats.event_count),
          profit: parseFloat(stats.profit)
        });
      }
    }

    // Sort by profit descending
    results.sort((a, b) => b.profit - a.profit);

    res.json({
      success: true,
      symbol,
      method,
      session,
      dateRange: { startDate, endDate },
      windowSizeHours: windowSize,
      bestWindows: results.slice(0, 10) // Top 10
    });

  } catch (error) {
    console.error('Error finding best time window:', error);
    res.status(500).json({
      error: 'Failed to find best time window',
      message: error.message
    });
  }
});

module.exports = router;