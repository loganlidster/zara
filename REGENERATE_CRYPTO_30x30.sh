#!/bin/bash
set -e

echo "=========================================="
echo "CRYPTO EVENTS REGENERATION - 30x30 GRID"
echo "=========================================="
echo ""
echo "This will:"
echo "1. Clear existing crypto event tables"
echo "2. Deploy updated script with 30x30 grid (900 combinations)"
echo "3. Generate events for 19 crypto symbols"
echo "4. Process both EQUAL_MEAN and WINSORIZED methods"
echo ""
echo "Threshold structure:"
echo "- 0.1 to 2.0 by 0.1 increments (20 values)"
echo "- Plus: 2.2, 2.4, 2.8, 3.0, 3.5, 3.7, 3.9, 4.0, 4.5, 5.0 (10 values)"
echo "- Total: 30 buy × 30 sell = 900 combinations"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Step 1: Clear existing crypto event tables
echo ""
echo "Step 1: Clearing existing crypto event tables..."
echo "================================================"
gcloud sql connect tradiac-testing --user=postgres --quiet << 'EOF'
\c tradiac_testing
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
\q
EOF

echo "✓ Tables cleared"

# Step 2: Create the event generation script in Cloud Shell
echo ""
echo "Step 2: Creating event generation script..."
echo "==========================================="

cat > /tmp/crypto-event-generation.js << 'SCRIPT_EOF'
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

// 30 thresholds: 0.1 to 2.0 by 0.1 (20 values) + 10 additional values
const THRESHOLDS = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
  1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0,
  2.2, 2.4, 2.8, 3.0, 3.5, 3.7, 3.9, 4.0, 4.5, 5.0
];

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
SCRIPT_EOF

echo "✓ Script created"

# Step 3: Create package.json
echo ""
echo "Step 3: Creating package.json..."
cat > /tmp/package.json << 'PKG_EOF'
{
  "name": "crypto-event-generation",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
  }
}
PKG_EOF

echo "✓ package.json created"

# Step 4: Create Dockerfile
echo ""
echo "Step 4: Creating Dockerfile..."
cat > /tmp/Dockerfile << 'DOCKER_EOF'
FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY crypto-event-generation.js .
RUN chmod +x crypto-event-generation.js
CMD ["node", "crypto-event-generation.js"]
DOCKER_EOF

echo "✓ Dockerfile created"

# Step 5: Build and push Docker image
echo ""
echo "Step 5: Building Docker image..."
echo "================================"
cd /tmp
gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generation

echo "✓ Docker image built and pushed"

# Step 6: Deploy Cloud Run job
echo ""
echo "Step 6: Deploying Cloud Run job..."
echo "=================================="
gcloud run jobs deploy crypto-event-generation \
  --image gcr.io/tradiac-testing/crypto-event-generation \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --max-retries 0 \
  --task-timeout 3600 \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!

echo "✓ Cloud Run job deployed"

# Step 7: Execute for EQUAL_MEAN
echo ""
echo "Step 7: Executing EQUAL_MEAN method..."
echo "======================================"
gcloud run jobs execute crypto-event-generation \
  --region us-central1 \
  --update-env-vars METHOD=EQUAL_MEAN \
  --wait

echo "✓ EQUAL_MEAN complete"

# Step 8: Execute for WINSORIZED
echo ""
echo "Step 8: Executing WINSORIZED method..."
echo "======================================"
gcloud run jobs execute crypto-event-generation \
  --region us-central1 \
  --update-env-vars METHOD=WINSORIZED \
  --wait

echo "✓ WINSORIZED complete"

# Final summary
echo ""
echo "=========================================="
echo "✅ REGENERATION COMPLETE!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- 30x30 grid (900 combinations per method)"
echo "- 19 crypto symbols"
echo "- 2 baseline methods (EQUAL_MEAN, WINSORIZED)"
echo "- Total: 19 × 900 × 2 = 34,200 parameter sets"
echo ""
echo "Next steps:"
echo "1. Verify event counts in database"
echo "2. Test crypto reports"
echo "3. Check Grid Search functionality"
echo ""