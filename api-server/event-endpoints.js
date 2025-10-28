/**
 * Event-Based Query Endpoints
 * 
 * These endpoints query the trade_events table to provide:
 * - Individual trade events for specific combinations
 * - Summary statistics and ROI calculations
 * - Portfolio state at any point in time
 */

import express from 'express';
const router = express.Router();

/**
 * GET /api/events/query
 * 
 * Get all trade events for a specific combination and date range
 * 
 * Query Parameters:
 * - symbol: Stock symbol (required)
 * - method: Baseline method (required)
 * - session: Trading session (required)
 * - buyPct: Buy percentage threshold (required)
 * - sellPct: Sell percentage threshold (required)
 * - startDate: Start date (required)
 * - endDate: End date (required)
 */
router.get('/query', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;

    // Validate required parameters
    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    const query = `
      SELECT * FROM get_trade_events($1, $2, $3, $4, $5, $6, $7)
    `;

    const result = await req.db.query(query, [
      symbol,
      method,
      session,
      parseFloat(buyPct),
      parseFloat(sellPct),
      startDate,
      endDate
    ]);

    res.json({
      success: true,
      symbol,
      method,
      session,
      buyPct: parseFloat(buyPct),
      sellPct: parseFloat(sellPct),
      dateRange: { startDate, endDate },
      eventCount: result.rows.length,
      events: result.rows
    });

  } catch (error) {
    console.error('Error querying events:', error);
    res.status(500).json({
      error: 'Failed to query events',
      message: error.message
    });
  }
});

/**
 * GET /api/events/summary
 * 
 * Get summary statistics for a specific combination and date range
 * 
 * Query Parameters: Same as /query
 */
router.get('/summary', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;

    // Validate required parameters
    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    const query = `
      SELECT * FROM calculate_roi($1, $2, $3, $4, $5, $6, $7)
    `;

    const result = await req.db.query(query, [
      symbol,
      method,
      session,
      parseFloat(buyPct),
      parseFloat(sellPct),
      startDate,
      endDate
    ]);

    const summary = result.rows[0];

    res.json({
      success: true,
      symbol,
      method,
      session,
      buyPct: parseFloat(buyPct),
      sellPct: parseFloat(sellPct),
      dateRange: { startDate, endDate },
      summary: {
        startValue: parseFloat(summary.start_value),
        endValue: parseFloat(summary.end_value),
        roiPct: parseFloat(summary.roi_pct),
        totalEvents: parseInt(summary.total_events),
        buyEvents: parseInt(summary.buy_events),
        sellEvents: parseInt(summary.sell_events)
      }
    });

  } catch (error) {
    console.error('Error calculating summary:', error);
    res.status(500).json({
      error: 'Failed to calculate summary',
      message: error.message
    });
  }
});

/**
 * GET /api/events/portfolio-state
 * 
 * Get the current portfolio state for a specific combination
 */
router.get('/portfolio-state', async (req, res) => {
  try {
    const { symbol, method, session, buyPct, sellPct } = req.query;

    // Validate required parameters
    if (!symbol || !method || !session || !buyPct || !sellPct) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct']
      });
    }

    const query = `
      SELECT 
        event_timestamp,
        event_type,
        cash_balance,
        shares_held,
        position_value,
        total_value,
        roi_pct
      FROM latest_portfolio_state
      WHERE symbol = $1
        AND method = $2
        AND session = $3
        AND buy_pct = $4
        AND sell_pct = $5
    `;

    const result = await req.db.query(query, [
      symbol,
      method,
      session,
      parseFloat(buyPct),
      parseFloat(sellPct)
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No portfolio state found',
        message: 'This combination may not have been processed yet'
      });
    }

    const state = result.rows[0];

    res.json({
      success: true,
      symbol,
      method,
      session,
      buyPct: parseFloat(buyPct),
      sellPct: parseFloat(sellPct),
      portfolioState: {
        lastEventTimestamp: state.event_timestamp,
        lastEventType: state.event_type,
        cashBalance: parseFloat(state.cash_balance),
        sharesHeld: parseInt(state.shares_held),
        positionValue: parseFloat(state.position_value),
        totalValue: parseFloat(state.total_value),
        roiPct: parseFloat(state.roi_pct)
      }
    });

  } catch (error) {
    console.error('Error getting portfolio state:', error);
    res.status(500).json({
      error: 'Failed to get portfolio state',
      message: error.message
    });
  }
});

/**
 * GET /api/events/batch-summary
 * 
 * Get summaries for multiple combinations at once
 * 
 * Body (POST):
 * {
 *   "combinations": [
 *     { "symbol": "HIVE", "method": "EQUAL_MEAN", "session": "RTH", "buyPct": 0.5, "sellPct": 0.5 },
 *     ...
 *   ],
 *   "startDate": "2024-01-01",
 *   "endDate": "2024-12-31"
 * }
 */
router.post('/batch-summary', async (req, res) => {
  try {
    const { combinations, startDate, endDate } = req.body;

    if (!combinations || !Array.isArray(combinations) || combinations.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'combinations array is required'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['startDate', 'endDate']
      });
    }

    const results = [];

    for (const combo of combinations) {
      const { symbol, method, session, buyPct, sellPct } = combo;

      const query = `
        SELECT * FROM calculate_roi($1, $2, $3, $4, $5, $6, $7)
      `;

      const result = await req.db.query(query, [
        symbol,
        method,
        session,
        parseFloat(buyPct),
        parseFloat(sellPct),
        startDate,
        endDate
      ]);

      const summary = result.rows[0];

      results.push({
        symbol,
        method,
        session,
        buyPct: parseFloat(buyPct),
        sellPct: parseFloat(sellPct),
        startValue: parseFloat(summary.start_value),
        endValue: parseFloat(summary.end_value),
        roiPct: parseFloat(summary.roi_pct),
        totalEvents: parseInt(summary.total_events),
        buyEvents: parseInt(summary.buy_events),
        sellEvents: parseInt(summary.sell_events)
      });
    }

    // Sort by ROI descending
    results.sort((a, b) => b.roiPct - a.roiPct);

    res.json({
      success: true,
      dateRange: { startDate, endDate },
      count: results.length,
      results
    });

  } catch (error) {
    console.error('Error in batch summary:', error);
    res.status(500).json({
      error: 'Failed to calculate batch summary',
      message: error.message
    });
  }
});

/**
 * GET /api/events/metadata
 * 
 * Get processing metadata for combinations
 */
router.get('/metadata', async (req, res) => {
  try {
    const { symbol, method, session, status } = req.query;

    let query = 'SELECT * FROM simulation_metadata WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (symbol) {
      query += ` AND symbol = $${paramCount++}`;
      params.push(symbol);
    }

    if (method) {
      query += ` AND method = $${paramCount++}`;
      params.push(method);
    }

    if (session) {
      query += ` AND session = $${paramCount++}`;
      params.push(session);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    query += ' ORDER BY symbol, method, session, buy_pct, sell_pct';

    const result = await req.db.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      metadata: result.rows
    });

  } catch (error) {
    console.error('Error getting metadata:', error);
    res.status(500).json({
      error: 'Failed to get metadata',
      message: error.message
    });
  }
});

/**
 * GET /api/events/top-performers
 * 
 * Get top performing combinations for a date range
 */
router.get('/top-performers', async (req, res) => {
  try {
    const { startDate, endDate, limit = 20, symbol, method, session } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['startDate', 'endDate']
      });
    }

    let whereClause = '';
    const params = [startDate, endDate, parseInt(limit)];
    let paramCount = 4;

    if (symbol) {
      whereClause += ` AND sm.symbol = $${paramCount++}`;
      params.push(symbol);
    }

    if (method) {
      whereClause += ` AND sm.method = $${paramCount++}`;
      params.push(method);
    }

    if (session) {
      whereClause += ` AND sm.session = $${paramCount++}`;
      params.push(session);
    }

    const query = `
      WITH roi_calculations AS (
        SELECT 
          sm.symbol,
          sm.method,
          sm.session,
          sm.buy_pct,
          sm.sell_pct,
          (SELECT * FROM calculate_roi(
            sm.symbol, sm.method, sm.session, sm.buy_pct, sm.sell_pct, $1, $2
          )) as roi_data
        FROM simulation_metadata sm
        WHERE sm.status = 'completed'
          ${whereClause}
      )
      SELECT 
        symbol,
        method,
        session,
        buy_pct,
        sell_pct,
        (roi_data).roi_pct as roi_pct,
        (roi_data).total_events as total_events,
        (roi_data).buy_events as buy_events,
        (roi_data).sell_events as sell_events
      FROM roi_calculations
      ORDER BY (roi_data).roi_pct DESC
      LIMIT $3
    `;

    const result = await req.db.query(query, params);

    res.json({
      success: true,
      dateRange: { startDate, endDate },
      count: result.rows.length,
      topPerformers: result.rows
    });

  } catch (error) {
    console.error('Error getting top performers:', error);
    res.status(500).json({
      error: 'Failed to get top performers',
      message: error.message
    });
  }
});

export default router;