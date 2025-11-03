#!/bin/bash
# Restart crypto event generation with 0.2% increments (225 combos instead of 900)

cd ~/crypto-events

echo "========================================="
echo "Updating to 0.2% increments (225 combos)"
echo "========================================="

# Update JavaScript file
cat > crypto-event-generation.js << 'JSEOF'
#!/usr/bin/env node
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const METHOD = process.env.METHOD;
const BUY_MAX = parseFloat(process.env.BUY_MAX || '3.0');
const SELL_MIN = parseFloat(process.env.SELL_MIN || '0.2');
const SELL_MAX = parseFloat(process.env.SELL_MAX || '3.0');
const START_DATE = process.env.START_DATE || '2024-05-01';
const END_DATE = process.env.END_DATE || '2025-11-02';
const BATCH_SIZE = 1500;

function generateCombinations() {
  const combinations = [];
  const buyStart = Math.round(SELL_MIN * 5);
  const buyEnd = Math.round(BUY_MAX * 5);
  const sellStart = Math.round(SELL_MIN * 5);
  const sellEnd = Math.round(SELL_MAX * 5);
  for (let buy = buyStart; buy <= buyEnd; buy++) {
    for (let sell = sellStart; sell <= sellEnd; sell++) {
      combinations.push({ buy_pct: buy / 5, sell_pct: sell / 5 });
    }
  }
  return combinations;
}

const COMBINATIONS = generateCombinations();
const TABLE_NAME = `trade_events_crypto_${METHOD.toLowerCase()}`;

console.log('\n========================================');
console.log(`Crypto Event Generation - Table: ${TABLE_NAME}`);
console.log(`Method: ${METHOD}, Combinations: ${COMBINATIONS.length}`);
console.log(`Increment: 0.2% (reduced from 0.1%)`);
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
  for (const bar of minuteData) {
    const ratio = bar.btc_close / bar.crypto_close;
    const buyThreshold = bar.baseline * (1 + buyPct / 100);
    const sellThreshold = bar.baseline * (1 + sellPct / 100);
    if (expectingBuy && ratio >= buyThreshold) {
      events.push({
        event_timestamp: bar.timestamp, event_type: 'BUY',
        crypto_price: Math.round(bar.crypto_close * 100000000) / 100000000,
        btc_price: Math.round(bar.btc_close * 100) / 100,
        ratio: Math.round(ratio * 10000) / 10000,
        baseline: Math.round(bar.baseline * 10000) / 10000,
        trade_roi_pct: null
      });
      expectingBuy = false;
    } else if (!expectingBuy && ratio <= sellThreshold) {
      events.push({
        event_timestamp: bar.timestamp, event_type: 'SELL',
        crypto_price: Math.round(bar.crypto_close * 100000000) / 100000000,
        btc_price: Math.round(bar.btc_close * 100) / 100,
        ratio: Math.round(ratio * 10000) / 10000,
        baseline: Math.round(bar.baseline * 10000) / 10000,
        trade_roi_pct: null
      });
      expectingBuy = true;
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
      ON CONFLICT (symbol, buy_pct, sell_pct, event_timestamp) DO NOTHING
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
      console.log(`\n=== Processing ${symbol} ===`);
      const dataResult = await client.query(`
        SELECT mc.timestamp, mc.close as crypto_close, mbc.close as btc_close, bd.baseline
        FROM minute_crypto mc
        JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
        JOIN baseline_daily_crypto bd ON DATE(mc.timestamp) = bd.trading_day 
          AND mc.symbol = bd.symbol AND bd.method = $1
        WHERE mc.symbol = $2 AND DATE(mc.timestamp) >= $3 AND DATE(mc.timestamp) <= $4
        ORDER BY mc.timestamp
      `, [METHOD, symbol, START_DATE, END_DATE]);
      console.log(`  Loaded ${dataResult.rows.length} data points`);
      if (dataResult.rows.length === 0) continue;
      let symbolEvents = 0, processedCombos = 0;
      for (const combo of COMBINATIONS) {
        const expectingBuy = await getLastEventState(client, symbol, combo.buy_pct, combo.sell_pct, START_DATE);
        const events = simulateTrading(dataResult.rows, combo.buy_pct, combo.sell_pct, expectingBuy);
        if (events.length > 0) {
          const inserted = await insertEventsBatch(client, symbol, combo.buy_pct, combo.sell_pct, events);
          symbolEvents += inserted;
          totalEvents += inserted;
        }
        processedCombos++;
        if (processedCombos % 50 === 0) {
          console.log(`  Progress: ${processedCombos}/${COMBINATIONS.length} combos, ${symbolEvents.toLocaleString()} events`);
        }
      }
      console.log(`  ✓ ${symbol} complete: ${symbolEvents.toLocaleString()} events`);
    }
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n========================================');
    console.log(`✅ COMPLETE! Total: ${totalEvents.toLocaleString()} events, Time: ${elapsed} min`);
    console.log('========================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

processEvents().catch(console.error);
JSEOF

echo "✅ JavaScript updated"
echo ""

# Rebuild image
echo "Rebuilding Docker image..."
gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-job

# Update job
echo ""
echo "Updating Cloud Run job..."
gcloud run jobs update crypto-event-job \
  --region us-central1 \
  --image gcr.io/tradiac-testing/crypto-event-job

echo ""
echo "========================================="
echo "Ready to run! Execute these commands:"
echo "========================================="
echo ""
echo "# EQUAL_MEAN (225 combos):"
echo "gcloud run jobs execute crypto-event-job --region us-central1 --update-env-vars METHOD=EQUAL_MEAN,BUY_MAX=3.0,SELL_MIN=0.2,SELL_MAX=3.0,START_DATE=2024-05-01,END_DATE=2025-11-02"
echo ""
echo "# WINSORIZED (225 combos):"
echo "gcloud run jobs execute crypto-event-job --region us-central1 --update-env-vars METHOD=WINSORIZED,BUY_MAX=3.0,SELL_MIN=0.2,SELL_MAX=3.0,START_DATE=2024-05-01,END_DATE=2025-11-02"