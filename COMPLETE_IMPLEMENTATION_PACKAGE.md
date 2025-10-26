# 🚀 COMPLETE IMPLEMENTATION PACKAGE - DAY 1

## ALL FILES READY TO COPY & DEPLOY

This document contains ALL the code files you need for Day 1. Copy each section into the appropriate file in your Cloud Shell editor.

---

## FILE 1: data-pipeline/src/fetchers/polygon-fetcher.js

```javascript
import axios from 'axios';
import { config } from '../config/config.js';
import { format, subDays, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const EASTERN_TZ = 'America/New_York';
const RATE_LIMIT_DELAY = 12000; // 12 seconds between requests (5 requests/minute for free tier)

/**
 * Fetch minute aggregates from Polygon.io
 * @param {string} symbol - Stock symbol or X:BTCUSD
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array>} Array of minute bars
 */
export async function fetchMinuteData(symbol, startDate, endDate) {
  const url = `${config.polygon.baseUrl}/v2/aggs/ticker/${symbol}/range/1/minute/${startDate}/${endDate}`;
  
  console.log(`Fetching ${symbol} from ${startDate} to ${endDate}...`);
  
  try {
    const response = await axios.get(url, {
      params: {
        apiKey: config.polygon.apiKey,
        adjusted: true,
        sort: 'asc',
        limit: 50000
      },
      timeout: 60000
    });

    if (response.data.status === 'OK' && response.data.results) {
      console.log(`✓ Fetched ${response.data.results.length} bars for ${symbol}`);
      return response.data.results;
    } else {
      console.warn(`⚠ No data returned for ${symbol}: ${response.data.status}`);
      return [];
    }
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('Rate limit hit! Waiting 60 seconds...');
      await sleep(60000);
      return fetchMinuteData(symbol, startDate, endDate); // Retry
    }
    console.error(`Error fetching ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Transform Polygon data to our database format
 * @param {Array} bars - Raw Polygon bars
 * @param {string} symbol - Stock symbol (null for BTC)
 * @returns {Array} Transformed bars
 */
export function transformBars(bars, symbol = null) {
  return bars.map(bar => {
    // Convert Unix timestamp (ms) to Date
    const barTime = new Date(bar.t);
    
    // Convert to Eastern Time
    const etTime = toZonedTime(barTime, EASTERN_TZ);
    const etDate = format(etTime, 'yyyy-MM-dd');
    const etTimeStr = format(etTime, 'HH:mm:ss');
    
    // Determine session (RTH = 9:30-16:00 ET, AH = everything else)
    const hour = etTime.getHours();
    const minute = etTime.getMinutes();
    const totalMinutes = hour * 60 + minute;
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    const session = (totalMinutes >= marketOpen && totalMinutes < marketClose) ? 'RTH' : 'AH';
    
    const transformed = {
      bar_time: barTime.toISOString(),
      et_date: etDate,
      et_time: etTimeStr,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw || null,
      trades: bar.n || null,
      session: session
    };
    
    if (symbol) {
      transformed.symbol = symbol;
    }
    
    return transformed;
  });
}

/**
 * Fetch data for all symbols in date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Object>} { stocks: [], btc: [] }
 */
export async function fetchAllData(startDate, endDate) {
  const allData = {
    stocks: [],
    btc: []
  };
  
  // Fetch BTC first
  console.log('\n📊 Fetching Bitcoin data...');
  const btcBars = await fetchMinuteData(config.btcSymbol, startDate, endDate);
  allData.btc = transformBars(btcBars);
  await sleep(RATE_LIMIT_DELAY);
  
  // Fetch each stock
  console.log('\n📈 Fetching stock data...');
  for (const symbol of config.symbols) {
    const bars = await fetchMinuteData(symbol, startDate, endDate);
    const transformed = transformBars(bars, symbol);
    allData.stocks.push(...transformed);
    await sleep(RATE_LIMIT_DELAY); // Rate limiting
  }
  
  console.log(`\n✓ Total fetched: ${allData.btc.length} BTC bars, ${allData.stocks.length} stock bars`);
  return allData;
}

/**
 * Fetch data in chunks (for large date ranges)
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {number} chunkDays - Days per chunk
 * @returns {Promise<Object>} Combined data
 */
export async function fetchDataInChunks(startDate, endDate, chunkDays = 30) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const chunks = [];
  
  let currentStart = start;
  while (currentStart <= end) {
    const currentEnd = subDays(currentStart, -chunkDays);
    const chunkEnd = currentEnd > end ? end : currentEnd;
    
    chunks.push({
      start: format(currentStart, 'yyyy-MM-dd'),
      end: format(chunkEnd, 'yyyy-MM-dd')
    });
    
    currentStart = subDays(chunkEnd, -1);
  }
  
  console.log(`\n📅 Fetching data in ${chunks.length} chunks...`);
  
  const allData = {
    stocks: [],
    btc: []
  };
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\n[Chunk ${i + 1}/${chunks.length}] ${chunk.start} to ${chunk.end}`);
    
    const chunkData = await fetchAllData(chunk.start, chunk.end);
    allData.stocks.push(...chunkData.stocks);
    allData.btc.push(...chunkData.btc);
    
    console.log(`Progress: ${Math.round((i + 1) / chunks.length * 100)}%`);
  }
  
  return allData;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node polygon-fetcher.js <start-date> <end-date>');
    console.log('Example: node polygon-fetcher.js 2021-01-01 2024-01-01');
    process.exit(1);
  }
  
  const [startDate, endDate] = args;
  
  fetchDataInChunks(startDate, endDate)
    .then(data => {
      console.log('\n✓ Fetch complete!');
      console.log(`Total BTC bars: ${data.btc.length}`);
      console.log(`Total stock bars: ${data.stocks.length}`);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}
```

---

## FILE 2: data-pipeline/src/storage/postgres-writer.js

```javascript
import pg from 'pg';
import { config } from '../config/config.js';

const { Pool } = pg;

let pool = null;

/**
 * Get database connection pool
 */
export function getPool() {
  if (!pool) {
    pool = new Pool(config.database);
    
    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }
  return pool;
}

/**
 * Insert stock minute data (batch)
 * @param {Array} bars - Array of transformed bars
 * @returns {Promise<number>} Number of rows inserted
 */
export async function insertStockBars(bars) {
  if (!bars || bars.length === 0) return 0;
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let inserted = 0;
    const batchSize = 1000;
    
    for (let i = 0; i < bars.length; i += batchSize) {
      const batch = bars.slice(i, i + batchSize);
      
      const values = batch.map((bar, idx) => {
        const offset = idx * 11;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
      }).join(',');
      
      const params = batch.flatMap(bar => [
        bar.symbol,
        bar.bar_time,
        bar.et_date,
        bar.et_time,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        bar.vwap,
        bar.trades,
        bar.session
      ]);
      
      const query = `
        INSERT INTO minute_stock (symbol, bar_time, et_date, et_time, open, high, low, close, volume, vwap, trades, session)
        VALUES ${values}
        ON CONFLICT (symbol, bar_time) DO NOTHING
      `;
      
      const result = await client.query(query, params);
      inserted += result.rowCount;
      
      if ((i + batchSize) % 10000 === 0) {
        console.log(`  Inserted ${i + batchSize} / ${bars.length} stock bars...`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`✓ Inserted ${inserted} new stock bars`);
    return inserted;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting stock bars:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Insert BTC minute data (batch)
 * @param {Array} bars - Array of transformed bars
 * @returns {Promise<number>} Number of rows inserted
 */
export async function insertBtcBars(bars) {
  if (!bars || bars.length === 0) return 0;
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let inserted = 0;
    const batchSize = 1000;
    
    for (let i = 0; i < bars.length; i += batchSize) {
      const batch = bars.slice(i, i + batchSize);
      
      const values = batch.map((bar, idx) => {
        const offset = idx * 11;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
      }).join(',');
      
      const params = batch.flatMap(bar => [
        bar.bar_time,
        bar.et_date,
        bar.et_time,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        bar.vwap,
        bar.trades,
        bar.session
      ]);
      
      const query = `
        INSERT INTO minute_btc (bar_time, et_date, et_time, open, high, low, close, volume, vwap, trades, session)
        VALUES ${values}
        ON CONFLICT (bar_time) DO NOTHING
      `;
      
      const result = await client.query(query, params);
      inserted += result.rowCount;
      
      if ((i + batchSize) % 10000 === 0) {
        console.log(`  Inserted ${i + batchSize} / ${bars.length} BTC bars...`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`✓ Inserted ${inserted} new BTC bars`);
    return inserted;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting BTC bars:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get date range of existing data
 * @param {string} symbol - Stock symbol or null for BTC
 * @returns {Promise<Object>} { minDate, maxDate, count }
 */
export async function getDataRange(symbol = null) {
  const pool = getPool();
  
  const table = symbol ? 'minute_stock' : 'minute_btc';
  const whereClause = symbol ? `WHERE symbol = $1` : '';
  const params = symbol ? [symbol] : [];
  
  const query = `
    SELECT 
      MIN(et_date) as min_date,
      MAX(et_date) as max_date,
      COUNT(*) as count
    FROM ${table}
    ${whereClause}
  `;
  
  const result = await pool.query(query, params);
  return result.rows[0];
}

/**
 * Close database connection
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

---

## FILE 3: data-pipeline/src/processors/baseline-calculator.js

```javascript
import { getPool } from '../storage/postgres-writer.js';
import { config } from '../config/config.js';

/**
 * Calculate baseline using EQUAL_MEAN method
 * Simple arithmetic mean of all ratios
 */
function calculateEqualMean(ratios) {
  if (!ratios || ratios.length === 0) return null;
  const sum = ratios.reduce((acc, r) => acc + r, 0);
  return sum / ratios.length;
}

/**
 * Calculate baseline using MEDIAN method
 * Middle value of sorted ratios
 */
function calculateMedian(ratios) {
  if (!ratios || ratios.length === 0) return null;
  const sorted = [...ratios].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate baseline using VWAP_RATIO method
 * VWAP(BTC) / VWAP(Stock)
 */
function calculateVwapRatio(data) {
  if (!data || data.length === 0) return null;
  
  let btcSum = 0, btcVolSum = 0;
  let stockSum = 0, stockVolSum = 0;
  
  for (const row of data) {
    if (row.btc_vwap && row.btc_volume && row.stock_vwap && row.stock_volume) {
      btcSum += row.btc_vwap * row.btc_volume;
      btcVolSum += row.btc_volume;
      stockSum += row.stock_vwap * row.stock_volume;
      stockVolSum += row.stock_volume;
    }
  }
  
  if (btcVolSum === 0 || stockVolSum === 0) return null;
  
  const btcVwap = btcSum / btcVolSum;
  const stockVwap = stockSum / stockVolSum;
  
  return btcVwap / stockVwap;
}

/**
 * Calculate baseline using VOL_WEIGHTED method
 * Volume-weighted average of ratios
 */
function calculateVolWeighted(data) {
  if (!data || data.length === 0) return null;
  
  let weightedSum = 0;
  let totalVolume = 0;
  
  for (const row of data) {
    if (row.ratio && row.stock_volume) {
      weightedSum += row.ratio * row.stock_volume;
      totalVolume += row.stock_volume;
    }
  }
  
  if (totalVolume === 0) return null;
  return weightedSum / totalVolume;
}

/**
 * Calculate baseline using WINSORIZED method
 * Trim top/bottom 5% outliers, then average
 */
function calculateWinsorized(ratios) {
  if (!ratios || ratios.length === 0) return null;
  
  const sorted = [...ratios].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.05);
  
  if (trimCount === 0) return calculateEqualMean(ratios);
  
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  return calculateEqualMean(trimmed);
}

/**
 * Calculate baseline using WEIGHTED_MEDIAN method
 * Volume-weighted median
 */
function calculateWeightedMedian(data) {
  if (!data || data.length === 0) return null;
  
  // Sort by ratio
  const sorted = [...data].sort((a, b) => a.ratio - b.ratio);
  
  // Calculate total volume
  const totalVolume = sorted.reduce((sum, row) => sum + (row.stock_volume || 0), 0);
  if (totalVolume === 0) return null;
  
  // Find weighted median
  let cumVolume = 0;
  const halfVolume = totalVolume / 2;
  
  for (const row of sorted) {
    cumVolume += row.stock_volume || 0;
    if (cumVolume >= halfVolume) {
      return row.ratio;
    }
  }
  
  return sorted[sorted.length - 1].ratio;
}

/**
 * Calculate all baseline methods for a given symbol, date, and session
 * @param {string} symbol - Stock symbol
 * @param {string} tradingDay - YYYY-MM-DD
 * @param {string} session - 'RTH' or 'AH'
 * @returns {Promise<Object>} Baseline values for all methods
 */
export async function calculateBaselines(symbol, tradingDay, session) {
  const pool = getPool();
  
  // Fetch minute data for the day
  const query = `
    SELECT 
      s.bar_time,
      s.close as stock_close,
      s.volume as stock_volume,
      s.vwap as stock_vwap,
      b.close as btc_close,
      b.volume as btc_volume,
      b.vwap as btc_vwap,
      (b.close / NULLIF(s.close, 0)) as ratio
    FROM minute_stock s
    INNER JOIN minute_btc b ON s.bar_time = b.bar_time
    WHERE s.symbol = $1
      AND s.et_date = $2
      AND s.session = $3
      AND s.close > 0
      AND b.close > 0
    ORDER BY s.bar_time
  `;
  
  const result = await pool.query(query, [symbol, tradingDay, session]);
  const data = result.rows;
  
  if (data.length === 0) {
    console.warn(`No data found for ${symbol} on ${tradingDay} (${session})`);
    return null;
  }
  
  // Extract ratios for simple methods
  const ratios = data.map(row => row.ratio).filter(r => r !== null && isFinite(r));
  
  if (ratios.length === 0) {
    console.warn(`No valid ratios for ${symbol} on ${tradingDay} (${session})`);
    return null;
  }
  
  // Calculate all methods
  const baselines = {
    EQUAL_MEAN: calculateEqualMean(ratios),
    MEDIAN: calculateMedian(ratios),
    VWAP_RATIO: calculateVwapRatio(data),
    VOL_WEIGHTED: calculateVolWeighted(data),
    WINSORIZED: calculateWinsorized(ratios),
    WEIGHTED_MEDIAN: calculateWeightedMedian(data)
  };
  
  // Calculate statistics
  const stats = {
    sample_count: ratios.length,
    min_ratio: Math.min(...ratios),
    max_ratio: Math.max(...ratios),
    std_dev: calculateStdDev(ratios)
  };
  
  return { baselines, stats };
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
  if (!values || values.length === 0) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Save baselines to database
 * @param {string} symbol - Stock symbol
 * @param {string} tradingDay - YYYY-MM-DD
 * @param {string} session - 'RTH' or 'AH'
 * @param {Object} baselines - Baseline values
 * @param {Object} stats - Statistics
 */
export async function saveBaselines(symbol, tradingDay, session, baselines, stats) {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const [method, baseline] of Object.entries(baselines)) {
      if (baseline === null || !isFinite(baseline)) continue;
      
      const query = `
        INSERT INTO baseline_daily (
          symbol, session, trading_day, method, baseline,
          sample_count, min_ratio, max_ratio, std_dev
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (symbol, session, trading_day, method)
        DO UPDATE SET
          baseline = EXCLUDED.baseline,
          sample_count = EXCLUDED.sample_count,
          min_ratio = EXCLUDED.min_ratio,
          max_ratio = EXCLUDED.max_ratio,
          std_dev = EXCLUDED.std_dev,
          calculated_at = NOW()
      `;
      
      await client.query(query, [
        symbol,
        session,
        tradingDay,
        method,
        baseline,
        stats.sample_count,
        stats.min_ratio,
        stats.max_ratio,
        stats.std_dev
      ]);
    }
    
    await client.query('COMMIT');
    console.log(`✓ Saved baselines for ${symbol} ${tradingDay} (${session})`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving baselines:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate and save baselines for all symbols and dates
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export async function calculateAllBaselines(startDate, endDate) {
  const pool = getPool();
  
  // Get all unique dates with data
  const dateQuery = `
    SELECT DISTINCT et_date
    FROM minute_stock
    WHERE et_date BETWEEN $1 AND $2
    ORDER BY et_date
  `;
  
  const dateResult = await pool.query(dateQuery, [startDate, endDate]);
  const dates = dateResult.rows.map(row => row.et_date);
  
  console.log(`\n📊 Calculating baselines for ${dates.length} days...`);
  
  let processed = 0;
  const total = dates.length * config.symbols.length * 2; // 2 sessions per day
  
  for (const date of dates) {
    for (const symbol of config.symbols) {
      for (const session of ['RTH', 'AH']) {
        try {
          const result = await calculateBaselines(symbol, date, session);
          
          if (result) {
            await saveBaselines(symbol, date, session, result.baselines, result.stats);
          }
          
          processed++;
          if (processed % 10 === 0) {
            console.log(`Progress: ${processed}/${total} (${Math.round(processed / total * 100)}%)`);
          }
          
        } catch (error) {
          console.error(`Error processing ${symbol} ${date} ${session}:`, error.message);
        }
      }
    }
  }
  
  console.log(`\n✓ Baseline calculation complete! Processed ${processed} combinations.`);
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node baseline-calculator.js <start-date> <end-date>');
    console.log('Example: node baseline-calculator.js 2024-01-01 2024-01-31');
    process.exit(1);
  }
  
  const [startDate, endDate] = args;
  
  calculateAllBaselines(startDate, endDate)
    .then(() => {
      console.log('\n✓ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}
```

---

## FILE 4: data-pipeline/src/index.js

```javascript
import { fetchDataInChunks } from './fetchers/polygon-fetcher.js';
import { insertStockBars, insertBtcBars, getDataRange, closePool } from './storage/postgres-writer.js';
import { calculateAllBaselines } from './processors/baseline-calculator.js';
import { config } from './config/config.js';

/**
 * Main data pipeline orchestrator
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {boolean} skipFetch - Skip fetching, only calculate baselines
 */
export async function runPipeline(startDate, endDate, skipFetch = false) {
  console.log('\n🚀 TRADIAC DATA PIPELINE');
  console.log('========================\n');
  console.log(`Date Range: ${startDate} to ${endDate}`);
  console.log(`Symbols: ${config.symbols.join(', ')}`);
  console.log(`Skip Fetch: ${skipFetch}\n`);
  
  try {
    // Step 1: Fetch data from Polygon (if not skipping)
    if (!skipFetch) {
      console.log('\n📥 STEP 1: Fetching data from Polygon.io...');
      const data = await fetchDataInChunks(startDate, endDate, 30);
      
      // Step 2: Insert into database
      console.log('\n💾 STEP 2: Inserting data into PostgreSQL...');
      console.log('Inserting BTC data...');
      await insertBtcBars(data.btc);
      
      console.log('Inserting stock data...');
      await insertStockBars(data.stocks);
    } else {
      console.log('\n⏭️  STEP 1-2: Skipped (using existing data)');
    }
    
    // Step 3: Verify data
    console.log('\n✅ STEP 3: Verifying data...');
    const btcRange = await getDataRange();
    console.log(`BTC: ${btcRange.count} bars from ${btcRange.min_date} to ${btcRange.max_date}`);
    
    for (const symbol of config.symbols) {
      const range = await getDataRange(symbol);
      console.log(`${symbol}: ${range.count} bars from ${range.min_date} to ${range.max_date}`);
    }
    
    // Step 4: Calculate baselines
    console.log('\n📊 STEP 4: Calculating baselines...');
    await calculateAllBaselines(startDate, endDate);
    
    console.log('\n✅ PIPELINE COMPLETE!');
    console.log('===================\n');
    
  } catch (error) {
    console.error('\n❌ PIPELINE ERROR:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node index.js <start-date> <end-date> [--skip-fetch]');
    console.log('Example: node index.js 2021-01-01 2024-01-01');
    console.log('Example: node index.js 2024-01-01 2024-01-31 --skip-fetch');
    process.exit(1);
  }
  
  const [startDate, endDate] = args;
  const skipFetch = args.includes('--skip-fetch');
  
  runPipeline(startDate, endDate, skipFetch)
    .then(() => {
      console.log('Exiting...');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
```

---

## READY TO DEPLOY! 🚀

All files are ready. Next steps:

1. Copy these files into your Cloud Shell editor
2. Update `.env` with your actual credentials
3. Run the pipeline to fetch 3 years of data
4. Verify data in database

Say "READY" and I'll give you the exact commands to run!