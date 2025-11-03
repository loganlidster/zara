# How We Work Together - Crypto Trading System

## Our Communication Protocol

### 1. How I Send You Instructions

**I provide commands in BLOCKS that you paste sequentially:**
- Each block is clearly labeled (BLOCK 1, BLOCK 2, BLOCK 3)
- You paste ONE block at a time in Cloud Shell
- Wait for each block to complete before pasting the next
- I use heredoc syntax (`<< 'EOF'`) to avoid shell interpretation issues

**Example:**
```bash
# BLOCK 1: Create script
cat > script.js << 'EOF'
// script content here
EOF

# BLOCK 2: Deploy
gcloud builds submit --tag gcr.io/project/image

# BLOCK 3: Execute
gcloud run jobs execute job-name --async
```

### 2. Why We Use This Method

**Avoids paste corruption:**
- Large pastes in Cloud Shell can get corrupted
- Breaking into blocks prevents this
- Each block is self-contained and verifiable

**Clear checkpoints:**
- You can verify each step completed successfully
- Easy to resume if something fails
- Clear progress tracking

### 3. What I Provide

**For every deployment, I give you:**
1. **Complete code** in heredoc blocks (no file attachments needed)
2. **Database commands** to clear/verify data
3. **Build commands** for Docker images
4. **Deploy commands** for Cloud Run
5. **Execution commands** to start jobs
6. **Verification commands** to check results

### 4. File vs Text Communication

**I send TEXT (not files) because:**
- You're working in Cloud Shell (browser-based)
- Easier to copy/paste commands directly
- No need to upload files
- Everything is self-contained in the commands

**When I do attach files:**
- Documentation for reference
- Analysis results (CSV, markdown)
- Screenshots for verification
- Complete packages (like this one)

### 5. Our Workflow Pattern

```
1. You describe the problem/requirement
   ↓
2. I analyze the current system
   ↓
3. I create the solution in blocks
   ↓
4. You paste blocks sequentially in Cloud Shell
   ↓
5. System deploys automatically
   ↓
6. I provide verification commands
   ↓
7. You confirm results
```

### 6. Key Principles

**I always:**
- ✅ Provide complete, ready-to-paste commands
- ✅ Use heredoc for multi-line content
- ✅ Break large operations into blocks
- ✅ Include verification steps
- ✅ Explain what each block does
- ✅ Give you the exact syntax to use
- ✅ Number blocks clearly (BLOCK 1, BLOCK 2, etc.)

**You always:**
- ✅ Paste one block at a time
- ✅ Wait for completion before next block
- ✅ Report any errors you see
- ✅ Confirm when jobs complete
- ✅ Work from Cloud Shell (browser-based)

### 7. Error Handling

**If something fails:**
1. You copy the error message
2. I analyze what went wrong
3. I provide corrected commands
4. We resume from the failed step

**Common issues we handle:**
- Paste corruption → Break into smaller blocks
- Timeout errors → Use async execution
- Permission errors → Add proper flags
- Syntax errors → Fix and re-paste

---

## Crypto Trading System Overview

### What We're Building

A **cryptocurrency trading system** that:
1. Tracks 21 cryptocurrencies (ETH, SOL, ADA, etc.)
2. Compares crypto prices to Bitcoin prices
3. Generates buy/sell signals based on ratio deviations
4. Tests 49 different buy/sell threshold combinations (7×7)
5. Provides reports to find optimal trading strategies
6. Trades 24/7 (no sessions like stocks)

### The Core Logic

**Trading Formula:**
```javascript
// Calculate ratio of BTC price to crypto price
ratio = btc_price / crypto_price

// Calculate thresholds from baseline
buyThreshold = baseline * (1 + buyPct / 100)   // Buy when ratio is HIGH
sellThreshold = baseline * (1 - sellPct / 100) // Sell when ratio is LOW

// Trading signals
if (ratio >= buyThreshold) → BUY
if (ratio <= sellThreshold) → SELL
otherwise → HOLD
```

**Example:**
- Baseline: 24.45 (BTC/ETH ratio)
- Buy %: 1.0%
- Sell %: 1.0%
- Buy Threshold: 24.45 × 1.01 = 24.70
- Sell Threshold: 24.45 × 0.99 = 24.21

**When ratio > 24.70:** BUY (BTC is expensive relative to ETH)
**When ratio < 24.21:** SELL (BTC is cheap relative to ETH)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CRYPTO TRADING SYSTEM                     │
└─────────────────────────────────────────────────────────────┘

1. DATA COLLECTION
   ├── Minute-by-minute crypto prices (21 cryptos, 24/7)
   ├── Minute-by-minute BTC prices (24/7)
   └── No trading calendar (crypto trades 24/7)

2. BASELINE CALCULATION
   ├── Daily baselines (2 methods)
   │   ├── EQUAL_MEAN: Simple average
   │   └── WINSORIZED: Outlier-resistant
   └── Uses previous 24 hours of data

3. EVENT GENERATION
   ├── 2 event tables (2 methods, no sessions)
   ├── 49 combinations per table (7 buy × 7 sell thresholds)
   ├── ~30-40M total events (with correct formula)
   └── Cloud Run jobs (parallel processing)

4. REPORTING
   ├── Frontend: Next.js on Vercel (raas.help/crypto)
   ├── API: Express.js on Cloud Run
   ├── 4 different report types
   └── Real-time data queries
```

### Database Schema

**Key Tables:**
```sql
-- Raw data
minute_crypto (8-10M rows) - Crypto prices every minute, 24/7
minute_btc_crypto (1M rows) - BTC prices every minute, 24/7

-- Calculated data
baseline_daily_crypto (20,710 rows) - Daily baselines for each crypto/method
trade_events_crypto_equal_mean (~15-20M events) - EQUAL_MEAN events
trade_events_crypto_winsorized (~15-20M events) - WINSORIZED events
```

### Event Generation Process

**How we generate 30-40M events:**

1. **Clear old data** (if regenerating)
2. **For each symbol** (21 cryptos):
   - For each method (2 methods):
     - For each combination (49 buy/sell pairs):
       - Simulate trading through all minutes
       - Generate BUY/SELL events
       - Calculate ROI for each trade
       - Store in appropriate table

**Deployment:**
- 2 Cloud Run jobs (one per method)
- Run in parallel
- 8 CPU, 32GB RAM each
- ~30-40 minutes total time
- ~$10 total cost

### The 3-Block Deployment Pattern

**BLOCK 1: Create the script**
```bash
cd ~
mkdir -p crypto-job-correct
cd crypto-job-correct

cat > crypto-event-generation.js << 'EOF'
#!/usr/bin/env node
import pg from 'pg';
// ... complete script with CORRECT formula
EOF

cat > package.json << 'PKGEOF'
{
  "name": "crypto-event-generator",
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

**BLOCK 2: Complete the script**
```bash
cat >> crypto-event-generation.js << 'EOF'
// ... rest of the script (functions, main logic)
EOF
```

**BLOCK 3: Clear, build, deploy, execute**
```bash
# Clear tables
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
"

# Build Docker image
gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generator-correct

# Deploy job
gcloud run jobs create crypto-event-job-correct \
  --image gcr.io/tradiac-testing/crypto-event-generator-correct:latest \
  --region us-central1 \
  --memory 8Gi --cpu 4 --task-timeout 3h \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!

# Execute both methods
gcloud run jobs execute crypto-event-job-correct --region us-central1 --update-env-vars METHOD=EQUAL_MEAN --async
gcloud run jobs execute crypto-event-job-correct --region us-central1 --update-env-vars METHOD=WINSORIZED --async
```

### Critical Files

**Event Generation:**
- `cloudshell_crypto/crypto-event-generation.js` - Main event generator
- Uses CORRECT formula: `sellThreshold = baseline * (1 - sellPct / 100)`

**API Server:**
- `api-server/crypto-fast-daily-events.js` - Returns trade events
- `api-server/crypto-grid-search-simple.js` - Returns heatmap data
- `api-server/crypto-daily-curve-simple.js` - Returns cumulative returns
- Deployed on Cloud Run

**Frontend:**
- `frontend-dashboard/app/reports/crypto-fast-daily/` - Trade events report
- `frontend-dashboard/app/reports/crypto-grid-search-new/` - Heatmap report
- `frontend-dashboard/app/reports/crypto-daily-curve-new/` - Cumulative returns
- `frontend-dashboard/app/reports/crypto-fast-daily-new/` - Top performers
- Deployed on Vercel (raas.help/crypto)

### Verification Commands

**Check event counts:**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  'EQUAL_MEAN' as method,
  COUNT(*) as event_count,
  COUNT(DISTINCT symbol) as symbols
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 
  'WINSORIZED',
  COUNT(*),
  COUNT(DISTINCT symbol)
FROM trade_events_crypto_winsorized;
"
```

**Verify formula is correct:**
```bash
grep "sellThreshold.*baseline" ~/crypto-job-correct/crypto-event-generation.js
# Should show: const sellThreshold = baseline * (1 - sellPct / 100);
```

**Check sample events:**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  event_timestamp,
  event_type,
  ratio,
  baseline,
  baseline * 1.01 as buy_threshold,
  baseline * 0.99 as sell_threshold
FROM trade_events_crypto_equal_mean
WHERE symbol = 'ETH' AND buy_pct = 1.0 AND sell_pct = 1.0
ORDER BY event_timestamp
LIMIT 10;
"
```

### Common Operations

**Regenerate all events:**
1. Paste BLOCK 1 (create script)
2. Paste BLOCK 2 (complete script)
3. Paste BLOCK 3 (clear, build, deploy, execute)
4. Wait ~30-40 minutes
5. Verify event counts

**Add new crypto:**
1. Add to minute_crypto table
2. Calculate baselines
3. Regenerate events
4. Update frontend dropdown

**Change thresholds:**
1. Modify THRESHOLDS array in code
2. Clear event tables
3. Regenerate all events

---

## Important Notes

### The Critical Bug We Fixed

**WRONG (what I initially told you to paste):**
```javascript
const sellThreshold = bar.baseline * (1 + sellPct / 100); // SAME AS BUY!
```

**CORRECT (what we use now):**
```javascript
const sellThreshold = baseline * (1 - sellPct / 100); // BELOW BASELINE
```

This bug caused ~66M events instead of ~30-40M because SELL was triggering when ratio dropped below BUY threshold instead of below SELL threshold.

### Always Verify Before Regeneration

```bash
# Check the formula in the script you're about to deploy
grep "sellThreshold" crypto-event-generation.js

# Should see: baseline * (1 - sellPct / 100)
# NOT: baseline * (1 + sellPct / 100)
```

### Differences from Stock System

**Crypto-specific features:**
1. **No sessions** - Crypto trades 24/7 (no RTH/AH split)
2. **2 event tables** instead of 10 (no session split)
3. **7×7 thresholds** (49 combinations) instead of 30×30 (900 combinations)
4. **Timestamp field** instead of separate date + time fields
5. **24-hour rolling baseline** instead of previous trading day
6. **21 symbols** instead of 9 stocks

**Threshold optimization:**
- Start at 0.3% (covers 0.15% per-trade fees)
- Max at 5.0% (reasonable for crypto volatility)
- 7 values: 0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0

### Cost Management

- Event generation: ~$10 per full run
- Database: ~$3/month additional (on top of stock system)
- Vercel: Free tier (frontend + API)
- Total: ~$73/month + $10 per regeneration

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

**Symbols:**
ADA, AVAX, BCH, CUSD, DAI, DOGE, ETH, HBAR, HYPE, LEO, LINK, LTC, SOL, SUI, TON, TRX, TUSD, XLM, XMR, XRP, ZEC

---

## The Complete 3-Block Deployment

When you need to regenerate crypto events, I'll give you these 3 blocks:

### BLOCK 1: Create Script (Part 1)
- Creates the JavaScript file with imports and setup
- Defines thresholds and combinations
- Sets up database connection
- **Contains the CORRECT sell threshold formula**

### BLOCK 2: Complete Script (Part 2)
- Adds the processing functions
- Adds batch insert logic
- Adds main execution loop
- Creates package.json and Dockerfile

### BLOCK 3: Deploy and Execute
- Clears old event tables
- Builds Docker image
- Deploys Cloud Run job
- Executes both methods in parallel

**Total time:** ~40-45 minutes from start to finish

---

## Critical Formula Reference

### CORRECT Formulas (Always Use These)

```javascript
// Buy when ratio is HIGH (above baseline)
const buyThreshold = baseline * (1 + buyPct / 100);

// Sell when ratio is LOW (below baseline)
const sellThreshold = baseline * (1 - sellPct / 100);

// Trading logic
if (expectingBuy && ratio >= buyThreshold) {
  // BUY signal
}
else if (!expectingBuy && ratio <= sellThreshold) {
  // SELL signal
}
```

### WRONG Formula (Never Use This)

```javascript
// ❌ WRONG - This makes sell threshold same as buy threshold
const sellThreshold = baseline * (1 + sellPct / 100);
```

### How to Verify

Before deploying, always check:
```bash
grep "sellThreshold" crypto-event-generation.js
```

Should show:
```
const sellThreshold = baseline * (1 - sellPct / 100);
```

NOT:
```
const sellThreshold = baseline * (1 + sellPct / 100);
```

---

## Example Trade Walkthrough

**Setup:**
- Symbol: ETH
- Baseline: 24.45 (BTC/ETH ratio)
- Buy %: 1.0%
- Sell %: 1.0%

**Thresholds:**
- Buy: 24.45 × 1.01 = 24.70
- Sell: 24.45 × 0.99 = 24.21

**Trading:**
1. **At 15:04** - Ratio rises to 24.77
   - 24.77 >= 24.70 (buy threshold) → **BUY**
   - Buy ETH at current price

2. **At 15:36** - Ratio drops to 24.69
   - 24.69 > 24.21 (sell threshold) → **HOLD**
   - Don't sell yet (not low enough)

3. **Later** - Ratio drops to 24.20
   - 24.20 <= 24.21 (sell threshold) → **SELL**
   - Sell ETH, calculate ROI

This creates proper trading spread with meaningful profit potential.

---

## Monitoring and Verification

### During Event Generation

**Check job status:**
```bash
gcloud run jobs executions list --region us-central1
```

**View logs:**
```bash
gcloud logging read 'resource.type=cloud_run_job' --limit 50 --format json
```

**Check progress in database:**
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

### After Completion

**Verify event counts:**
- Expected: ~15-20M per method
- Total: ~30-40M events
- Symbols: 21 cryptos

**Verify logic:**
```bash
# Run the verification script
node detailed_event_check.js
```

Should show:
- ✓ All BUY events: ratio >= buyThreshold
- ✓ All SELL events: ratio <= sellThreshold
- No invalid events

---

## Quick Reference

**Thresholds:**
- 7 values: 0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0
- 7×7 = 49 combinations
- Optimized for 0.15% per-trade fees

**Methods:**
- EQUAL_MEAN: Simple average
- WINSORIZED: Outlier-resistant

**Date Range:**
- Start: October 1, 2024
- End: November 2, 2025
- Duration: 13 months

**Performance:**
- Batch size: 5000 events per INSERT
- Database connections: 50 parallel
- Throughput: 20-25k events/second
- Time per symbol: ~2-3 minutes

---

This document should be your reference for how we work together on the crypto trading system. Drop it into any new chat and I'll know exactly how to help you!