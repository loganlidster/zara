#!/bin/bash
# BLOCK 1: Create Updated Event Generation Script
# This creates crypto-event-generation.js with 13x13 combos, Oct 2024-Nov 2025, 19 symbols

cd ~/zara/cloudshell_crypto

cat > crypto-event-generation.js << 'ENDOFFILE'
#!/usr/bin/env node
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
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
const METHOD = process.env.METHOD;
const START_DATE = process.env.START_DATE || '2024-10-01';
const END_DATE = process.env.END_DATE || '2025-11-02';
const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP'];
const BATCH_SIZE = 1500;
function generateCombinations() {
  const combinations = [];
  const thresholds = [0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0];
  for (const buy of thresholds) {
    for (const sell of thresholds) {
      combinations.push({ buy_pct: buy, sell_pct: sell });
    }
  }
  console.log(`Custom thresholds: ${thresholds.join(', ')}`);
  console.log(`Total combinations: ${combinations.length} (${thresholds.length}×${thresholds.length})`);
  return combinations;
}
const COMBINATIONS = generateCombinations();
function getTableName(method) {
  return `trade_events_crypto_${method.toLowerCase()}`;
}
const TABLE_NAME = getTableName(METHOD);
console.log('\n========================================');
console.log(`Crypto Event Generation`);
console.log(`Table: ${TABLE_NAME}`);
console.log(`Method: ${METHOD}`);
console.log(`Date range: ${START_DATE} to ${END_DATE}`);
console.log(`Symbols: ${CRYPTO_SYMBOLS.length} cryptos`);
console.log(`Combinations: ${COMBINATIONS.length}`);
console.log(`Batch size: ${BATCH_SIZE} events per INSERT`);
console.log(`========================================\n`);
async function fetchMinuteDataWithBaselines(symbol, buyPct, sellPct) {
  const query = `
    SELECT 
      mc.timestamp as event_timestamp,
      mc.close as crypto_price,
      mbc.close as btc_price,
      (mbc.close / mc.close) as ratio,
      bdc.baseline_${METHOD.toLowerCase()} as baseline
    FROM minute_crypto mc
    JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
    JOIN baseline_daily_crypto bdc ON mc.symbol = bdc.symbol AND mc.timestamp::date = bdc.trading_day AND bdc.method = $1
    WHERE mc.symbol = $2 AND mc.timestamp::date >= $3 AND mc.timestamp::date <= $4
    ORDER BY mc.timestamp
  `;
  const result = await pool.query(query, [METHOD, symbol, START_DATE, END_DATE]);
  return result.rows;
}
function generateEvents(minuteData, symbol, buyPct, sellPct) {
  const events = [];
  let position = null;
  for (const bar of minuteData) {
    const { event_timestamp, crypto_price, btc_price, ratio, baseline } = bar;
    if (!baseline || baseline === 0) continue;
    const deviationPct = ((ratio - baseline) / baseline) * 100;
    if (position === null) {
      if (deviationPct >= buyPct) {
        events.push({ symbol, buy_pct: buyPct, sell_pct: sellPct, event_timestamp, event_type: 'BUY', crypto_price, btc_price, ratio, baseline, trade_roi_pct: null });
        position = 'BUY';
      }
    } else if (position === 'BUY') {
      if (deviationPct <= sellPct) {
        const buyEvent = events[events.length - 1];
        const roi = ((crypto_price - buyEvent.crypto_price) / buyEvent.crypto_price) * 100;
        events.push({ symbol, buy_pct: buyPct, sell_pct: sellPct, event_timestamp, event_type: 'SELL', crypto_price, btc_price, ratio, baseline, trade_roi_pct: roi });
        buyEvent.trade_roi_pct = roi;
        position = null;
      }
    }
  }
  return events;
}
async function insertEventsBatch(events) {
  if (events.length === 0) return 0;
  const batches = [];
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    batches.push(events.slice(i, i + BATCH_SIZE));
  }
  let totalInserted = 0;
  for (const batch of batches) {
    const values = [];
    const placeholders = [];
    let paramIndex = 1;
    for (const event of batch) {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`);
      values.push(event.symbol, event.buy_pct, event.sell_pct, event.event_timestamp, event.event_type, event.crypto_price, event.btc_price, event.ratio, event.baseline, event.trade_roi_pct);
      paramIndex += 10;
    }
    const query = `INSERT INTO ${TABLE_NAME} (symbol, buy_pct, sell_pct, event_timestamp, event_type, crypto_price, btc_price, ratio, baseline, trade_roi_pct) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;
    await pool.query(query, values);
    totalInserted += batch.length;
  }
  return totalInserted;
}
async function processSymbol(symbol) {
  console.log(`\nProcessing ${symbol}...`);
  let totalEvents = 0;
  for (let i = 0; i < COMBINATIONS.length; i++) {
    const { buy_pct, sell_pct } = COMBINATIONS[i];
    if (i % 20 === 0) {
      console.log(`  ${symbol}: Processing combination ${i + 1}/${COMBINATIONS.length} (buy=${buy_pct}%, sell=${sell_pct}%)`);
    }
    const minuteData = await fetchMinuteDataWithBaselines(symbol, buy_pct, sell_pct);
    const events = generateEvents(minuteData, symbol, buy_pct, sell_pct);
    const inserted = await insertEventsBatch(events);
    totalEvents += inserted;
  }
  console.log(`  ${symbol}: Generated ${totalEvents.toLocaleString()} events`);
  return totalEvents;
}
async function main() {
  try {
    console.log('Starting crypto event generation...\n');
    let grandTotal = 0;
    for (const symbol of CRYPTO_SYMBOLS) {
      const symbolTotal = await processSymbol(symbol);
      grandTotal += symbolTotal;
    }
    console.log('\n========================================');
    console.log(`COMPLETE: Generated ${grandTotal.toLocaleString()} total events`);
    console.log(`Table: ${TABLE_NAME}`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error('Error generating events:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
main();
ENDOFFILE

echo "✅ Script created with 13x13 combos, Oct 2024-Nov 2025"