/**
 * Event-Based Query Endpoints - WITH SEPARATE RTH/AH VALUES
 * 
 * Supports different buy/sell percentages for RTH and AH sessions
 * Can query both sessions and combine results chronologically
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
 * SUPPORTS SEPARATE RTH AND AH VALUES
 * 
 * Query Parameters:
 * - symbol: Stock symbol (required)
 * - method: Baseline method (required)
 * - session: Trading session - 'RTH', 'AH', or 'ALL' (required)
 * - startDate: Start date (required)
 * - endDate: End date (required)
 * 
 * For session='RTH' or 'AH':
 * - buyPct: Buy percentage threshold (required)
 * - sellPct: Sell percentage threshold (required)
 * 
 * For session='ALL':
 * - rthBuyPct: RTH buy percentage (required)
 * - rthSellPct: RTH sell percentage (required)
 * - ahBuyPct: AH buy percentage (required)
 * - ahSellPct: AH sell percentage (required)
 */
router.get('/query', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const { symbol, method, session, startDate, endDate } = req.query;

    // Validate required parameters
    if (!symbol || !method || !session || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'startDate', 'endDate']
      });
    }

    let events = [];
    let tablesQueried = [];

    if (session.toUpperCase() === 'ALL') {
      // Query both RTH and AH tables with separate values
      const { rthBuyPct, rthSellPct, ahBuyPct, ahSellPct } = req.query;

      if (!rthBuyPct || !rthSellPct || !ahBuyPct || !ahSellPct) {
        return res.status(400).json({
          error: 'Missing required parameters for ALL session',
          required: ['rthBuyPct', 'rthSellPct', 'ahBuyPct', 'ahSellPct']
        });
      }

      // Query RTH table
      const rthTableName = getTableName('RTH', method);
      tablesQueried.push(rthTableName);
      
      const rthQuery = `
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
          'RTH' as session,
          created_at
        FROM ${rthTableName}
        WHERE symbol = $1
          AND buy_pct = $2
          AND sell_pct = $3
          AND event_date >= $4
          AND event_date <= $5
      `;

      const rthResult = await client.query(rthQuery, [
        symbol,
        parseFloat(rthBuyPct),
        parseFloat(rthSellPct),
        startDate,
        endDate
      ]);

      // Query AH table
      const ahTableName = getTableName('AH', method);
      tablesQueried.push(ahTableName);
      
      const ahQuery = `
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
          'AH' as session,
          created_at
        FROM ${ahTableName}
        WHERE symbol = $1
          AND buy_pct = $2
          AND sell_pct = $3
          AND event_date >= $4
          AND event_date <= $5
      `;

      const ahResult = await client.query(ahQuery, [
        symbol,
        parseFloat(ahBuyPct),
        parseFloat(ahSellPct),
        startDate,
        endDate
      ]);

      // Combine and sort chronologically
      events = [...rthResult.rows, ...ahResult.rows].sort((a, b) => {
        const dateCompare = new Date(a.event_date) - new Date(b.event_date);
        if (dateCompare !== 0) return dateCompare;
        return a.event_time.localeCompare(b.event_time);
      });

      res.json({
        success: true,
        symbol,
        method,
        session: 'ALL',
        rthBuyPct: parseFloat(rthBuyPct),
        rthSellPct: parseFloat(rthSellPct),
        ahBuyPct: parseFloat(ahBuyPct),
        ahSellPct: parseFloat(ahSellPct),
        dateRange: { startDate, endDate },
        eventCount: events.length,
        rthEventCount: rthResult.rows.length,
        ahEventCount: ahResult.rows.length,
        tablesQueried,
        events
      });

    } else {
      // Query single session (RTH or AH)
      const { buyPct, sellPct } = req.query;

      if (!buyPct || !sellPct) {
        return res.status(400).json({
          error: 'Missing required parameters',
          required: ['buyPct', 'sellPct']
        });
      }

      const tableName = getTableName(session, method);
      tablesQueried.push(tableName);
      
      console.log(`Querying specialized table: ${tableName}`);

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

      events = result.rows;

      res.json({
        success: true,
        symbol,
        method,
        session,
        buyPct: parseFloat(buyPct),
        sellPct: parseFloat(sellPct),
        dateRange: { startDate, endDate },
        eventCount: events.length,
        tablesQueried,
        events
      });
    }

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
 * SUPPORTS SEPARATE RTH AND AH VALUES
 */
router.get('/summary', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    const { symbol, method, session, startDate, endDate } = req.query;

    // Validate required parameters
    if (!symbol || !method || !session || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'startDate', 'endDate']
      });
    }

    let totalRoi = 0;
    let totalEvents = 0;
    let buyEvents = 0;
    let sellEvents = 0;
    let tablesQueried = [];

    if (session.toUpperCase() === 'ALL') {
      // Calculate combined ROI from both RTH and AH
      const { rthBuyPct, rthSellPct, ahBuyPct, ahSellPct } = req.query;

      if (!rthBuyPct || !rthSellPct || !ahBuyPct || !ahSellPct) {
        return res.status(400).json({
          error: 'Missing required parameters for ALL session',
          required: ['rthBuyPct', 'rthSellPct', 'ahBuyPct', 'ahSellPct']
        });
      }

      // Query RTH table
      const rthTableName = getTableName('RTH', method);
      tablesQueried.push(rthTableName);
      
      const rthQuery = `
        SELECT 
          event_type,
          trade_roi_pct
        FROM ${rthTableName}
        WHERE symbol = $1
          AND buy_pct = $2
          AND sell_pct = $3
          AND event_date >= $4
          AND event_date <= $5
      `;

      const rthResult = await client.query(rthQuery, [
        symbol,
        parseFloat(rthBuyPct),
        parseFloat(rthSellPct),
        startDate,
        endDate
      ]);

      // Query AH table
      const ahTableName = getTableName('AH', method);
      tablesQueried.push(ahTableName);
      
      const ahQuery = `
        SELECT 
          event_type,
          trade_roi_pct
        FROM ${ahTableName}
        WHERE symbol = $1
          AND buy_pct = $2
          AND sell_pct = $3
          AND event_date >= $4
          AND event_date <= $5
      `;

      const ahResult = await client.query(ahQuery, [
        symbol,
        parseFloat(ahBuyPct),
        parseFloat(ahSellPct),
        startDate,
        endDate
      ]);

      // Combine results
      const allEvents = [...rthResult.rows, ...ahResult.rows];
      
      allEvents.forEach(event => {
        totalEvents++;
        if (event.event_type === 'BUY') {
          buyEvents++;
        } else if (event.event_type === 'SELL') {
          sellEvents++;
          if (event.trade_roi_pct !== null) {
            totalRoi += parseFloat(event.trade_roi_pct);
          }
        }
      });

    } else {
      // Single session calculation
      const { buyPct, sellPct } = req.query;

      if (!buyPct || !sellPct) {
        return res.status(400).json({
          error: 'Missing required parameters',
          required: ['buyPct', 'sellPct']
        });
      }

      const tableName = getTableName(session, method);
      tablesQueried.push(tableName);

      const query = `
        SELECT 
          event_type,
          trade_roi_pct
        FROM ${tableName}
        WHERE symbol = $1
          AND buy_pct = $2
          AND sell_pct = $3
          AND event_date >= $4
          AND event_date <= $5
      `;

      const result = await client.query(query, [
        symbol,
        parseFloat(buyPct),
        parseFloat(sellPct),
        startDate,
        endDate
      ]);

      result.rows.forEach(event => {
        totalEvents++;
        if (event.event_type === 'BUY') {
          buyEvents++;
        } else if (event.event_type === 'SELL') {
          sellEvents++;
          if (event.trade_roi_pct !== null) {
            totalRoi += parseFloat(event.trade_roi_pct);
          }
        }
      });
    }

    const startValue = 10000;
    const endValue = startValue * (1 + totalRoi / 100);

    res.json({
      success: true,
      symbol,
      method,
      session,
      ...(session.toUpperCase() === 'ALL' ? {
        rthBuyPct: parseFloat(req.query.rthBuyPct),
        rthSellPct: parseFloat(req.query.rthSellPct),
        ahBuyPct: parseFloat(req.query.ahBuyPct),
        ahSellPct: parseFloat(req.query.ahSellPct)
      } : {
        buyPct: parseFloat(req.query.buyPct),
        sellPct: parseFloat(req.query.sellPct)
      }),
      dateRange: { startDate, endDate },
      tablesQueried,
      summary: {
        startValue,
        endValue,
        roiPct: totalRoi,
        totalEvents,
        buyEvents,
        sellEvents
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