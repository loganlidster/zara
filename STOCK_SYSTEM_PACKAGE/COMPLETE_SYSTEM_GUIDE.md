# Stock Trading System - Complete Guide

## System Overview

This is a Bitcoin mining stock trading analysis system that generates buy/sell signals based on the ratio between Bitcoin price and mining stock prices.

## Core Concept

**The Trading Logic:**
When Bitcoin price rises relative to a mining stock, it suggests the stock is undervalued → BUY
When Bitcoin price falls relative to a mining stock, it suggests the stock is overvalued → SELL

**Formula:**
```
ratio = btc_price / stock_price
```

If ratio increases (BTC getting more expensive per share of stock) → Stock is relatively cheap → BUY
If ratio decreases (BTC getting cheaper per share of stock) → Stock is relatively expensive → SELL

## Database Structure

### Tables
```sql
-- Raw Data
minute_stock (2.7M rows)
  - symbol, et_date, et_time, open, high, low, close, volume, session

minute_btc (1M rows)
  - et_date, et_time, open, high, low, close, volume

trading_calendar
  - date, is_trading_day, is_open

-- Calculated Data
baseline_daily (46,889 rows)
  - symbol, date, method, session, baseline

-- Event Tables (10 total)
trade_events_rth_equal_mean (3.3M events)
trade_events_ah_equal_mean (2.8M events)
trade_events_rth_vwap_ratio (3.4M events)
trade_events_ah_vwap_ratio (3.1M events)
trade_events_rth_vol_weighted (3.6M events)
trade_events_ah_vol_weighted (3.1M events)
trade_events_rth_winsorized (3.7M events)
trade_events_ah_winsorized (3.1M events)
trade_events_rth_weighted_median (3.8M events)
trade_events_ah_weighted_median (3.2M events)

Total: 33.7M events
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

### Example

**Baseline:** 29,520.7 (BTC/HIVE ratio for previous trading day)
**Buy %:** 0.5%
**Sell %:** 1.0%

**Thresholds:**
- Buy: 29,520.7 × 1.005 = 29,668.3
- Sell: 29,520.7 × 0.99 = 29,225.5

**Trading on 9/24/2025:**
- At 9:30 AM: Ratio = 29,897.72
  - 29,897.72 >= 29,668.3 → **BUY**
- Later: Ratio drops to 29,200
  - 29,200 <= 29,225.5 → **SELL**

## Sessions

**RTH (Regular Trading Hours):**
- 9:30 AM - 4:00 PM Eastern Time
- Main trading session
- Higher volume, tighter spreads

**AH (After Hours):**
- 4:00 AM - 9:30 AM Eastern Time
- 4:00 PM - 8:00 PM Eastern Time
- Lower volume, wider spreads

## Baseline Methods

### 1. EQUAL_MEAN
Simple average of all ratios during the session.

### 2. VWAP_RATIO
Volume-weighted average - gives more weight to high-volume periods.

### 3. VOL_WEIGHTED
Volatility-weighted - gives more weight to stable periods.

### 4. WINSORIZED
Clips extreme values before averaging - resistant to outliers.

### 5. WEIGHTED_MEDIAN
Uses median instead of mean - very resistant to outliers.

## Event Generation Parameters

### Thresholds
**Buy thresholds:** 0.1% to 3.0% in 0.1% increments (30 values)
**Sell thresholds:** 0.1% to 3.0% in 0.1% increments (30 values)
**Total combinations:** 30 × 30 = 900 per table

### Why 900 Combinations?

We test every possible buy/sell pair to find optimal strategies:
- Conservative: 0.1% buy, 0.1% sell (tight spread, many trades)
- Moderate: 1.0% buy, 1.0% sell (balanced)
- Aggressive: 3.0% buy, 3.0% sell (wide spread, fewer trades)

## File Structure

```
processor/
  ├── event-update-job.js          # Main event generator
  ├── daily-update-job-fixed.js    # Daily data import
  └── crypto-baseline-fast.js      # Baseline calculator

api-server/
  ├── server.js                    # Main Express server
  ├── db.js                        # Database connection
  ├── event-endpoints.js           # Stock event APIs
  └── [other endpoints]

frontend-dashboard/
  ├── app/
  │   ├── page.tsx                 # Home page
  │   ├── stocks/page.tsx          # Stock landing page
  │   └── reports/
  │       ├── fast-daily/          # Trade events report
  │       ├── grid-search/         # Heatmap report
  │       ├── daily-curve/         # Cumulative returns
  │       └── [8 more reports]
  └── lib/
      └── api.ts                   # API client
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────┘

DATABASE (Google Cloud PostgreSQL)
  ├── Host: 34.41.97.179
  ├── Database: tradiac_testing
  └── Tables: 13 (3 raw data + 10 event tables)

BACKEND JOBS (Google Cloud Run)
  ├── Event generation jobs (10 parallel)
  ├── 8 CPU, 32GB RAM each
  ├── 3-hour timeout
  └── Cost: ~$15 per full run

API SERVER (Vercel)
  ├── Express.js application
  ├── Connects to PostgreSQL
  ├── 15+ endpoints
  └── Auto-deploy from GitHub

FRONTEND (Vercel)
  ├── Next.js 14 application
  ├── 11 stock reports
  ├── Auto-deploy from GitHub
  └── URL: raas.help
```

## How to Deploy from Scratch

### Prerequisites
- Google Cloud account with billing enabled
- Vercel account
- GitHub repository
- Database credentials

### Step 1: Database Setup
```sql
-- Create tables (run once)
CREATE TABLE minute_stock (...);
CREATE TABLE minute_btc (...);
CREATE TABLE trading_calendar (...);
CREATE TABLE baseline_daily (...);
CREATE TABLE trade_events_rth_equal_mean (...);
-- ... create all 10 event tables
```

### Step 2: Import Data
```bash
# Import historical stock and BTC data
node processor/daily-update-job-fixed.js
```

### Step 3: Calculate Baselines
```bash
# Calculate baselines for all stocks
node processor/calculate-baselines.js
```

### Step 4: Generate Events
Use the 3-block deployment pattern (see HOW_WE_WORK_TOGETHER.md)

### Step 5: Deploy API
```bash
cd api-server
vercel --prod
```

### Step 6: Deploy Frontend
```bash
cd frontend-dashboard
vercel --prod
```

## Key Configuration

### Database Connection
```javascript
const pool = new pg.Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});
```

### Environment Variables (Cloud Run)
```
DB_HOST=34.41.97.179
DB_PORT=5432
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=Fu3lth3j3t!
METHOD=EQUAL_MEAN (or other method)
SESSION=RTH (or AH)
```

### Environment Variables (Vercel)
```
NEXT_PUBLIC_API_URL=https://api-server-neon-five.vercel.app
DB_HOST=34.41.97.179
DB_PORT=5432
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=Fu3lth3j3t!
```

## Reports Available

### 1. Fast Daily
Shows all trade events with portfolio tracking.

### 2. Grid Search
7×7 heatmap of all buy/sell combinations.

### 3. Daily Curve
Cumulative return chart over time.

### 4. Multi-Stock Daily Curve
Compare multiple stocks on same chart.

### 5. Best Performers (Range)
Top performers across extended threshold ranges.

### 6. Baseline Lab
Test different baseline calculation methods.

### 7. Method Comparison
Compare all 5 baseline methods side-by-side.

### 8. Session Analysis
Compare RTH vs AH performance.

### 9. Trade Analysis
Detailed trade-by-trade breakdown.

### 10. Coverage Report
Data quality and coverage analysis.

### 11. Real vs Projected
Compare actual vs projected returns.

## Troubleshooting

### Events Not Generating
1. Check database connection
2. Verify baseline data exists
3. Check Cloud Run logs
4. Verify formula is correct

### Wrong Event Counts
1. Verify sell threshold formula: `baseline * (1 - sellPct / 100)`
2. Check for duplicate events
3. Verify date ranges

### Reports Not Loading
1. Check API endpoint is deployed
2. Verify database credentials in Vercel
3. Check browser console for errors
4. Clear browser cache

## Performance Optimization

### Event Generation
- Batch size: 1500 events per INSERT
- Database connections: 50 parallel
- Throughput: 20-25k events/second
- Time: ~2 hours for all 10 tables

### Query Performance
- Most queries: <2 seconds
- Grid search: <3 seconds
- Daily curve: <2 seconds
- Use indexes on symbol, buy_pct, sell_pct, date

## Cost Breakdown

**Monthly Costs:**
- Database: ~$70/month (Google Cloud PostgreSQL)
- Vercel: $0 (free tier)
- Total: ~$70/month

**One-Time Costs:**
- Event generation: ~$15 per full run
- Typically run once, then incremental updates

---

## Summary

This system analyzes Bitcoin mining stocks by comparing their price movements to Bitcoin. It generates millions of trading events across different strategies to help identify optimal buy/sell thresholds. The key is the correct formula for sell thresholds (baseline × (1 - sell%)) which creates proper trading spreads.