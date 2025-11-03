#!/usr/bin/env node
/**
 * CRYPTO BASELINE CALCULATION SCRIPT
 * 
 * Calculates daily baselines (BTC/Crypto ratios) using 5 different methods
 * Uses previous 24 hours of data for each calculation
 * 
 * Usage:
 *   node crypto-baseline-calculation.js [--date YYYY-MM-DD]
 * 
 * Examples:
 *   node crypto-baseline-calculation.js                    # Calculate for yesterday
 *   node crypto-baseline-calculation.js --date 2024-01-15  # Calculate for specific date
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false },
  max: 20
});

// Crypto symbols (must match crypto-data-import.js)
const CRYPTO_SYMBOLS = ['ETH', 'SOL', 'ADA', 'AVAX', 'DOT', 'ATOM', 'NEAR', 'ALGO'];

// Baseline calculation methods
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];

/**
 * Calculate EQUAL_MEAN baseline (simple average)
 */
async function calculateEqualMean(client, symbol, tradingDay) {
  const query = `
    SELECT 
      AVG(mbc.close / mc.close) as baseline,
      COUNT(*) as data_points
    FROM minute_crypto mc
    JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
    WHERE mc.symbol = $1
      AND mc.timestamp >= $2::timestamp - INTERVAL '24 hours'
      AND mc.timestamp < $2::timestamp
  `;
  
  const result = await client.query(query, [symbol, tradingDay]);
  return result.rows[0];
}

/**
 * Calculate VWAP_RATIO baseline (volume-weighted by crypto volume)
 */
async function calculateVWAPRatio(client, symbol, tradingDay) {
  const query = `
    SELECT 
      SUM((mbc.close / mc.close) * mc.volume) / NULLIF(SUM(mc.volume), 0) as baseline,
      COUNT(*) as data_points
    FROM minute_crypto mc
    JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
    WHERE mc.symbol = $1
      AND mc.timestamp >= $2::timestamp - INTERVAL '24 hours'
      AND mc.timestamp < $2::timestamp
      AND mc.volume > 0
  `;
  
  const result = await client.query(query, [symbol, tradingDay]);
  return result.rows[0];
}

/**
 * Calculate VOL_WEIGHTED baseline (volume-weighted by BTC volume)
 */
async function calculateVolWeighted(client, symbol, tradingDay) {
  const query = `
    SELECT 
      SUM((mbc.close / mc.close) * mbc.volume) / NULLIF(SUM(mbc.volume), 0) as baseline,
      COUNT(*) as data_points
    FROM minute_crypto mc
    JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
    WHERE mc.symbol = $1
      AND mc.timestamp >= $2::timestamp - INTERVAL '24 hours'
      AND mc.timestamp < $2::timestamp
      AND mbc.volume > 0
  `;
  
  const result = await client.query(query, [symbol, tradingDay]);
  return result.rows[0];
}

/**
 * Calculate WINSORIZED baseline (removes top/bottom 5% outliers)
 */
async function calculateWinsorized(client, symbol, tradingDay) {
  const query = `
    WITH ratios AS (
      SELECT 
        mbc.close / mc.close as ratio,
        ROW_NUMBER() OVER (ORDER BY mbc.close / mc.close) as row_num,
        COUNT(*) OVER () as total_count
      FROM minute_crypto mc
      JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
      WHERE mc.symbol = $1
        AND mc.timestamp >= $2::timestamp - INTERVAL '24 hours'
        AND mc.timestamp < $2::timestamp
    )
    SELECT 
      AVG(ratio) as baseline,
      COUNT(*) as data_points
    FROM ratios
    WHERE row_num > total_count * 0.05
      AND row_num <= total_count * 0.95
  `;
  
  const result = await client.query(query, [symbol, tradingDay]);
  return result.rows[0];
}

/**
 * Calculate WEIGHTED_MEDIAN baseline
 */
async function calculateWeightedMedian(client, symbol, tradingDay) {
  const query = `
    WITH ratios AS (
      SELECT 
        mbc.close / mc.close as ratio
      FROM minute_crypto mc
      JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
      WHERE mc.symbol = $1
        AND mc.timestamp >= $2::timestamp - INTERVAL '24 hours'
        AND mc.timestamp < $2::timestamp
      ORDER BY ratio
    )
    SELECT 
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ratio) as baseline,
      COUNT(*) as data_points
    FROM ratios
  `;
  
  const result = await client.query(query, [symbol, tradingDay]);
  return result.rows[0];
}

/**
 * Insert baseline into database
 */
async function insertBaseline(client, symbol, method, tradingDay, baseline, dataPoints) {
  const query = `
    INSERT INTO baseline_daily_crypto (symbol, method, trading_day, baseline, data_points)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (symbol, method, trading_day) 
    DO UPDATE SET 
      baseline = EXCLUDED.baseline,
      data_points = EXCLUDED.data_points,
      created_at = NOW()
  `;
  
  await client.query(query, [symbol, method, tradingDay, baseline, dataPoints]);
}

/**
 * Calculate baselines for a specific date
 */
async function calculateBaselinesForDate(tradingDay) {
  const client = await pool.connect();
  
  try {
    console.log(`\n========================================`);
    console.log(`Calculating baselines for ${tradingDay}`);
    console.log(`Using data from previous 24 hours`);
    console.log(`========================================\n`);
    
    let totalBaselines = 0;
    
    for (const symbol of CRYPTO_SYMBOLS) {
      console.log(`Processing ${symbol}...`);
      
      for (const method of METHODS) {
        let result;
        
        switch (method) {
          case 'EQUAL_MEAN':
            result = await calculateEqualMean(client, symbol, tradingDay);
            break;
          case 'VWAP_RATIO':
            result = await calculateVWAPRatio(client, symbol, tradingDay);
            break;
          case 'VOL_WEIGHTED':
            result = await calculateVolWeighted(client, symbol, tradingDay);
            break;
          case 'WINSORIZED':
            result = await calculateWinsorized(client, symbol, tradingDay);
            break;
          case 'WEIGHTED_MEDIAN':
            result = await calculateWeightedMedian(client, symbol, tradingDay);
            break;
        }
        
        if (result && result.baseline && result.data_points > 0) {
          await insertBaseline(
            client,
            symbol,
            method,
            tradingDay,
            result.baseline,
            result.data_points
          );
          totalBaselines++;
          console.log(`  ✓ ${method}: ${parseFloat(result.baseline).toFixed(4)} (${result.data_points} points)`);
        } else {
          console.log(`  ✗ ${method}: No data`);
        }
      }
      
      console.log();
    }
    
    console.log(`========================================`);
    console.log(`Baselines calculated: ${totalBaselines}`);
    console.log(`Expected: ${CRYPTO_SYMBOLS.length * METHODS.length}`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('Error calculating baselines:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate baselines for date range
 */
async function calculateBaselinesForRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let current = new Date(start);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    await calculateBaselinesForDate(dateStr);
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args[0] === '--date' && args[1]) {
      // Calculate for specific date
      await calculateBaselinesForDate(args[1]);
    } else if (args[0] === '--range' && args[1] && args[2]) {
      // Calculate for date range
      await calculateBaselinesForRange(args[1], args[2]);
    } else {
      // Calculate for yesterday (default)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      await calculateBaselinesForDate(dateStr);
    }
    
    console.log('✅ Baseline calculation completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Baseline calculation failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { calculateBaselinesForDate, calculateBaselinesForRange };