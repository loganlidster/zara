import { Router } from 'express';
import pkg from 'pg';
const { Client } = pkg;

const router = Router();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '/cloudsql/tradiac-testing:us-central1:tradiac-testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tradiac_testing',
  port: 5432,
};

// Helper to get table name
function getTableName(session, method) {
  const sessionLower = session.toLowerCase();
  const methodLower = method.toLowerCase();
  return `trade_events_${sessionLower}_${methodLower}`;
}

// Fast aggregated query - just SUM the trade_roi_pct, no wallet simulation
router.get('/fast-aggregated-performers', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    const { startDate, endDate, session, limit = 500 } = req.query;
    
    if (!startDate || !endDate || !session) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['startDate', 'endDate', 'session']
      });
    }

    const startTime = Date.now();
    const sessionUpper = session.toUpperCase();
    const methods = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
    
    const queryPromises = methods.map(async (method) => {
      const tableName = getTableName(sessionUpper, method);
      
      const query = `
        SELECT 
          '${sessionUpper}' as session,
          '${method}' as method,
          symbol,
          buy_pct,
          sell_pct,
          COALESCE(SUM(trade_roi_pct), 0) as total_roi,
          COUNT(*) FILTER (WHERE event_type = 'SELL') as total_trades,
          COUNT(*) FILTER (WHERE event_type = 'SELL' AND trade_roi_pct > 0) as winning_trades
        FROM ${tableName}
        WHERE event_date >= $1
          AND event_date <= $2
        GROUP BY symbol, buy_pct, sell_pct
        HAVING COUNT(*) FILTER (WHERE event_type = 'SELL') > 0
        ORDER BY total_roi DESC
        LIMIT $3
      `;
      
      const result = await client.query(query, [startDate, endDate, limit]);
      return result.rows;
    });

    const allResults = await Promise.all(queryPromises);
    const flatResults = allResults.flat();
    
    // Sort by total_roi and limit
    flatResults.sort((a, b) => parseFloat(b.total_roi) - parseFloat(a.total_roi));
    const topResults = flatResults.slice(0, parseInt(limit));
    
    const elapsed = Date.now() - startTime;
    
    res.json({
      success: true,
      dateRange: { startDate, endDate },
      session: sessionUpper,
      count: topResults.length,
      performers: topResults.map(r => ({
        symbol: r.symbol,
        method: r.method,
        session: r.session,
        buyPct: parseFloat(r.buy_pct),
        sellPct: parseFloat(r.sell_pct),
        totalRoi: parseFloat(r.total_roi),
        totalTrades: parseInt(r.total_trades),
        winningTrades: parseInt(r.winning_trades)
      })),
      timing: {
        total: elapsed
      }
    });
    
  } catch (error) {
    console.error('Error in fast-aggregated-performers:', error);
    res.status(500).json({
      error: 'Failed to get performers',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;