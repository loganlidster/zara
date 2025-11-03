#!/usr/bin/env node
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const METHOD = process.env.METHOD;
const START_DATE = '2024-10-01';
const END_DATE = '2025-11-02';
const BATCH_SIZE = 5000;
const THRESHOLDS = [0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];

function generateCombinations() {
  const combinations = [];
  for (const buy of THRESHOLDS) {
    for (const sell of THRESHOLDS) {
      combinations.push({ buy_pct: buy, sell_pct: sell });
    }
  }
  return combinations;
}

const COMBINATIONS = generateCombinations();
const TABLE_NAME = `trade_events_crypto_${METHOD.toLowerCase()}`;

console.log('\n========================================');
console.log(`Method: ${METHOD}, Combinations: ${COMBINATIONS.length}`);
console.log(`Batch size: ${BATCH_SIZE}`);
console.log('========================================\n');

async function getLastEventState(client, symbol, buyPct, sellPct, beforeDate) {
  const result = await client.query(`
    SELECT event_type FROM ${TABLE_NAME}
    WHERE symbol = $1 AND buy_pct = $2 AND sell_pct = $3 AND event_timestamp < $4
    ORDER BY event_timestamp DESC LIMIT 1
  `, [symbol, buyPct, sellPct, beforeDate]);
  return result.rows.length === 0 ? true : result.rows[0].event_type === 'SELL';
}

function simulateTrading(minuteData, buyPct, sellPct, expectingBuy) {
  const events = [];
  let lastBuyPrice = null;
  for (const bar of minuteData) {
    const ratio = bar.btc_close / bar.crypto_close;
    const baseline = bar.baseline;
    
    // CORRECT FORMULAS:
    const buyThreshold = baseline * (1 + buyPct / 100);   // Buy when ratio is HIGH (above baseline)
    const sellThreshold = baseline * (1 - sellPct / 100); // Sell when ratio is LOW (below baseline)
    
    if (expectingBuy && ratio >= buyThreshold) {
      lastBuyPrice = bar.crypto_close;
      events.push({
        event_timestamp: bar.timestamp, 
        event_type: 'BUY',
        crypto_price: bar.crypto_close, 
        btc_price: bar.btc_close,
        ratio: ratio, 
        baseline: baseline, 
        trade_roi_pct: null
      });
      expectingBuy = false;
    } else if (!expectingBuy && ratio <= sellThreshold && lastBuyPrice) {
      const roi = ((bar.crypto_close - lastBuyPrice) / lastBuyPrice) * 100;
      events.push({
        event_timestamp: bar.timestamp, 
        event_type: 'SELL',
        crypto_price: bar.crypto_close, 
        btc_price: bar.btc_close,
        ratio: ratio, 
        baseline: baseline, 
        trade_roi_pct: roi
      });
      expectingBuy = true;
      lastBuyPrice = null;
    }
  }
  return events;
}

async function insertEventsBatch(client, symbol, buyPct, sellPct, events) {
  if (events.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const values = batch.map((_, idx) => {
      const offset = idx * 10;
      return `($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9},$${offset+10})`;
    }).join(',');
    const params = [];
    for (const event of batch) {
      params.push(symbol, buyPct, sellPct, event.event_timestamp, event.event_type,
        event.crypto_price, event.btc_price, event.ratio, event.baseline, event.trade_roi_pct);
    }
    const result = await client.query(`
      INSERT INTO ${TABLE_NAME} (symbol, buy_pct, sell_pct, event_timestamp, event_type,
        crypto_price, btc_price, ratio, baseline, trade_roi_pct)
      VALUES ${values}
    `, params);
    inserted += result.rowCount;
  }
  return inserted;
}

async function processEvents() {
  const client = await pool.connect();
  try {
    const startTime = Date.now();
    const symbolsResult = await client.query('SELECT DISTINCT symbol FROM minute_crypto ORDER BY symbol');
    const symbols = symbolsResult.rows.map(r => r.symbol);
    console.log(`Processing ${symbols.length} symbols...\n`);
    let totalEvents = 0;
    for (const symbol of symbols) {
      const symbolStart = Date.now();
      console.log(`\n=== ${symbol} ===`);
      const dataResult = await client.query(`
        SELECT mc.timestamp, mc.close as crypto_close, mbc.close as btc_close, bd.baseline
        FROM minute_crypto mc
        JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
        JOIN baseline_daily_crypto bd ON DATE(mc.timestamp) = bd.trading_day 
          AND mc.symbol = bd.symbol AND bd.method = $1
        WHERE mc.symbol = $2 AND DATE(mc.timestamp) >= $3 AND DATE(mc.timestamp) <= $4
        ORDER BY mc.timestamp
      `, [METHOD, symbol, START_DATE, END_DATE]);
      if (dataResult.rows.length === 0) continue;
      let symbolEvents = 0;
      for (const combo of COMBINATIONS) {
        const expectingBuy = await getLastEventState(client, symbol, combo.buy_pct, combo.sell_pct, START_DATE);
        const events = simulateTrading(dataResult.rows, combo.buy_pct, combo.sell_pct, expectingBuy);
        if (events.length > 0) {
          const inserted = await insertEventsBatch(client, symbol, combo.buy_pct, combo.sell_pct, events);
          symbolEvents += inserted;
          totalEvents += inserted;
        }
      }
      const symbolTime = ((Date.now() - symbolStart) / 1000).toFixed(1);
      console.log(`  ✓ ${symbolEvents.toLocaleString()} events in ${symbolTime}s`);
    }
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n✅ COMPLETE: ${totalEvents.toLocaleString()} events in ${totalTime} min\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

processEvents().catch(console.error);