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

// Baseline check endpoint
router.post('/baseline-check', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const {
      symbol,
      date,
      session,
      nDays = 1
    } = req.body;
    
    // Validate inputs
    if (!symbol || !date || !session) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'date', 'session']
      });
    }
    
    console.log(`Baseline check for ${symbol} on ${date}, session ${session}, N=${nDays}`);
    
    // Get previous N trading days
    const prevDaysQuery = `
      SELECT trading_day
      FROM trading_calendar
      WHERE trading_day < $1
      ORDER BY trading_day DESC
      LIMIT $2
    `;
    
    const prevDaysResult = await client.query(prevDaysQuery, [date, nDays]);
    const previousDates = prevDaysResult.rows.map(r => r.trading_day);
    
    if (previousDates.length === 0) {
      return res.json({
        success: true,
        symbol,
        date,
        session,
        nDays,
        baselines: {},
        previousDates: [],
        message: 'No previous trading days found'
      });
    }
    
    // Get baselines for all methods
    const baselineQuery = `
      SELECT 
        method,
        baseline,
        sample_count,
        min_ratio,
        max_ratio,
        std_dev
      FROM baseline_daily
      WHERE symbol = $1
        AND session = $2
        AND trading_day = ANY($3)
      ORDER BY method
    `;
    
    const baselineResult = await client.query(baselineQuery, [
      symbol,
      session,
      previousDates
    ]);
    
    // Group by method and calculate average if N > 1
    const methodData = {};
    
    for (const row of baselineResult.rows) {
      if (!methodData[row.method]) {
        methodData[row.method] = {
          baselines: [],
          sampleCounts: [],
          minRatios: [],
          maxRatios: [],
          stdDevs: []
        };
      }
      
      methodData[row.method].baselines.push(parseFloat(row.baseline));
      methodData[row.method].sampleCounts.push(parseInt(row.sample_count));
      methodData[row.method].minRatios.push(parseFloat(row.min_ratio));
      methodData[row.method].maxRatios.push(parseFloat(row.max_ratio));
      methodData[row.method].stdDevs.push(parseFloat(row.std_dev));
    }
    
    // Calculate averages
    const baselines = {};
    const sampleCounts = {};
    const stats = {};
    
    for (const [method, data] of Object.entries(methodData)) {
      const avgBaseline = data.baselines.reduce((a, b) => a + b, 0) / data.baselines.length;
      const avgSampleCount = Math.round(data.sampleCounts.reduce((a, b) => a + b, 0) / data.sampleCounts.length);
      
      baselines[method] = avgBaseline;
      sampleCounts[method] = avgSampleCount;
      stats[method] = {
        minRatio: Math.min(...data.minRatios),
        maxRatio: Math.max(...data.maxRatios),
        avgStdDev: data.stdDevs.reduce((a, b) => a + b, 0) / data.stdDevs.length
      };
    }
    
    res.json({
      success: true,
      symbol,
      date,
      session,
      nDays,
      baselines,
      sampleCounts,
      stats,
      previousDates: previousDates.map(d => d.toISOString().split('T')[0])
    });
    
  } catch (error) {
    console.error('Error in baseline-check:', error);
    res.status(500).json({
      error: 'Failed to check baseline',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;