/**
 * Event-Based Query Endpoints - OPTIMIZED VERSION
 * 
 * Uses specialized tables for faster queries:
 * - trade_events_rth_equal_mean
 * - trade_events_rth_vwap_ratio
 * - trade_events_rth_vol_weighted
 * - trade_events_rth_winsorized
 * - trade_events_rth_weighted_median
 * - trade_events_ah_equal_mean
 * - trade_events_ah_vwap_ratio
 * - trade_events_ah_vol_weighted
 * - trade_events_ah_winsorized
 * - trade_events_ah_weighted_median
 */

import express from 'express';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Database configuration
const isCloudRun = process.env.K_SERVICE !== undefined;
const dbConfig = {
  host: isCloudRun 
    ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME || 'tradiac-testing:us-central1:tradiac-testing-db'}`
    : (process.env.DB_HOST || '34.41.97.179'),
  port: isCloudRun ? undefined : parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: isCloudRun ? false : { rejectUnauthorized: false }
};

/**
 * Helper function to get the correct table name based on session and method
 */
function getTableName(session, method) {
  const sessionPrefix = session.toLowerCase(); // 'rth' or 'ah'
  const methodSuffix = method.toLowerCase(); // 'equal_mean', 'vwap_ratio', etc.
  
  return `trade_events_${sessionPrefix}_${methodSuffix}`;
}

/**
 * GET /api/events/query
 * 
 * Get all trade events for a specific combination and date range
 * NOW USES SPECIALIZED TABLES FOR FASTER QUERIES
 */
router.get('/query', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;

    // Validate required parameters
    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    // Get the specialized table name
    const tableName = getTableName(session, method);
    
    console.log(`Querying specialized table: ${tableName}`);

    // Query the specialized table directly (no session/method filter needed!)
    const query = `
      SELECT 
        symbol,
        buy_pct,
        sell_pct,
        event_date,
        event_time,
        event_type,
        stock_price,
        btc_price,
        ratio,
        baseline,
        trade_roi_pct,
        created_at
      FROM ${tableName}
      WHERE symbol = $1
        AND buy_pct = $2
        AND sell_pct = $3
        AND event_date >= $4
        AND event_date <= $5
      ORDER BY event_date, event_time
    `;

    const result = await client.query(query, [
      symbol,
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
      tableName, // Include which table was queried for debugging
      events: result.rows
    });

  } catch (error) {
    console.error('Error querying events:', error);
    res.status(500).json({
      error: 'Failed to query events',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

/**
 * GET /api/events/summary
 * 
 * Get summary statistics for a specific combination and date range
 * NOW USES SPECIALIZED TABLES
 */
router.get('/summary', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;

    // Validate required parameters
    if (!symbol || !method || !session || !buyPct || !sellPct || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }

    const tableName = getTableName(session, method);
    
    console.log(`Calculating summary from specialized table: ${tableName}`);

    // Calculate ROI directly from specialized table
    const query = `
      WITH events AS (
        SELECT 
          event_date,
          event_time,
          event_type,
          stock_price,
          trade_roi_pct
        FROM ${tableName}
        WHERE symbol = $1
          AND buy_pct = $2
          AND sell_pct = $3
          AND event_date >= $4
          AND event_date <= $5
        ORDER BY event_date, event_time
      ),
      trade_pairs AS (
        SELECT 
          event_type,
          trade_roi_pct
        FROM events
      )
      SELECT 
        10000.0 as start_value,
        10000.0 * (1 + COALESCE(SUM(trade_roi_pct) / 100.0, 0)) as end_value,
        COALESCE(SUM(trade_roi_pct), 0) as roi_pct,
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE event_type = 'BUY') as buy_events,
        COUNT(*) FILTER (WHERE event_type = 'SELL') as sell_events
      FROM trade_pairs
    `;

    const result = await client.query(query, [
      symbol,
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
      tableName,
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
  } finally {
    await client.end();
  }
});

/**
 * GET /api/events/top-performers
 * 
 * Get top performing combinations for a date range
 * NOW QUERIES ALL SPECIALIZED TABLES
 */
router.get('/top-performers', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    const { startDate, endDate, limit = 20, symbol, method, session } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['startDate', 'endDate']
      });
    }

    // Build list of tables to query based on filters
    const sessions = session ? [session.toUpperCase()] : ['RTH', 'AH'];
    const methods = method ? [method.toUpperCase()] : ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
    
    const results = [];

    // Query each relevant specialized table
    for (const sess of sessions) {
      for (const meth of methods) {
        const tableName = getTableName(sess, meth);
        
        const query = `
          WITH events AS (
            SELECT 
              symbol,
              buy_pct,
              sell_pct,
              trade_roi_pct
            FROM ${tableName}
            WHERE event_date >= $1
              AND event_date <= $2
              ${symbol ? 'AND symbol = $3' : ''}
          ),
          combinations AS (
            SELECT 
              symbol,
              buy_pct,
              sell_pct,
              COALESCE(SUM(trade_roi_pct), 0) as roi_pct,
              COUNT(*) as total_events,
              COUNT(*) FILTER (WHERE trade_roi_pct IS NOT NULL) as sell_events
            FROM events
            GROUP BY symbol, buy_pct, sell_pct
          )
          SELECT 
            '${sess}' as session,
            '${meth}' as method,
            symbol,
            buy_pct,
            sell_pct,
            roi_pct,
            total_events,
            sell_events
          FROM combinations
          WHERE total_events > 0
        `;

        const params = symbol ? [startDate, endDate, symbol] : [startDate, endDate];
        const result = await client.query(query, params);
        results.push(...result.rows);
      }
    }

    // Sort by ROI and limit
    results.sort((a, b) => parseFloat(b.roi_pct) - parseFloat(a.roi_pct));
    const topResults = results.slice(0, parseInt(limit));

    res.json({
      success: true,
      dateRange: { startDate, endDate },
      count: topResults.length,
      topPerformers: topResults.map(r => ({
        symbol: r.symbol,
        method: r.method,
        session: r.session,
        buyPct: parseFloat(r.buy_pct),
        sellPct: parseFloat(r.sell_pct),
        roiPct: parseFloat(r.roi_pct),
        totalEvents: parseInt(r.total_events),
        sellEvents: parseInt(r.sell_events)
      }))
    });

  } catch (error) {
    console.error('Error getting top performers:', error);
    res.status(500).json({
      error: 'Failed to get top performers',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;