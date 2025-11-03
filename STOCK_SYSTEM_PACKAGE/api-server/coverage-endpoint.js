import { Router } from 'express';
import pkg from 'pg';
const { Client } = pkg;

const router = Router();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '/cloudsql/tradiac-testing:us-central1:tradiac-testing',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tradiac_testing',
  port: 5432,
};

// Coverage report endpoint
router.post('/coverage', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const {
      symbols,
      startDate,
      endDate
    } = req.body;
    
    // Validate inputs
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0 || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbols (array)', 'startDate', 'endDate']
      });
    }
    
    console.log(`Coverage report for ${symbols.length} symbols from ${startDate} to ${endDate}`);
    
    // Get trading days in range
    const tradingDaysQuery = `
      SELECT COUNT(*) as total_days
      FROM trading_calendar
      WHERE trading_day >= $1 AND trading_day <= $2
    `;
    
    const tradingDaysResult = await client.query(tradingDaysQuery, [startDate, endDate]);
    const totalTradingDays = parseInt(tradingDaysResult.rows[0].total_days);
    
    const coverage = [];
    
    // Process each symbol
    for (const symbol of symbols) {
      try {
        // Count stock minutes
        const stockQuery = `
          SELECT 
            COUNT(*) as total_minutes,
            COUNT(DISTINCT et_date) as days_with_data
          FROM minute_stock
          WHERE symbol = $1
            AND et_date >= $2
            AND et_date <= $3
        `;
        
        const stockResult = await client.query(stockQuery, [symbol, startDate, endDate]);
        const stockMinutes = parseInt(stockResult.rows[0].total_minutes);
        const daysWithData = parseInt(stockResult.rows[0].days_with_data);
        
        // Get missing dates
        const missingDatesQuery = `
          SELECT tc.trading_day
          FROM trading_calendar tc
          WHERE tc.trading_day >= $1
            AND tc.trading_day <= $2
            AND NOT EXISTS (
              SELECT 1 FROM minute_stock ms
              WHERE ms.symbol = $3
                AND ms.et_date = tc.trading_day
            )
          ORDER BY tc.trading_day
        `;
        
        const missingDatesResult = await client.query(missingDatesQuery, [startDate, endDate, symbol]);
        const missingDates = missingDatesResult.rows.map(r => r.trading_day.toISOString().split('T')[0]);
        
        // Calculate coverage percentage
        const coveragePct = totalTradingDays > 0 ? (daysWithData / totalTradingDays) * 100 : 0;
        
        coverage.push({
          symbol,
          totalDays: totalTradingDays,
          daysWithData,
          stockMinutes,
          coveragePct: Math.round(coveragePct * 100) / 100,
          missingDates
        });
      } catch (err) {
        console.error(`Error processing ${symbol}:`, err.message);
        coverage.push({
          symbol,
          totalDays: totalTradingDays,
          daysWithData: 0,
          stockMinutes: 0,
          coveragePct: 0,
          missingDates: [],
          error: err.message
        });
      }
    }
    
    // Count BTC minutes
    const btcQuery = `
      SELECT COUNT(*) as total_minutes
      FROM minute_btc
      WHERE et_date >= $1 AND et_date <= $2
    `;
    
    const btcResult = await client.query(btcQuery, [startDate, endDate]);
    const btcMinutes = parseInt(btcResult.rows[0].total_minutes);
    
    // Calculate summary stats
    const avgCoverage = coverage.length > 0
      ? coverage.reduce((sum, c) => sum + c.coveragePct, 0) / coverage.length
      : 0;
    
    const symbolsWithIssues = coverage.filter(c => c.coveragePct < 100).length;
    
    res.json({
      success: true,
      dateRange: { startDate, endDate },
      totalTradingDays,
      coverage,
      btcMinutes,
      summary: {
        totalSymbols: symbols.length,
        avgCoverage: Math.round(avgCoverage * 100) / 100,
        symbolsWithIssues,
        symbolsComplete: symbols.length - symbolsWithIssues
      }
    });
    
  } catch (error) {
    console.error('Error in coverage report:', error);
    res.status(500).json({
      error: 'Failed to generate coverage report',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;