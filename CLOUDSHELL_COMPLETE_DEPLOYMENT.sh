#!/bin/bash
# Complete deployment script for crypto event generation
# 13x13 combinations, Oct 2024 - Nov 2025, 19 symbols

echo "=========================================="
echo "CRYPTO EVENT GENERATION DEPLOYMENT"
echo "13x13 combinations (169 total)"
echo "Oct 2024 - Nov 2025 (13 months)"
echo "19 crypto symbols"
echo "=========================================="
echo ""

# STEP 1: Create updated script
echo "STEP 1: Creating updated crypto-event-generation.js..."
cd ~/zara/cloudshell_crypto

cat > crypto-event-generation.js << 'ENDOFFILE'
#!/usr/bin/env node
/**
 * CRYPTO EVENT GENERATION SCRIPT
 * 
 * Generates buy/sell trading events for crypto based on baseline deviations
 * Similar to stock event generation but for 24/7 crypto trading
 * 
 * Usage:
 *   METHOD=EQUAL_MEAN node crypto-event-generation.js
 * 
 * Environment Variables:
 *   METHOD - Baseline method (EQUAL_MEAN, WINSORIZED)
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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Configuration from environment
const METHOD = process.env.METHOD;
const START_DATE = process.env.START_DATE || '2024-10-01'; // 13 months of data (Oct 2024 - Nov 2, 2025)
const END_DATE = process.env.END_DATE || '2025-11-02';

// Crypto symbols (19 total, SHIB removed due to numeric overflow)
const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP'];

// Batch size for inserts
const BATCH_SIZE = 1500;

/**
 * Generate parameter combinations
 * Custom thresholds optimized for 0.3% round-trip fees (0.15% each way)
 * Minimum 0.2% net profit after fees
 */
function generateCombinations() {
  const combinations = [];
  // Custom thresholds: 0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0
  const thresholds = [0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0];
  
  for (const buy of thresholds) {
    for (const sell of thresholds) {
      combinations.push({
        buy_pct: buy,
        sell_pct: sell
      });
    }
  }
  
  console.log(`Custom thresholds: ${thresholds.join(', ')}`);
  console.log(`Total combinations: ${combinations.length} (${thresholds.length}×${thresholds.length})`);
  
  return combinations;
}

const COMBINATIONS = generateCombinations();

/**
 * Get table name for method
 */
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

/**
 * Fetch all minute data for a symbol with baselines
 */
async function fetchMinuteDataWithBaselines(symbol, buyPct, sellPct) {
  const query = `
    SELECT 
      mc.timestamp as event_timestamp,
      mc.close as crypto_price,
      mbc.close as btc_price,
      (mbc.close / mc.close) as ratio,
      bdc.baseline_${METHOD.toLowerCase()} as baseline
    FROM minute_crypto mc
    JOIN minute_btc_crypto mbc 
      ON mc.timestamp = mbc.timestamp
    JOIN baseline_daily_crypto bdc 
      ON mc.symbol = bdc.symbol 
      AND mc.timestamp::date = bdc.trading_day
      AND bdc.method = $1
    WHERE mc.symbol = $2
      AND mc.timestamp::date >= $3
      AND mc.timestamp::date <= $4
    ORDER BY mc.timestamp
  `;
  
  const result = await pool.query(query, [METHOD, symbol, START_DATE, END_DATE]);
  return result.rows;
}

/**
 * Generate events for a symbol and parameter combination
 */
function generateEvents(minuteData, symbol, buyPct, sellPct) {
  const events = [];
  let position = null; // null, 'BUY', or 'SELL'
  
  for (const bar of minuteData) {
    const { event_timestamp, crypto_price, btc_price, ratio, baseline } = bar;
    
    if (!baseline || baseline === 0) continue;
    
    const deviationPct = ((ratio - baseline) / baseline) * 100;
    
    // State machine logic
    if (position === null) {
      // No position - look for BUY signal
      if (deviationPct >= buyPct) {
        events.push({
          symbol,
          buy_pct: buyPct,
          sell_pct: sellPct,
          event_timestamp,
          event_type: 'BUY',
          crypto_price,
          btc_price,
          ratio,
          baseline,
          trade_roi_pct: null
        });
        position = 'BUY';
      }
    } else if (position === 'BUY') {
      // In BUY position - look for SELL signal
      if (deviationPct <= sellPct) {
        const buyEvent = events[events.length - 1];
        const roi = ((crypto_price - buyEvent.crypto_price) / buyEvent.crypto_price) * 100;
        
        events.push({
          symbol,
          buy_pct: buyPct,
          sell_pct: sellPct,
          event_timestamp,
          event_type: 'SELL',
          crypto_price,
          btc_price,
          ratio,
          baseline,
          trade_roi_pct: roi
        });
        
        // Update the BUY event's ROI
        buyEvent.trade_roi_pct = roi;
        
        position = null; // Reset to look for next BUY
      }
    }
  }
  
  return events;
}

/**
 * Insert events in batches
 */
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
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`
      );
      values.push(
        event.symbol,
        event.buy_pct,
        event.sell_pct,
        event.event_timestamp,
        event.event_type,
        event.crypto_price,
        event.btc_price,
        event.ratio,
        event.baseline,
        event.trade_roi_pct
      );
      paramIndex += 10;
    }
    
    const query = `
      INSERT INTO ${TABLE_NAME} 
      (symbol, buy_pct, sell_pct, event_timestamp, event_type, crypto_price, btc_price, ratio, baseline, trade_roi_pct)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
    `;
    
    await pool.query(query, values);
    totalInserted += batch.length;
  }
  
  return totalInserted;
}

/**
 * Process a single symbol
 */
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

/**
 * Main execution
 */
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

echo "✅ Updated crypto-event-generation.js created"
echo ""

# STEP 2: Clear old tables
echo "STEP 2: Clearing old event tables..."
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
SELECT 'Tables cleared successfully' as status;
EOF
echo ""

# STEP 3: Deploy to Cloud Run
echo "STEP 3: Building and deploying to Cloud Run..."
gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generator

gcloud run jobs deploy crypto-event-job \
  --image gcr.io/tradiac-testing/crypto-event-generator \
  --region us-central1 \
  --memory 32Gi \
  --cpu 8 \
  --max-retries 0 \
  --task-timeout 3h \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!

echo "✅ Deployment complete!"
echo ""

# STEP 4: Execute both jobs
echo "STEP 4: Executing both jobs in parallel..."
gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --set-env-vars METHOD=EQUAL_MEAN \
  --async

gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --set-env-vars METHOD=WINSORIZED \
  --async

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "Both jobs are now running in parallel"
echo "Monitor at: https://console.cloud.google.com/run/jobs?project=tradiac-testing"
echo "Expected completion: ~20 minutes"
echo "Expected output: ~17M events"
echo "=========================================="