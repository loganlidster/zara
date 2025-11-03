# Crypto Trading System - Complete Guide

## System Overview

This is a cryptocurrency trading analysis system that generates buy/sell signals based on the ratio between Bitcoin price and other cryptocurrency prices.

## Core Concept

**The Trading Logic:**
When Bitcoin price rises relative to another crypto, it suggests that crypto is undervalued → BUY
When Bitcoin price falls relative to another crypto, it suggests that crypto is overvalued → SELL

**Formula:**
```
ratio = btc_price / crypto_price
```

If ratio increases (BTC getting more expensive per unit of crypto) → Crypto is relatively cheap → BUY
If ratio decreases (BTC getting cheaper per unit of crypto) → Crypto is relatively expensive → SELL

## Database Structure

### Tables
```sql
-- Raw Data
minute_crypto (8-10M rows)
  - symbol, timestamp, open, high, low, close, volume

minute_btc_crypto (1M rows)
  - timestamp, open, high, low, close, volume

-- Calculated Data
baseline_daily_crypto (20,710 rows)
  - symbol, trading_day, method, baseline

-- Event Tables (2 total)
trade_events_crypto_equal_mean (~15-20M events)
  - symbol, buy_pct, sell_pct, event_timestamp, event_type,
    crypto_price, btc_price, ratio, baseline, trade_roi_pct

trade_events_crypto_winsorized (~15-20M events)
  - Same structure as above

Total: ~30-40M events
```

## The Critical Formulas

### CORRECT (Always Use These)

```javascript
// Buy when ratio is HIGH (above baseline)
const buyThreshold = baseline * (1 + buyPct / 100);

// Sell when ratio is LOW (below baseline)
const sellThreshold = baseline * (1 - sellPct / 100);

// Trading logic
if (expectingBuy && ratio >= buyThreshold) {
  // Generate BUY event
  expectingBuy = false;
}
else if (!expectingBuy && ratio <= sellThreshold) {
  // Generate SELL event
  expectingBuy = true;
}
```

### WRONG Formula (Never Use)

```javascript
// ❌ WRONG - Makes sell threshold same as buy threshold
const sellThreshold = baseline * (1 + sellPct / 100);
```

This was the bug that caused 66M events instead of 30-40M!

### Example

**Baseline:** 24.45 (BTC/ETH ratio for previous 24 hours)
**Buy %:** 1.0%
**Sell %:** 1.0%

**Thresholds:**
- Buy: 24.45 × 1.01 = 24.70
- Sell: 24.45 × 0.99 = 24.21

**Trading:**
- When ratio > 24.70 → BUY ETH
- When ratio < 24.21 → SELL ETH
- Otherwise → HOLD

## Key Differences from Stock System

### 1. No Sessions
Crypto trades 24/7, so:
- No RTH/AH split
- Only 2 event tables (not 10)
- Single timestamp field (not date + time)

### 2. Fewer Combinations
- **7×7 = 49 combinations** (not 30×30 = 900)
- Thresholds: 0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0
- Optimized for 0.15% per-trade fees

### 3. Only 2 Methods
- EQUAL_MEAN: Simple average
- WINSORIZED: Outlier-resistant
- (Not using VWAP_RATIO, VOL_WEIGHTED, WEIGHTED_MEDIAN)

### 4. 24-Hour Rolling Baseline
- Uses previous 24 hours of data
- Not "previous trading day" (crypto doesn't have trading days)

### 5. More Symbols
- 21 cryptocurrencies (vs 9 stocks)
- Includes stablecoins (USDT, USDC, DAI, USDe)

## The 3-Block Deployment Pattern

This is how we deploy crypto event generation. You paste these 3 blocks sequentially in Cloud Shell:

### BLOCK 1: Create Script (Part 1)

Creates the JavaScript file with:
- Database connection setup
- Threshold definitions (7×7 = 49 combinations)
- Helper functions
- **THE CRITICAL FORMULAS** (buy and sell thresholds)

```bash
cd ~
mkdir -p crypto-job-correct
cd crypto-job-correct

cat > crypto-event-generation.js << 'EOF'
#!/usr/bin/env node
import pg from 'pg';
const { Pool } = pg;

// ... setup code ...

const THRESHOLDS = [0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];

function simulateTrading(minuteData, buyPct, sellPct, expectingBuy) {
  const events = [];
  let lastBuyPrice = null;
  for (const bar of minuteData) {
    const ratio = bar.btc_close / bar.crypto_close;
    const baseline = bar.baseline;
    
    // CORRECT FORMULAS:
    const buyThreshold = baseline * (1 + buyPct / 100);
    const sellThreshold = baseline * (1 - sellPct / 100);
    
    if (expectingBuy && ratio >= buyThreshold) {
      // BUY logic
    }
    else if (!expectingBuy && ratio <= sellThreshold) {
      // SELL logic
    }
  }
  return events;
}
EOF
```

### BLOCK 2: Complete Script (Part 2)

Adds:
- Batch insert functions
- Main processing loop
- package.json
- Dockerfile

```bash
cat >> crypto-event-generation.js << 'EOF'
// ... insert functions ...
// ... main processing loop ...
EOF

cat > package.json << 'PKGEOF'
{
  "name": "crypto-event-generator",
  "version": "1.0.0",
  "type": "module",
  "dependencies": { "pg": "^8.11.3" }
}
PKGEOF

cat > Dockerfile << 'DKREOF'
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY crypto-event-generation.js ./
CMD ["node", "crypto-event-generation.js"]
DKREOF
```

### BLOCK 3: Clear, Build, Deploy, Execute

```bash
# Clear tables
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
"

# Build Docker image
gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generator-correct

# Deploy Cloud Run job
gcloud run jobs create crypto-event-job-correct \
  --image gcr.io/tradiac-testing/crypto-event-generator-correct:latest \
  --region us-central1 \
  --memory 8Gi --cpu 4 --task-timeout 3h \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!

# Execute both methods in parallel
gcloud run jobs execute crypto-event-job-correct --region us-central1 --update-env-vars METHOD=EQUAL_MEAN --async
gcloud run jobs execute crypto-event-job-correct --region us-central1 --update-env-vars METHOD=WINSORIZED --async
```

## File Structure

```
cloudshell_crypto/
  ├── crypto-event-generation.js   # Main event generator
  ├── package.json                 # Node dependencies
  ├── Dockerfile                   # Container definition
  └── deploy.sh                    # Deployment script

processor/
  ├── crypto-data-import-polygon.js    # Data import from Polygon
  ├── crypto-baseline-fast.js          # Baseline calculator
  └── crypto-event-generation.js       # Local event generator

api-server/
  ├── crypto-fast-daily-events.js      # Trade events API
  ├── crypto-grid-search-simple.js     # Heatmap API
  ├── crypto-daily-curve-simple.js     # Cumulative returns API
  └── crypto-fast-daily-simple.js      # Top performers API

frontend-dashboard/app/reports/
  ├── crypto-fast-daily/               # Trade events report
  ├── crypto-grid-search-new/          # Heatmap report
  ├── crypto-daily-curve-new/          # Cumulative returns
  └── crypto-fast-daily-new/           # Top performers
```

## Symbols (21 Total)

ADA, AVAX, BCH, CUSD, DAI, DOGE, ETH, HBAR, HYPE, LEO, LINK, LTC, SOL, SUI, TON, TRX, TUSD, XLM, XMR, XRP, ZEC

**Includes 4 stablecoins:** USDT, USDC, DAI, USDe (for low-fee transfers)

**Excluded:** SHIB (numeric overflow due to very small price)

## Event Generation Parameters

### Thresholds
**Buy thresholds:** 0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0 (7 values)
**Sell thresholds:** 0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0 (7 values)
**Total combinations:** 7 × 7 = 49 per symbol

### Why 7×7 (not 30×30)?

**Fee optimization:**
- Crypto trading fees: ~0.15% per trade
- Round-trip: 0.3%
- Minimum threshold: 0.3% to cover fees

**Data volume:**
- 30×30 = 900 combos would generate 156M+ events
- 7×7 = 49 combos generates ~30-40M events
- 75% reduction in data volume
- Still covers all meaningful strategies

### Date Range
- **Start:** October 1, 2024
- **End:** November 2, 2025
- **Duration:** 13 months

## Baseline Methods

### 1. EQUAL_MEAN
Simple average of all BTC/crypto ratios in the previous 24 hours.

### 2. WINSORIZED
Clips extreme values (top/bottom 5%) before averaging - resistant to outliers and flash crashes.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────┘

DATABASE (Google Cloud PostgreSQL)
  ├── Host: 34.41.97.179
  ├── Database: tradiac_testing
  └── Tables: 5 (2 raw data + 2 event tables + 1 baseline)

BACKEND JOBS (Google Cloud Run)
  ├── Event generation jobs (2 parallel)
  ├── 8 CPU, 32GB RAM each
  ├── 3-hour timeout
  └── Cost: ~$10 per full run

API SERVER (Cloud Run)
  ├── Express.js application
  ├── Connects to PostgreSQL
  ├── 4 crypto endpoints
  └── URL: tradiac-api-941257247637.us-central1.run.app

FRONTEND (Vercel)
  ├── Next.js 14 application
  ├── 4 crypto reports
  ├── Auto-deploy from GitHub
  └── URL: raas.help/crypto
```

## How to Deploy from Scratch

### Prerequisites
- Google Cloud account with billing enabled
- Vercel account
- GitHub repository
- Database credentials
- Polygon API key (for data import)

### Step 1: Database Setup
```sql
-- Create tables (run once)
CREATE TABLE minute_crypto (...);
CREATE TABLE minute_btc_crypto (...);
CREATE TABLE baseline_daily_crypto (...);
CREATE TABLE trade_events_crypto_equal_mean (...);
CREATE TABLE trade_events_crypto_winsorized (...);
```

### Step 2: Import Data
```bash
# Import 13 months of crypto data
node processor/crypto-data-import-polygon.js --backfill 2024-10-01
```

### Step 3: Calculate Baselines
```bash
# Calculate baselines for all cryptos
node processor/crypto-baseline-fast.js --range 2024-10-01 2025-11-02
```

### Step 4: Generate Events
Use the 3-block deployment pattern:
1. Paste BLOCK 1 (create script part 1)
2. Paste BLOCK 2 (complete script)
3. Paste BLOCK 3 (clear, build, deploy, execute)

### Step 5: Deploy API (if needed)
API is on Cloud Run, not Vercel for crypto.

### Step 6: Deploy Frontend
```bash
cd frontend-dashboard
vercel --prod
```

## Key Configuration

### Database Connection
```javascript
const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  max: 50,
  ssl: { rejectUnauthorized: false }
});
```

### Environment Variables (Cloud Run Jobs)
```
DB_HOST=34.41.97.179
DB_PORT=5432
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=Fu3lth3j3t!
METHOD=EQUAL_MEAN (or WINSORIZED)
```

### Environment Variables (Frontend - Vercel)
```
NEXT_PUBLIC_API_URL=https://tradiac-api-941257247637.us-central1.run.app
```

## Reports Available

### 1. Fast Daily (Events)
Shows all trade events with portfolio tracking, conservative rounding, and slippage simulation.

### 2. Fast Daily (Top Performers)
Shows top N best performing buy/sell combinations sorted by total return.

### 3. Grid Search
7×7 heatmap showing all 49 buy/sell combinations with color-coded returns.

### 4. Daily Curve
Cumulative return chart over time for a specific buy/sell combination.

## The Complete Event Generation Script

### Key Components

**1. Threshold Definition:**
```javascript
const THRESHOLDS = [0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];
```

**2. Combination Generation:**
```javascript
function generateCombinations() {
  const combinations = [];
  for (const buy of THRESHOLDS) {
    for (const sell of THRESHOLDS) {
      combinations.push({ buy_pct: buy, sell_pct: sell });
    }
  }
  return combinations; // 49 combinations
}
```

**3. Trading Simulation (THE CRITICAL PART):**
```javascript
function simulateTrading(minuteData, buyPct, sellPct, expectingBuy) {
  const events = [];
  let lastBuyPrice = null;
  
  for (const bar of minuteData) {
    const ratio = bar.btc_close / bar.crypto_close;
    const baseline = bar.baseline;
    
    // ✅ CORRECT FORMULAS
    const buyThreshold = baseline * (1 + buyPct / 100);
    const sellThreshold = baseline * (1 - sellPct / 100);
    
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
    }
    else if (!expectingBuy && ratio <= sellThreshold && lastBuyPrice) {
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
```

**4. Batch Insert:**
```javascript
async function insertEventsBatch(client, symbol, buyPct, sellPct, events) {
  if (events.length === 0) return 0;
  
  let inserted = 0;
  const BATCH_SIZE = 5000;
  
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    // Build VALUES clause with $1, $2, ... placeholders
    // Insert 5000 events at once
    inserted += result.rowCount;
  }
  
  return inserted;
}
```

## Verification After Deployment

### Check Event Counts
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  'EQUAL_MEAN' as method,
  COUNT(*) as events,
  COUNT(DISTINCT symbol) as symbols
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 'WINSORIZED', COUNT(*), COUNT(DISTINCT symbol)
FROM trade_events_crypto_winsorized;
"
```

**Expected:**
- EQUAL_MEAN: ~15-20M events, 21 symbols
- WINSORIZED: ~15-20M events, 21 symbols
- Total: ~30-40M events

### Verify Formula is Correct
```bash
grep "sellThreshold" ~/crypto-job-correct/crypto-event-generation.js
```

**Should show:**
```
const sellThreshold = baseline * (1 - sellPct / 100);
```

**Should NOT show:**
```
const sellThreshold = baseline * (1 + sellPct / 100);
```

### Check Sample Events
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  event_timestamp,
  event_type,
  ratio,
  baseline,
  baseline * 1.01 as buy_threshold,
  baseline * 0.99 as sell_threshold,
  CASE 
    WHEN event_type = 'BUY' THEN ratio >= baseline * 1.01
    WHEN event_type = 'SELL' THEN ratio <= baseline * 0.99
  END as is_valid
FROM trade_events_crypto_equal_mean
WHERE symbol = 'ETH' AND buy_pct = 1.0 AND sell_pct = 1.0
ORDER BY event_timestamp
LIMIT 10;
"
```

**All rows should show `is_valid = true`**

## Troubleshooting

### Too Many Events (66M instead of 30-40M)

**Cause:** Wrong sell threshold formula
**Check:**
```bash
grep "sellThreshold" crypto-event-generation.js
```
**Fix:** Ensure it shows `baseline * (1 - sellPct / 100)`

### Events Not Generating

**Check:**
1. Database connection working?
2. Baseline data exists?
3. Minute data exists?
4. Cloud Run logs show errors?

**Verify baselines:**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT COUNT(*) FROM baseline_daily_crypto;
"
```
Should show ~20,710 rows.

### Reports Not Loading

**Check:**
1. API endpoint deployed?
2. Frontend deployed?
3. Browser console errors?
4. Network tab shows 404 or 500?

**Common fixes:**
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check Vercel deployment status
- Verify API URL in frontend code

## Performance Optimization

### Event Generation
- **Batch size:** 5000 events per INSERT
- **Database connections:** 50 parallel
- **Throughput:** 20-25k events/second
- **Time per symbol:** ~2-3 minutes
- **Total time:** ~30-40 minutes for 21 symbols

### Query Performance
- **Grid search:** <2 seconds (49 combinations)
- **Fast daily:** <2 seconds (top N performers)
- **Daily curve:** <2 seconds (full trade history)

### Database Indexes
```sql
CREATE INDEX idx_crypto_equal_mean_symbol_pcts 
  ON trade_events_crypto_equal_mean(symbol, buy_pct, sell_pct);

CREATE INDEX idx_crypto_equal_mean_timestamp 
  ON trade_events_crypto_equal_mean(event_timestamp);

-- Same for winsorized table
```

## Cost Breakdown

**Monthly Costs:**
- Database: ~$3/month additional (on top of stock system)
- Vercel: $0 (free tier)
- Total: ~$73/month (including stock system)

**One-Time Costs:**
- Event generation: ~$10 per full run
- Data import: ~$5 (Polygon API)
- Typically run once, then incremental updates

## Data Import

### Using Polygon API

```bash
# Import 13 months of data for 21 cryptos
node processor/crypto-data-import-polygon.js --backfill 2024-10-01

# Expected: ~8-10M bars
# Time: ~30-40 minutes
# Cost: ~$5 (Polygon API usage)
```

### Supported Cryptos

**Major cryptos:** ETH, SOL, ADA, AVAX, DOT, LINK, etc.
**Stablecoins:** USDT, USDC, DAI, USDe
**Privacy coins:** XMR, ZEC

## Baseline Calculation

### Fast Vectorized Approach

```bash
# Calculate baselines for all cryptos and methods
node processor/crypto-baseline-fast.js --range 2024-10-01 2025-11-02

# Expected: ~20,710 baselines
# Time: ~30 seconds
# Uses in-memory vectorized processing (340x faster than loops)
```

### Baseline Logic

For each crypto, each day, each method:
1. Get previous 24 hours of minute data
2. Calculate BTC/crypto ratio for each minute
3. Apply method (EQUAL_MEAN or WINSORIZED)
4. Store as baseline for the current day

## Conservative Rounding for Crypto

### The Challenge

Crypto prices vary wildly:
- ETH: ~$3,000
- SOL: ~$200
- ADA: ~$0.50
- Some cryptos: <$0.01

Rounding to nearest cent doesn't work for all!

### Our Solution: Adaptive Precision

```javascript
function formatPrice(price: number): string {
  if (price >= 100) return price.toFixed(2);   // $100.12
  if (price >= 10) return price.toFixed(3);    // $10.123
  if (price >= 1) return price.toFixed(4);     // $1.1234
  if (price >= 0.1) return price.toFixed(5);   // $0.12345
  if (price >= 0.01) return price.toFixed(6);  // $0.012345
  return price.toFixed(8);                     // $0.00012345
}
```

This ensures rounding impact is proportional across all price ranges.

## Monitoring

### During Event Generation

**Check job status:**
```bash
gcloud run jobs executions list --region us-central1
```

**View logs:**
```bash
gcloud logging read 'resource.type=cloud_run_job' --limit 50
```

**Check progress:**
```bash
# Run this script to see real-time progress
node check_crypto_progress.js
```

### After Completion

**Verify totals:**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  (SELECT COUNT(*) FROM trade_events_crypto_equal_mean) as equal_mean,
  (SELECT COUNT(*) FROM trade_events_crypto_winsorized) as winsorized,
  (SELECT COUNT(*) FROM trade_events_crypto_equal_mean) + 
  (SELECT COUNT(*) FROM trade_events_crypto_winsorized) as total;
"
```

## Common Operations

### Regenerate All Events
1. Paste BLOCK 1 in Cloud Shell
2. Paste BLOCK 2 in Cloud Shell
3. Paste BLOCK 3 in Cloud Shell
4. Wait ~30-40 minutes
5. Verify event counts

### Add New Crypto
1. Add to data import script
2. Import historical data
3. Calculate baselines
4. Regenerate events
5. Add to frontend dropdown

### Change Thresholds
1. Modify THRESHOLDS array
2. Clear event tables
3. Regenerate all events

### Update Date Range
1. Modify START_DATE and END_DATE in script
2. Ensure data exists for that range
3. Regenerate events

## Important Notes

### The Bug We Fixed

**I initially gave you WRONG code:**
```javascript
const sellThreshold = bar.baseline * (1 + sellPct / 100); // WRONG!
```

**Correct code:**
```javascript
const sellThreshold = baseline * (1 - sellPct / 100); // CORRECT!
```

The wrong formula caused:
- 66M events instead of 30-40M
- SELLs triggering too early
- Incorrect returns
- Invalid strategy testing

### Always Verify Before Deploying

```bash
# Check the formula in BLOCK 1 before pasting
# Look for this line in the simulateTrading function:
const sellThreshold = baseline * (1 - sellPct / 100);

# Should have MINUS, not PLUS
```

### Symbol List Must Match Database

Frontend dropdowns must include all symbols in database:
```javascript
const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DAI', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP', 'ZEC'];
```

If you add a crypto to the database, update this list in all 4 report files.

---

## Quick Reference

**Database:**
- Host: 34.41.97.179
- Database: tradiac_testing
- User: postgres
- Password: Fu3lth3j3t!

**Deployment:**
- Frontend: raas.help/crypto (Vercel)
- API: tradiac-api-941257247637.us-central1.run.app (Cloud Run)
- Jobs: Cloud Run (tradiac-testing project)

**Key Metrics:**
- 21 cryptocurrencies
- 2 baseline methods
- No sessions (24/7 trading)
- 2 event tables
- 49 combinations per table
- ~30-40M total events
- 4 reports

**Thresholds:**
- 7 values: 0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0
- Optimized for 0.15% per-trade fees
- 7×7 = 49 combinations

---

## Summary

This system analyzes cryptocurrencies by comparing their price movements to Bitcoin. It generates millions of trading events across different strategies to help identify optimal buy/sell thresholds. The key is the correct formula for sell thresholds (baseline × (1 - sell%)) which creates proper trading spreads. Unlike stocks, crypto trades 24/7 with no sessions, uses only 2 baseline methods, and tests 49 combinations (not 900) for efficiency.

**Drop this document into any new chat and I'll know exactly how to help you with the crypto system!**