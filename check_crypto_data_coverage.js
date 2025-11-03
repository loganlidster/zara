// Check if we have crypto data for the 12-month period (Dec 2024 - Nov 2025)

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

async function checkDataCoverage() {
  try {
    console.log('\n=== CRYPTO DATA COVERAGE CHECK ===\n');
    
    // Check date range in minute_crypto
    const dateRangeQuery = `
      SELECT 
        MIN(timestamp::date) as earliest_date,
        MAX(timestamp::date) as latest_date,
        COUNT(DISTINCT timestamp::date) as total_days,
        COUNT(*) as total_bars
      FROM minute_crypto
    `;
    
    const dateResult = await pool.query(dateRangeQuery);
    const { earliest_date, latest_date, total_days, total_bars } = dateResult.rows[0];
    
    console.log('Overall Data Range:');
    console.log(`  Earliest: ${earliest_date}`);
    console.log(`  Latest: ${latest_date}`);
    console.log(`  Total days: ${total_days}`);
    console.log(`  Total bars: ${total_bars.toLocaleString()}\n`);
    
    // Check if we have data for Dec 2024 - Nov 2025
    const targetRangeQuery = `
      SELECT 
        COUNT(DISTINCT timestamp::date) as days_in_range,
        COUNT(*) as bars_in_range,
        MIN(timestamp::date) as first_date,
        MAX(timestamp::date) as last_date
      FROM minute_crypto
      WHERE timestamp::date >= '2024-12-01' 
        AND timestamp::date <= '2025-11-30'
    `;
    
    const targetResult = await pool.query(targetRangeQuery);
    const { days_in_range, bars_in_range, first_date, last_date } = targetResult.rows[0];
    
    console.log('Target Range (Dec 2024 - Nov 2025):');
    console.log(`  Days with data: ${days_in_range} / 365 expected`);
    console.log(`  Total bars: ${bars_in_range?.toLocaleString() || 0}`);
    console.log(`  First date: ${first_date || 'N/A'}`);
    console.log(`  Last date: ${last_date || 'N/A'}\n`);
    
    // Check coverage by symbol
    const symbolQuery = `
      SELECT 
        symbol,
        COUNT(*) as total_bars,
        MIN(timestamp::date) as earliest,
        MAX(timestamp::date) as latest,
        COUNT(DISTINCT timestamp::date) as days
      FROM minute_crypto
      WHERE timestamp::date >= '2024-12-01' 
        AND timestamp::date <= '2025-11-30'
      GROUP BY symbol
      ORDER BY symbol
    `;
    
    const symbolResult = await pool.query(symbolQuery);
    
    console.log('Coverage by Symbol (Dec 2024 - Nov 2025):');
    console.log('Symbol  Bars        Days  Earliest    Latest');
    console.log('------  ----------  ----  ----------  ----------');
    
    for (const row of symbolResult.rows) {
      console.log(
        `${row.symbol.padEnd(6)}  ` +
        `${row.total_bars.toLocaleString().padStart(10)}  ` +
        `${row.days.toString().padStart(4)}  ` +
        `${row.earliest}  ` +
        `${row.latest}`
      );
    }
    
    console.log(`\nTotal symbols: ${symbolResult.rows.length}`);
    
    // Check baseline coverage
    const baselineQuery = `
      SELECT 
        COUNT(*) as total_baselines,
        COUNT(DISTINCT trading_day) as days_with_baselines,
        MIN(trading_day) as earliest_baseline,
        MAX(trading_day) as latest_baseline
      FROM baseline_daily_crypto
      WHERE trading_day >= '2024-12-01' 
        AND trading_day <= '2025-11-30'
    `;
    
    const baselineResult = await pool.query(baselineQuery);
    const baseline = baselineResult.rows[0];
    
    console.log('\nBaseline Coverage (Dec 2024 - Nov 2025):');
    console.log(`  Total baselines: ${baseline.total_baselines?.toLocaleString() || 0}`);
    console.log(`  Days with baselines: ${baseline.days_with_baselines || 0}`);
    console.log(`  Earliest: ${baseline.earliest_baseline || 'N/A'}`);
    console.log(`  Latest: ${baseline.latest_baseline || 'N/A'}\n`);
    
    // Recommendation
    if (days_in_range < 300) {
      console.log('⚠️  WARNING: Insufficient data for 12-month analysis');
      console.log(`   Only ${days_in_range} days available (need ~365 days)`);
      console.log('   Consider importing more historical data\n');
    } else {
      console.log('✅ Sufficient data available for 12-month analysis\n');
    }
    
  } catch (error) {
    console.error('Error checking data coverage:', error);
  } finally {
    await pool.end();
  }
}

checkDataCoverage();