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

const API_BASE_URL = 'https://tradiac-api-941257247637.us-central1.run.app';

// Configuration
const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH'];

async function getPatternInstances(patternType, limit = 100, offset = 0) {
  const url = `${API_BASE_URL}/api/patterns/instances?type=${patternType}&limit=${limit}&offset=${offset}`;
  const response = await fetch(url);
  const result = await response.json();
  return result;
}

async function runBestPerformers(startDate, endDate, symbol = 'All', method = 'All', session = 'RTH', limit = 100) {
  const url = `${API_BASE_URL}/api/events/top-performers-v2`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate,
      endDate,
      symbol,
      method,
      session,
      limit
    })
  });
  const result = await response.json();
  return result;
}

async function storePatternPerformance(patternId, results) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const result of results) {
      const query = `
        INSERT INTO pattern_performance (
          pattern_id,
          symbol,
          method,
          session,
          buy_pct,
          sell_pct,
          total_trades,
          winning_trades,
          losing_trades,
          win_rate_pct,
          total_roi_pct,
          avg_trade_roi_pct,
          max_drawdown_pct,
          starting_equity,
          ending_equity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (pattern_id, symbol, method, session, buy_pct, sell_pct) 
        DO UPDATE SET
          total_trades = EXCLUDED.total_trades,
          winning_trades = EXCLUDED.winning_trades,
          losing_trades = EXCLUDED.losing_trades,
          win_rate_pct = EXCLUDED.win_rate_pct,
          total_roi_pct = EXCLUDED.total_roi_pct,
          avg_trade_roi_pct = EXCLUDED.avg_trade_roi_pct,
          max_drawdown_pct = EXCLUDED.max_drawdown_pct,
          ending_equity = EXCLUDED.ending_equity,
          calculated_at = CURRENT_TIMESTAMP
      `;

      const values = [
        patternId,
        result.symbol,
        result.method,
        result.session,
        result.buyPct,
        result.sellPct,
        result.totalTrades || 0,
        result.winningTrades || 0,
        result.losingTrades || 0,
        result.winRate || 0,
        result.totalRoi || 0,
        result.avgTradeRoi || 0,
        result.maxDrawdown || 0,
        10000, // starting equity
        result.finalEquity || 10000
      ];

      await client.query(query, values);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function analyzePattern(patternType, batchSize = 10, maxPatterns = null) {
  console.log(`\n=== Analyzing ${patternType} Patterns ===\n`);

  let offset = 0;
  let totalProcessed = 0;
  let totalErrors = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch batch of pattern instances
    const result = await getPatternInstances(patternType, batchSize, offset);
    
    if (!result.success || result.data.length === 0) {
      break;
    }

    console.log(`\nProcessing batch: ${offset + 1} to ${offset + result.data.length} of ${result.pagination.total}`);

    // Process each pattern instance
    for (const pattern of result.data) {
      try {
        console.log(`\n[${totalProcessed + 1}] Pattern ID: ${pattern.pattern_id}`);
        console.log(`  Date Range: ${pattern.start_date} to ${pattern.end_date}`);
        console.log(`  BTC Change: ${pattern.btc_change_pct}%`);

        // Run Best Performers for this pattern's date range
        console.log(`  Running Best Performers...`);
        const performanceResult = await runBestPerformers(
          pattern.start_date,
          pattern.end_date,
          'All', // Test all symbols
          'All', // Test all methods
          'RTH', // Start with RTH
          100    // Get top 100 strategies
        );

        if (performanceResult.success && performanceResult.data) {
          console.log(`  Found ${performanceResult.data.length} strategies`);
          
          // Store results in database
          await storePatternPerformance(pattern.pattern_id, performanceResult.data);
          console.log(`  ✓ Stored performance data`);
        } else {
          console.log(`  ✗ No performance data returned`);
        }

        totalProcessed++;

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  ✗ Error processing pattern ${pattern.pattern_id}:`, error.message);
        totalErrors++;
      }

      // Check if we've hit the max patterns limit
      if (maxPatterns && totalProcessed >= maxPatterns) {
        console.log(`\n✓ Reached max patterns limit (${maxPatterns})`);
        hasMore = false;
        break;
      }
    }

    offset += batchSize;
    hasMore = result.pagination.hasMore && (!maxPatterns || totalProcessed < maxPatterns);
  }

  console.log(`\n=== Analysis Complete ===`);
  console.log(`Total Processed: ${totalProcessed}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Success Rate: ${((totalProcessed - totalErrors) / totalProcessed * 100).toFixed(1)}%`);
}

async function getBestStrategiesForPattern(patternType, limit = 20) {
  const query = `
    SELECT 
      pp.symbol,
      pp.method,
      pp.session,
      pp.buy_pct,
      pp.sell_pct,
      COUNT(*) as pattern_instances,
      AVG(pp.total_roi_pct) as avg_roi,
      AVG(pp.win_rate_pct) as avg_win_rate,
      COUNT(*) FILTER (WHERE pp.total_roi_pct > 0) as winning_instances,
      COUNT(*) FILTER (WHERE pp.total_roi_pct > 0)::FLOAT / COUNT(*) * 100 as consistency_pct,
      MIN(pp.total_roi_pct) as min_roi,
      MAX(pp.total_roi_pct) as max_roi
    FROM pattern_performance pp
    JOIN btc_patterns p ON pp.pattern_id = p.pattern_id
    WHERE p.pattern_type = $1
    GROUP BY pp.symbol, pp.method, pp.session, pp.buy_pct, pp.sell_pct
    HAVING COUNT(*) >= 3  -- At least 3 instances
    ORDER BY avg_roi DESC
    LIMIT $2
  `;

  const client = await pool.connect();
  try {
    const result = await client.query(query, [patternType, limit]);
    return result.rows;
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';
  const patternType = args[1] || 'CRASH';
  const maxPatterns = args[2] ? parseInt(args[2]) : null;

  try {
    if (command === 'analyze') {
      console.log(`Starting pattern performance analysis...`);
      console.log(`Pattern Type: ${patternType}`);
      console.log(`Max Patterns: ${maxPatterns || 'unlimited'}`);
      console.log(`Batch Size: 10`);
      
      await analyzePattern(patternType, 10, maxPatterns);
      
    } else if (command === 'report') {
      console.log(`\n=== Best Strategies for ${patternType} ===\n`);
      const strategies = await getBestStrategiesForPattern(patternType, 20);
      
      console.table(strategies.map(s => ({
        Symbol: s.symbol,
        Method: s.method,
        Session: s.session,
        'Buy %': s.buy_pct,
        'Sell %': s.sell_pct,
        'Instances': s.pattern_instances,
        'Avg ROI': `${parseFloat(s.avg_roi).toFixed(2)}%`,
        'Win Rate': `${parseFloat(s.avg_win_rate).toFixed(1)}%`,
        'Consistency': `${parseFloat(s.consistency_pct).toFixed(1)}%`,
        'Min ROI': `${parseFloat(s.min_roi).toFixed(2)}%`,
        'Max ROI': `${parseFloat(s.max_roi).toFixed(2)}%`
      })));
      
    } else {
      console.log('Usage:');
      console.log('  node analyze-pattern-performance.js analyze <PATTERN_TYPE> [MAX_PATTERNS]');
      console.log('  node analyze-pattern-performance.js report <PATTERN_TYPE>');
      console.log('');
      console.log('Examples:');
      console.log('  node analyze-pattern-performance.js analyze CRASH 50');
      console.log('  node analyze-pattern-performance.js report CRASH');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();