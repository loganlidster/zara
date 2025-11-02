#!/usr/bin/env node
/**
 * CRYPTO DATA IMPORT SCRIPT
 * 
 * Fetches minute-by-minute crypto and BTC data from Binance
 * Runs hourly to collect the last hour's data
 * 
 * Usage:
 *   node crypto-data-import.js [--backfill YYYY-MM-DD]
 * 
 * Examples:
 *   node crypto-data-import.js                    # Import last hour
 *   node crypto-data-import.js --backfill 2024-01-01  # Backfill from date
 */

import pg from 'pg';
import axios from 'axios';
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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Crypto symbols to track (available on Coinbase)
const CRYPTO_SYMBOLS = [
  'ETHUSDT',   // Ethereum
  'SOLUSDT',   // Solana
  'ADAUSDT',   // Cardano
  'AVAXUSDT',  // Avalanche
  'DOTUSDT',   // Polkadot
  'ATOMUSDT',  // Cosmos
  'NEARUSDT',  // Near Protocol
  'ALGOUSDT'   // Algorand
  // Note: MATIC and FTM not available on Coinbase
];

// Coinbase API configuration (US-based, no geo-restrictions)
const COINBASE_API_BASE = 'https://api.exchange.coinbase.com';

/**
 * Fetch minute candles from Coinbase
 * Note: Coinbase returns max 300 candles per request
 */
async function fetchCoinbaseCandles(symbol, startTime, endTime) {
  try {
    // Convert symbol format: ETHUSDT -> ETH-USD
    const coinbaseSymbol = symbol.replace('USDT', '-USD');
    
    // Coinbase uses ISO 8601 format
    const start = new Date(startTime).toISOString();
    const end = new Date(endTime).toISOString();
    
    const response = await axios.get(`${COINBASE_API_BASE}/products/${coinbaseSymbol}/candles`, {
      params: {
        start: start,
        end: end,
        granularity: 60  // 60 seconds = 1 minute
      }
    });
    
    // Coinbase returns: [time, low, high, open, close, volume]
    return response.data.map(candle => ({
      timestamp: new Date(candle[0] * 1000),  // Convert Unix timestamp to Date
      open: parseFloat(candle[3]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[1]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    })).reverse();  // Coinbase returns newest first, we want oldest first
    
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Insert crypto minute bars into database
 */
async function insertCryptoBars(client, symbol, bars) {
  if (bars.length === 0) return 0;
  
  // Remove USDT suffix for database storage
  const cleanSymbol = symbol.replace('USDT', '');
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const bar of bars) {
    values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6})`);
    params.push(
      cleanSymbol,
      bar.timestamp,
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.volume
    );
    paramIndex += 7;
  }
  
  const query = `
    INSERT INTO minute_crypto (symbol, timestamp, open, high, low, close, volume)
    VALUES ${values.join(', ')}
    ON CONFLICT (symbol, timestamp) DO NOTHING
  `;
  
  const result = await client.query(query, params);
  return result.rowCount;
}

/**
 * Insert BTC minute bars into database
 */
async function insertBTCBars(client, bars) {
  if (bars.length === 0) return 0;
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const bar of bars) {
    values.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5})`);
    params.push(
      bar.timestamp,
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.volume
    );
    paramIndex += 6;
  }
  
  const query = `
    INSERT INTO minute_btc_crypto (timestamp, open, high, low, close, volume)
    VALUES ${values.join(', ')}
    ON CONFLICT (timestamp) DO NOTHING
  `;
  
  const result = await client.query(query, params);
  return result.rowCount;
}

/**
 * Import data for a specific time range
 */
async function importDataForRange(startTime, endTime) {
  const client = await pool.connect();
  
  try {
    console.log(`\n========================================`);
    console.log(`Importing data from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    console.log(`========================================\n`);
    
    // 1. Fetch and insert BTC data first
    console.log('Fetching BTC data...');
    const btcBars = await fetchCoinbaseCandles('BTCUSDT', startTime, endTime);
    const btcInserted = await insertBTCBars(client, btcBars);
    console.log(`✓ BTC: ${btcInserted} bars inserted (${btcBars.length} fetched)\n`);
    
    // 2. Fetch and insert crypto data
    let totalCryptoInserted = 0;
    
    for (const symbol of CRYPTO_SYMBOLS) {
      console.log(`Fetching ${symbol}...`);
      const cryptoBars = await fetchCoinbaseCandles(symbol, startTime, endTime);
      const inserted = await insertCryptoBars(client, symbol, cryptoBars);
      totalCryptoInserted += inserted;
      console.log(`✓ ${symbol}: ${inserted} bars inserted (${cryptoBars.length} fetched)`);
      
      // Rate limiting - wait 500ms between requests (Coinbase has stricter limits)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n========================================`);
    console.log(`Import Complete`);
    console.log(`BTC bars: ${btcInserted}`);
    console.log(`Crypto bars: ${totalCryptoInserted}`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('Error during import:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Import last hour of data (for hourly cron job)
 */
async function importLastHour() {
  const endTime = Date.now();
  const startTime = endTime - (60 * 60 * 1000);  // 1 hour ago
  
  await importDataForRange(startTime, endTime);
}

/**
 * Backfill historical data from a specific date
 */
async function backfillFromDate(startDate) {
  const start = new Date(startDate).getTime();
  const end = Date.now();
  
  // Binance allows max 1000 candles per request (1000 minutes = ~16.7 hours)
  // So we'll fetch in 12-hour chunks
  const chunkSize = 12 * 60 * 60 * 1000;  // 12 hours in milliseconds
  
  let currentStart = start;
  
  while (currentStart < end) {
    const currentEnd = Math.min(currentStart + chunkSize, end);
    
    await importDataForRange(currentStart, currentEnd);
    
    currentStart = currentEnd;
    
    // Wait 1 second between chunks to avoid rate limiting
    if (currentStart < end) {
      console.log('Waiting 1 second before next chunk...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args[0] === '--backfill' && args[1]) {
      // Backfill mode
      console.log(`Starting backfill from ${args[1]}...`);
      await backfillFromDate(args[1]);
    } else {
      // Hourly import mode
      console.log('Starting hourly import...');
      await importLastHour();
    }
    
    console.log('✅ Import completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importLastHour, backfillFromDate };