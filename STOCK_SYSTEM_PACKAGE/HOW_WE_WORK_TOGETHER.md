# How We Work Together - Stock Trading System

## Our Communication Protocol

### 1. How I Send You Instructions

**I provide commands in BLOCKS that you paste sequentially:**
- Each block is clearly labeled (BLOCK 1, BLOCK 2, etc.)
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

### 5. Our Workflow Pattern

```
1. You describe the problem/requirement
   ↓
2. I analyze the current system
   ↓
3. I create the solution in blocks
   ↓
4. You paste blocks sequentially
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

**You always:**
- ✅ Paste one block at a time
- ✅ Wait for completion before next block
- ✅ Report any errors you see
- ✅ Confirm when jobs complete

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

## Stock Trading System Overview

### What We're Building

A **Bitcoin mining stock trading system** that:
1. Tracks 9 mining stocks (HIVE, RIOT, MARA, CLSK, BTDR, CORZ, HUT, CAN, CIFR)
2. Compares stock prices to Bitcoin prices
3. Generates buy/sell signals based on ratio deviations
4. Tests 900 different buy/sell threshold combinations
5. Provides reports to find optimal trading strategies

### The Core Logic

**Trading Formula:**
```javascript
// Calculate ratio of BTC price to stock price
ratio = btc_price / stock_price

// Calculate thresholds from baseline
buyThreshold = baseline * (1 + buyPct / 100)   // Buy when ratio is HIGH
sellThreshold = baseline * (1 - sellPct / 100) // Sell when ratio is LOW

// Trading signals
if (ratio >= buyThreshold) → BUY
if (ratio <= sellThreshold) → SELL
otherwise → HOLD
```

**Example:**
- Baseline: 29,520.7
- Buy %: 0.5%
- Sell %: 1.0%
- Buy Threshold: 29,520.7 × 1.005 = 29,668.3
- Sell Threshold: 29,520.7 × 0.99 = 29,225.5

**When ratio > 29,668.3:** BUY (BTC is expensive relative to stock)
**When ratio < 29,225.5:** SELL (BTC is cheap relative to stock)

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     STOCK TRADING SYSTEM                     │
└─────────────────────────────────────────────────────────────┘

1. DATA COLLECTION
   ├── Minute-by-minute stock prices (9 stocks)
   ├── Minute-by-minute BTC prices
   └── Trading calendar (market open/close times)

2. BASELINE CALCULATION
   ├── Daily baselines (5 methods)
   │   ├── EQUAL_MEAN: Simple average
   │   ├── VWAP_RATIO: Volume-weighted
   │   ├── VOL_WEIGHTED: Volatility-weighted
   │   ├── WINSORIZED: Outlier-resistant
   │   └── WEIGHTED_MEDIAN: Median-based
   └── Separate for RTH (9:30-16:00) and AH (4:00-9:30, 16:00-20:00)

3. EVENT GENERATION
   ├── 10 event tables (5 methods × 2 sessions)
   ├── 900 combinations per table (30 buy × 30 sell thresholds)
   ├── ~33.7M total events
   └── Cloud Run jobs (parallel processing)

4. REPORTING
   ├── Frontend: Next.js on Vercel (raas.help)
   ├── API: Express.js on Vercel
   ├── 11 different report types
   └── Real-time data queries
```

### Database Schema

**Key Tables:**
```sql
-- Raw data
minute_stock (2.7M rows) - Stock prices every minute
minute_btc (1M rows) - BTC prices every minute
trading_calendar - Market open/close times

-- Calculated data
baseline_daily (46,889 rows) - Daily baselines for each stock/method
trade_events_rth_equal_mean (3.3M events) - RTH events for EQUAL_MEAN
trade_events_ah_equal_mean (2.8M events) - AH events for EQUAL_MEAN
... (8 more event tables for other methods)
```

### Event Generation Process

**How we generate 33.7M events:**

1. **Clear old data** (if regenerating)
2. **For each symbol** (9 stocks):
   - For each method (5 methods):
     - For each session (RTH, AH):
       - For each combination (900 buy/sell pairs):
         - Simulate trading through all minutes
         - Generate BUY/SELL events
         - Calculate ROI for each trade
         - Store in appropriate table

**Deployment:**
- 10 Cloud Run jobs (one per table)
- Run in parallel
- 8 CPU, 32GB RAM each
- ~2 hours total time
- ~$15 total cost

### Critical Files

**Event Generation:**
- `processor/event-update-job.js` - Main event generator
- Uses CORRECT formula: `sellThreshold = baseline * (1 - sellPct / 100)`

**API Server:**
- `api-server/server.js` - Express server with all endpoints
- Deployed on Vercel
- Connects to Google Cloud PostgreSQL

**Frontend:**
- `frontend-dashboard/` - Next.js application
- 11 stock reports
- Deployed on Vercel (raas.help)

### Verification Commands

**Check event counts:**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  'trade_events_rth_equal_mean' as table_name,
  COUNT(*) as event_count
FROM trade_events_rth_equal_mean
UNION ALL
SELECT 'trade_events_ah_equal_mean', COUNT(*) FROM trade_events_ah_equal_mean
-- ... repeat for all 10 tables
ORDER BY table_name;
"
```

**Verify formula is correct:**
```bash
grep "sellThreshold.*baseline" processor/event-update-job.js
# Should show: const sellThreshold = baseline * (1 - sellPct / 100);
```

### Common Operations

**Regenerate all events:**
1. Clear tables
2. Deploy Cloud Run jobs
3. Execute jobs in parallel
4. Wait ~2 hours
5. Verify event counts

**Add new stock:**
1. Add to minute_stock table
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

**WRONG (what I initially told you):**
```javascript
const sellThreshold = baseline * (1 + sellPct / 100); // SAME AS BUY!
```

**CORRECT (what we use now):**
```javascript
const sellThreshold = baseline * (1 - sellPct / 100); // BELOW BASELINE
```

This bug caused way too many events because SELL was triggering when ratio dropped below BUY threshold instead of below SELL threshold.

### Always Verify

Before any major regeneration:
```bash
# Check the formula
grep "sellThreshold" processor/event-update-job.js

# Should see: baseline * (1 - sellPct / 100)
# NOT: baseline * (1 + sellPct / 100)
```

### Cost Management

- Event generation: ~$15 per full run
- Database: ~$70/month
- Vercel: Free tier (frontend + API)
- Total: ~$70/month + $15 per regeneration

---

## Quick Reference

**Database:**
- Host: 34.41.97.179
- Database: tradiac_testing
- User: postgres
- Password: Fu3lth3j3t!

**Deployment:**
- Frontend: raas.help (Vercel)
- API: api-server-neon-five.vercel.app (Vercel)
- Jobs: Cloud Run (tradiac-testing project)

**Key Metrics:**
- 9 stocks
- 5 baseline methods
- 2 sessions (RTH, AH)
- 10 event tables
- 900 combinations per table
- 33.7M total events
- 11 reports

---

This document should be your reference for how we work together on the stock trading system. Drop it into any new chat and I'll know exactly how to help you!