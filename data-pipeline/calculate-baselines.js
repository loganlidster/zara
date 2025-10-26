import pg from 'pg';

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];

async function calculateBaselines(client, startDate, endDate) {
  console.log('🔧 Calculating baselines...\n');
  
  // Delete existing baselines in range
  console.log('   Clearing existing baselines...');
  await client.query(`
    DELETE FROM baseline_daily
    WHERE trading_day >= $1 AND trading_day <= $2
  `, [startDate, endDate]);
  
  console.log('   Calculating new baselines...\n');
  
  // Calculate all baselines using SQL
  const query = `
    WITH minute_ratios AS (
      SELECT 
        s.symbol,
        s.et_date,
        s.et_time,
        s.session,
        s.close as stock_price,
        b.close as btc_price,
        (s.close / b.close) as ratio,
        s.volume as stock_volume,
        b.volume as btc_volume
      FROM minute_stock s
      JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
      WHERE s.et_date >= $1 AND s.et_date <= $2
    ),
    daily_stats AS (
      SELECT 
        symbol,
        et_date as trading_day,
        session,
        
        -- EQUAL_MEAN: Simple average of all ratios
        AVG(ratio) as equal_mean,
        
        -- VWAP_RATIO: Volume-weighted average price ratio
        SUM(ratio * stock_volume) / NULLIF(SUM(stock_volume), 0) as vwap_ratio,
        
        -- VOL_WEIGHTED: Weighted by combined volume
        SUM(ratio * (stock_volume + btc_volume)) / NULLIF(SUM(stock_volume + btc_volume), 0) as vol_weighted,
        
        -- For WINSORIZED and WEIGHTED_MEDIAN, we need percentiles
        PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY ratio) as p5,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ratio) as p95,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ratio) as median,
        
        COUNT(*) as sample_count,
        MIN(ratio) as min_ratio,
        MAX(ratio) as max_ratio,
        STDDEV(ratio) as std_dev
        
      FROM minute_ratios
      GROUP BY symbol, et_date, session
    ),
    winsorized_calc AS (
      SELECT 
        mr.symbol,
        mr.et_date,
        mr.session,
        AVG(
          CASE 
            WHEN mr.ratio < ds.p5 THEN ds.p5
            WHEN mr.ratio > ds.p95 THEN ds.p95
            ELSE mr.ratio
          END
        ) as winsorized
      FROM minute_ratios mr
      JOIN daily_stats ds ON mr.symbol = ds.symbol 
        AND mr.et_date = ds.trading_day 
        AND mr.session = ds.session
      GROUP BY mr.symbol, mr.et_date, mr.session
    ),
    weighted_median_calc AS (
      SELECT 
        symbol,
        et_date,
        session,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ratio) as weighted_median
      FROM minute_ratios
      GROUP BY symbol, et_date, session
    )
    INSERT INTO baseline_daily (
      symbol, trading_day, session, method, baseline, 
      sample_count, min_ratio, max_ratio, std_dev
    )
    SELECT symbol, trading_day, session, 'EQUAL_MEAN', equal_mean, 
           sample_count, min_ratio, max_ratio, std_dev
    FROM daily_stats
    UNION ALL
    SELECT symbol, trading_day, session, 'VWAP_RATIO', vwap_ratio,
           sample_count, min_ratio, max_ratio, std_dev
    FROM daily_stats
    UNION ALL
    SELECT symbol, trading_day, session, 'VOL_WEIGHTED', vol_weighted,
           sample_count, min_ratio, max_ratio, std_dev
    FROM daily_stats
    UNION ALL
    SELECT ds.symbol, ds.trading_day, ds.session, 'WINSORIZED', wc.winsorized,
           ds.sample_count, ds.min_ratio, ds.max_ratio, ds.std_dev
    FROM daily_stats ds
    JOIN winsorized_calc wc ON ds.symbol = wc.symbol 
      AND ds.trading_day = wc.et_date 
      AND ds.session = wc.session
    UNION ALL
    SELECT ds.symbol, ds.trading_day, ds.session, 'WEIGHTED_MEDIAN', wmc.weighted_median,
           ds.sample_count, ds.min_ratio, ds.max_ratio, ds.std_dev
    FROM daily_stats ds
    JOIN weighted_median_calc wmc ON ds.symbol = wmc.symbol 
      AND ds.trading_day = wmc.et_date 
      AND ds.session = wmc.session
    ON CONFLICT (symbol, trading_day, session, method) 
    DO UPDATE SET
      baseline = EXCLUDED.baseline,
      sample_count = EXCLUDED.sample_count,
      min_ratio = EXCLUDED.min_ratio,
      max_ratio = EXCLUDED.max_ratio,
      std_dev = EXCLUDED.std_dev,
      calculated_at = CURRENT_TIMESTAMP
  `;
  
  await client.query(query, [startDate, endDate]);
  
  // Get count
  const countResult = await client.query(`
    SELECT COUNT(*) as count
    FROM baseline_daily
    WHERE trading_day >= $1 AND trading_day <= $2
  `, [startDate, endDate]);
  
  console.log(`   ✅ Calculated ${countResult.rows[0].count.toLocaleString()} baselines\n`);
  
  // Show summary by method
  const summaryResult = await client.query(`
    SELECT 
      method,
      COUNT(*) as count,
      COUNT(DISTINCT symbol) as symbols,
      COUNT(DISTINCT trading_day) as days
    FROM baseline_daily
    WHERE trading_day >= $1 AND trading_day <= $2
    GROUP BY method
    ORDER BY method
  `, [startDate, endDate]);
  
  console.log('   Summary by method:');
  summaryResult.rows.forEach(row => {
    console.log(`      ${row.method.padEnd(20)} - ${row.count.toLocaleString().padStart(6)} records (${row.symbols} symbols, ${row.days} days)`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node calculate-baselines.js <start-date> <end-date>');
    console.error('Example: node calculate-baselines.js 2024-01-01 2024-10-26');
    process.exit(1);
  }
  
  const startDate = args[0];
  const endDate = args[1];
  
  console.log('🚀 TRADIAC Baseline Calculator');
  console.log('═══════════════════════════════════════');
  console.log(`Date Range: ${startDate} to ${endDate}`);
  console.log(`Stocks: ${STOCKS.join(', ')}`);
  console.log(`Methods: ${METHODS.join(', ')}`);
  console.log('═══════════════════════════════════════\n');
  
  const client = await pool.connect();
  
  try {
    const startTime = Date.now();
    
    await calculateBaselines(client, startDate, endDate);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ BASELINE CALCULATION COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`Total Time: ${totalTime} seconds\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();