#!/bin/bash

# ============================================
# CRYPTO EVENT GENERATION - COMPLETE SCRIPT
# Run this in Google Cloud Shell
# ============================================

PROJECT_ID="tradiac-testing"
REGION="us-central1"

echo "========================================="
echo "Creating Crypto Event Generation Files"
echo "========================================="

# Create working directory
mkdir -p ~/crypto-events
cd ~/crypto-events

# ============================================
# CREATE DOCKERFILE
# ============================================
cat > Dockerfile << 'EOF'
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY crypto-event-generation.js ./

CMD ["node", "crypto-event-generation.js"]
EOF

# ============================================
# CREATE PACKAGE.JSON
# ============================================
cat > package.json << 'EOF'
{
  "name": "crypto-event-generation",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
  }
}
EOF

# ============================================
# CREATE EVENT GENERATION SCRIPT
# ============================================
cat > crypto-event-generation.js << 'EOFJS'
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
const SELL_MIN = parseFloat(process.env.SELL_MIN || '0.1');
const SELL_MAX = parseFloat(process.env.SELL_MAX || '3.0');
const START_DATE = process.env.START_DATE || '2024-05-01';
const END_DATE = process.env.END_DATE || '2025-11-02';

const BATCH_SIZE = 1500;

function generateCombinations() {
  const combinations = [];
  const buyStart = Math.round(SELL_MIN * 10);
  const buyEnd = Math.round(BUY_MAX * 10);
  const sellStart = Math.round(SELL_MIN * 10);
  const sellEnd = Math.round(SELL_MAX * 10);
  
  for (let buy = buyStart; buy <= buyEnd; buy++) {
    for (let sell = sellStart; sell <= sellEnd; sell++) {
      combinations.push({
        buy_pct: buy / 10,
        sell_pct: sell / 10
      });
    }
  }
  return combinations;
}

const COMBINATIONS = generateCombinations();
const TABLE_NAME = `trade_events_crypto_${METHOD.toLowerCase()}`;

console.log('\n========================================');
console.log(`Crypto Event Generation`);
console.log(`Table: ${TABLE_NAME}`);
console.log(`Method: ${METHOD}`);
console.log(`Date range: ${START_DATE} to ${END_DATE}`);
console.log(`Combinations: ${COMBINATIONS.length}`);
console.log(`Batch size: ${BATCH_SIZE}`);
console.log('========================================\n');

async function processEvents() {
  const client = await pool.connect();
  
  try {
    const startTime = Date.now();
    
    const symbolsResult = await client.query(
      'SELECT DISTINCT symbol FROM minute_crypto ORDER BY symbol'
    );
    const symbols = symbolsResult.rows.map(r => r.symbol);
    
    console.log(`Processing ${symbols.length} symbols...\n`);
    
    let totalEvents = 0;
    
    for (const symbol of symbols) {
      console.log(`\n=== Processing ${symbol} ===`);
      
      const dataResult = await client.query(`
        SELECT 
          mc.timestamp,
          mc.close as crypto_close,
          mbc.close as btc_close,
          bd.baseline
        FROM minute_crypto mc
        JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
        JOIN baseline_daily_crypto bd ON 
          DATE(mc.timestamp) = bd.trading_day 
          AND mc.symbol = bd.symbol 
          AND bd.method = $1
        WHERE mc.symbol = $2
          AND DATE(mc.timestamp) >= $3
          AND DATE(mc.timestamp) <= $4
        ORDER BY mc.timestamp
      `, [METHOD, symbol, START_DATE, END_DATE]);
      
      console.log(`  Loaded ${dataResult.rows.length} data points`);
      
      const dataMap = new Map();
      for (const row of dataResult.rows) {
        const ratio = row.btc_close / row.crypto_close;
        const deviation = ((ratio - row.baseline) / row.baseline) * 100;
        dataMap.set(row.timestamp.getTime(), {
          timestamp: row.timestamp,
          ratio: ratio,
          baseline: row.baseline,
          deviation: deviation
        });
      }
      
      for (const combo of COMBINATIONS) {
        const events = [];
        let position = null;
        
        for (const [timestamp, data] of dataMap.entries()) {
          if (!position && data.deviation >= combo.buy_pct) {
            position = {
              entry_time: data.timestamp,
              entry_ratio: data.ratio,
              entry_baseline: data.baseline
            };
          } else if (position && data.deviation <= combo.sell_pct) {
            events.push([
              symbol,
              METHOD,
              combo.buy_pct,
              combo.sell_pct,
              position.entry_time,
              data.timestamp,
              position.entry_ratio,
              data.ratio,
              position.entry_baseline
            ]);
            position = null;
          }
        }
        
        if (events.length > 0) {
          for (let i = 0; i < events.length; i += BATCH_SIZE) {
            const batch = events.slice(i, i + BATCH_SIZE);
            const values = batch.map((_, idx) => {
              const offset = idx * 9;
              return `($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9})`;
            }).join(',');
            
            await client.query(`
              INSERT INTO ${TABLE_NAME} 
              (symbol, method, buy_pct, sell_pct, buy_time, sell_time, buy_ratio, sell_ratio, baseline)
              VALUES ${values}
              ON CONFLICT DO NOTHING
            `, batch.flat());
            
            totalEvents += batch.length;
          }
        }
      }
      
      console.log(`  ✓ ${symbol} complete (${totalEvents.toLocaleString()} total events)`);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n========================================');
    console.log(`✅ COMPLETE!`);
    console.log(`Total events: ${totalEvents.toLocaleString()}`);
    console.log(`Time: ${elapsed} minutes`);
    console.log('========================================\n');
    
  } finally {
    client.release();
    await pool.end();
  }
}

processEvents().catch(console.error);
EOFJS

echo ""
echo "✅ Files created in ~/crypto-events"
echo ""

# ============================================
# BUILD AND DEPLOY
# ============================================
echo "========================================="
echo "Building Docker Image..."
echo "========================================="
gcloud builds submit --tag gcr.io/${PROJECT_ID}/crypto-event-job

echo ""
echo "========================================="
echo "Creating Cloud Run Job..."
echo "========================================="
gcloud run jobs create crypto-event-job \
  --image gcr.io/${PROJECT_ID}/crypto-event-job \
  --region ${REGION} \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t! \
  --memory 8Gi \
  --cpu 4 \
  --max-retries 0 \
  --task-timeout 3h

echo ""
echo "========================================="
echo "✅ JOB CREATED!"
echo "========================================="
echo ""
echo "Now run these commands to generate events:"
echo ""
echo "# EQUAL_MEAN:"
echo "gcloud run jobs execute crypto-event-job --region us-central1 --update-env-vars METHOD=EQUAL_MEAN,BUY_MAX=3.0,SELL_MIN=0.1,SELL_MAX=3.0,START_DATE=2024-05-01,END_DATE=2025-11-02"
echo ""
echo "# WINSORIZED:"
echo "gcloud run jobs execute crypto-event-job --region us-central1 --update-env-vars METHOD=WINSORIZED,BUY_MAX=3.0,SELL_MIN=0.1,SELL_MAX=3.0,START_DATE=2024-05-01,END_DATE=2025-11-02"
echo ""