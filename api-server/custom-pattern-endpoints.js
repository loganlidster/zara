import pkg from 'pg';
const { Pool } = pkg;
import fetch from 'node-fetch';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || '/cloudsql/tradiac-testing:us-central1:tradiac-testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tradiac_testing',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Helper function to execute queries
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// POST /api/patterns/custom-detect
// Detects custom patterns based on user-defined criteria
export async function detectCustomPattern(req, res) {
  try {
    const {
      direction,      // 'surge' or 'drop'
      magnitude,      // percentage (e.g., 3.5)
      timeframe,      // hours (e.g., 48)
      startDate,      // optional: filter start date
      endDate         // optional: filter end date
    } = req.body;

    // Validation
    if (!direction || !magnitude || !timeframe) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: direction, magnitude, timeframe'
      });
    }

    if (!['surge', 'drop'].includes(direction)) {
      return res.status(400).json({
        success: false,
        error: 'Direction must be "surge" or "drop"'
      });
    }

    console.log(`Detecting custom pattern: ${direction} ${magnitude}% in ${timeframe} hours`);

    // Use btc_hourly with optimized window function approach
    // This avoids the expensive self-join and uses 1-hour bars for speed
    const barsNeeded = Math.ceil(timeframe); // 1-hour bars
    
    const query = `
      WITH price_windows AS (
        SELECT 
          bar_date as start_date,
          bar_hour as start_hour,
          close_price as start_price,
          LEAD(bar_date, ${barsNeeded}) OVER (ORDER BY bar_date, bar_hour) as end_date,
          LEAD(bar_hour, ${barsNeeded}) OVER (ORDER BY bar_date, bar_hour) as end_hour,
          LEAD(close_price, ${barsNeeded}) OVER (ORDER BY bar_date, bar_hour) as end_price,
          ((LEAD(close_price, ${barsNeeded}) OVER (ORDER BY bar_date, bar_hour) - close_price) / close_price * 100) as change_pct
        FROM btc_hourly
        WHERE bar_date >= '${startDate || '2024-01-01'}'
          AND bar_date <= '${endDate || '2025-12-31'}'
      ),
      filtered_windows AS (
        SELECT 
          start_date,
          start_hour,
          end_date,
          end_hour,
          start_price,
          end_price,
          change_pct
        FROM price_windows
        WHERE end_price IS NOT NULL
          AND ${direction === 'surge' 
            ? `change_pct >= ${magnitude}` 
            : `change_pct <= -${magnitude}`
          }
      )
      SELECT 
        start_date,
        (start_hour || ':00:00')::TIME as start_time,
        end_date,
        (end_hour || ':00:00')::TIME as end_time,
        ROUND(start_price, 2) as start_price,
        ROUND(end_price, 2) as end_price,
        ROUND(change_pct, 2) as change_pct,
        ROUND(start_price, 2) as high_price,
        ROUND(end_price, 2) as low_price,
        ROUND(change_pct, 2) as max_gain_pct,
        ROUND(change_pct, 2) as max_drawdown_pct
      FROM filtered_windows
      ORDER BY start_date DESC, start_hour DESC
      LIMIT 500
    `;

    const matches = await executeQuery(query);

    console.log(`Found ${matches.length} matches`);

    res.json({
      success: true,
      pattern: {
        direction,
        magnitude,
        timeframe,
        startDate: startDate || 'all',
        endDate: endDate || 'all'
      },
      matches: matches,
      count: matches.length
    });

  } catch (error) {
    console.error('Error in detectCustomPattern:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// POST /api/patterns/analyze-custom
// Analyzes strategy performance for custom pattern matches with offset support
export async function analyzeCustomPattern(req, res) {
  try {
    const {
      matches,        // array of pattern matches from custom-detect
      offset = 0,     // 0 = during pattern, 1 = day after, 2 = 2 days after, etc.
      limit = 100     // top N strategies to return
    } = req.body;

    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid matches array'
      });
    }

    console.log(`Analyzing ${matches.length} pattern matches with offset ${offset}`);

    const API_BASE_URL = 'https://tradiac-api-941257247637.us-central1.run.app';
    const allResults = [];

    // Process each match
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      try {
        // Calculate analysis date range based on offset
        let analysisStartDate, analysisEndDate;
        
        if (offset === 0) {
          // During the pattern
          analysisStartDate = match.start_date;
          analysisEndDate = match.end_date;
        } else {
          // After the pattern (offset days)
          const endDate = new Date(match.end_date);
          analysisStartDate = new Date(endDate);
          analysisStartDate.setDate(analysisStartDate.getDate() + offset);
          
          analysisEndDate = new Date(analysisStartDate);
          analysisEndDate.setDate(analysisEndDate.getDate() + 1); // Analyze 1 day
          
          analysisStartDate = analysisStartDate.toISOString().split('T')[0];
          analysisEndDate = analysisEndDate.toISOString().split('T')[0];
        }

        console.log(`  [${i + 1}/${matches.length}] Analyzing ${analysisStartDate} to ${analysisEndDate}`);

        // Call Best Performers API
        const response = await fetch(`${API_BASE_URL}/api/events/top-performers-v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: analysisStartDate,
            endDate: analysisEndDate,
            symbol: 'All',
            method: 'All',
            session: 'RTH',
            limit: 100
          })
        });

        const result = await response.json();

        if (result.success && result.data) {
          // Add match context to each result
          result.data.forEach(strategy => {
            allResults.push({
              ...strategy,
              matchStartDate: match.start_date,
              matchEndDate: match.end_date,
              matchChangePct: match.change_pct,
              analysisStartDate,
              analysisEndDate,
              offset
            });
          });
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  Error processing match ${i + 1}:`, error.message);
      }
    }

    // Aggregate results by strategy (symbol, method, session, buy_pct, sell_pct)
    const aggregated = {};
    
    allResults.forEach(result => {
      const key = `${result.symbol}_${result.method}_${result.session}_${result.buyPct}_${result.sellPct}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          symbol: result.symbol,
          method: result.method,
          session: result.session,
          buyPct: result.buyPct,
          sellPct: result.sellPct,
          instances: 0,
          totalRoi: 0,
          winningInstances: 0,
          totalTrades: 0,
          winningTrades: 0,
          roiValues: []
        };
      }

      aggregated[key].instances++;
      aggregated[key].totalRoi += result.totalRoi || 0;
      aggregated[key].roiValues.push(result.totalRoi || 0);
      
      if (result.totalRoi > 0) {
        aggregated[key].winningInstances++;
      }
      
      aggregated[key].totalTrades += result.totalTrades || 0;
      aggregated[key].winningTrades += result.winningTrades || 0;
    });

    // Calculate final metrics
    const finalResults = Object.values(aggregated)
      .filter(strategy => strategy.instances >= 3) // At least 3 instances
      .map(strategy => ({
        symbol: strategy.symbol,
        method: strategy.method,
        session: strategy.session,
        buyPct: strategy.buyPct,
        sellPct: strategy.sellPct,
        instances: strategy.instances,
        avgRoi: strategy.totalRoi / strategy.instances,
        consistency: (strategy.winningInstances / strategy.instances) * 100,
        totalTrades: strategy.totalTrades,
        avgWinRate: strategy.totalTrades > 0 
          ? (strategy.winningTrades / strategy.totalTrades) * 100 
          : 0,
        minRoi: Math.min(...strategy.roiValues),
        maxRoi: Math.max(...strategy.roiValues)
      }))
      .sort((a, b) => b.avgRoi - a.avgRoi)
      .slice(0, limit);

    console.log(`Aggregated ${finalResults.length} unique strategies`);

    res.json({
      success: true,
      offset,
      matchesAnalyzed: matches.length,
      strategiesFound: finalResults.length,
      data: finalResults
    });

  } catch (error) {
    console.error('Error in analyzeCustomPattern:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  detectCustomPattern,
  analyzeCustomPattern
};