# 🚀 QUICK START GUIDE - Analytics Platform Build

## TL;DR - What You Need to Know in 60 Seconds

**Goal**: Build a web app to backtest Bitcoin mining stock trading strategies and find optimal settings.

**What it does**: 
- Test different baseline methods and buy/sell thresholds
- Simulate historical trading to see what would have performed best
- Run grid searches across thousands of parameter combinations
- Help optimize live trading system settings

**Tech Stack**: Google Cloud + Streamlit (or React) + PostgreSQL (or BigQuery)

**Data Available**: 
- Minute-level stock prices (9 mining stocks)
- Minute-level Bitcoin prices
- Pre-calculated daily baselines
- ~120 days of historical data, expandable

---

## 🎯 MVP Features (Build These First)

### 1. Single Symbol Backtester
**Input**: Symbol, Date Range, Baseline Method, Buy%, Sell%
**Output**: Equity curve, ROI, trade count, win rate

**Example**:
- Symbol: RIOT
- Date Range: Oct 1 - Dec 31, 2024
- Baseline: WINSORIZED
- Buy Threshold: 1.0%
- Sell Threshold: 2.0%
- Result: ROI = 15.3%, 47 trades, 63% win rate

### 2. Grid Search Optimizer
**Input**: Symbol, Date Range, Baseline Methods (multi), Buy% range, Sell% range
**Output**: Heatmap showing ROI for each combination, top 10 performers

**Example**:
- Test all 5 baseline methods
- Buy range: 0.5% to 2.0% (step 0.1)
- Sell range: 1.0% to 4.0% (step 0.1)
- Result: Best combo = WINSORIZED + 1.2% buy + 2.3% sell = 18.7% ROI

### 3. Multi-Symbol Batch
**Input**: Multiple symbols, Date Range, Settings
**Output**: Performance comparison across symbols

---

## 📊 The Trading Logic (Core Algorithm)

```javascript
// For each minute in the date range:

// 1. Get current prices
const btcPrice = getCurrentBTCPrice(minute);
const stockPrice = getCurrentStockPrice(symbol, minute);

// 2. Calculate current ratio
const currentRatio = btcPrice / stockPrice;

// 3. Get baseline (from previous N days)
const baseline = getBaseline(symbol, date, session, method);

// 4. Calculate difference percentage
const diffPct = ((currentRatio - baseline) / baseline) * 100;

// 5. Make trading decision
if (diffPct > buyThreshold) {
    // Stock is "cheap" relative to BTC
    action = "BUY";
} else if (diffPct < -sellThreshold) {
    // Stock is "expensive" relative to BTC
    action = "SELL";
} else {
    action = "HOLD";
}

// 6. Update portfolio
if (action === "BUY" && cash > 0) {
    shares += Math.floor(cash / stockPrice);
    cash = 0;
} else if (action === "SELL" && shares > 0) {
    cash += shares * stockPrice;
    shares = 0;
}

// 7. Track equity
equity = cash + (shares * stockPrice);
```

---

## 🗄️ Database Tables You Have Access To

### `minute_stock`
```sql
SELECT symbol, bar_time, open, high, low, close, volume, session
FROM minute_stock
WHERE symbol = 'RIOT'
  AND bar_time BETWEEN '2024-10-01' AND '2024-12-31'
  AND session = 'RTH'
ORDER BY bar_time;
```

### `minute_btc`
```sql
SELECT bar_time, open, high, low, close, volume, session
FROM minute_btc
WHERE bar_time BETWEEN '2024-10-01' AND '2024-12-31'
  AND session = 'RTH'
ORDER BY bar_time;
```

### `baseline_daily`
```sql
SELECT symbol, session, trading_day, method, baseline, sample_count
FROM baseline_daily
WHERE symbol = 'RIOT'
  AND session = 'RTH'
  AND trading_day = '2024-10-15'
  AND method = 'WINSORIZED';
```

---

## 🔧 5 Baseline Methods (Must Support All)

### 1. VWAP_RATIO
```javascript
// Volume-weighted average price ratio
baseline = sum(btc_vwap * volume) / sum(stock_vwap * volume)
```

### 2. VOL_WEIGHTED
```javascript
// Volume-weighted average of minute ratios
ratios = btc_close / stock_close for each minute
baseline = sum(ratio * volume) / sum(volume)
```

### 3. WINSORIZED
```javascript
// Remove outliers (top/bottom 5%), then average
ratios = btc_close / stock_close for each minute
remove top 5% and bottom 5%
baseline = average(remaining ratios)
```

### 4. WEIGHTED_MEDIAN
```javascript
// Median weighted by volume
ratios = btc_close / stock_close for each minute
baseline = weighted_median(ratios, weights=volume)
```

### 5. EQUAL_MEAN
```javascript
// Simple average
ratios = btc_close / stock_close for each minute
baseline = average(ratios)
```

---

## 📈 Performance Metrics to Calculate

```javascript
// 1. ROI (Return on Investment)
roi = ((finalEquity - initialCapital) / initialCapital) * 100;

// 2. Total Trades
totalTrades = buyCount + sellCount;

// 3. Win Rate
winRate = (winningTrades / totalTrades) * 100;

// 4. Max Drawdown
maxDrawdown = max((peak - trough) / peak) * 100;

// 5. Sharpe Ratio
sharpeRatio = (avgReturn - riskFreeRate) / stdDevReturns;

// 6. Average Trade
avgTrade = totalProfit / totalTrades;
```

---

## 🏗️ Recommended Architecture

### Option 1: Simple & Fast (Recommended for MVP)
```
Frontend: Streamlit (Python)
Backend: Python functions (in same app)
Database: PostgreSQL (existing Tradiac DB)
Deployment: Google Cloud Run
```

**Pros**: Fast to build, easy to iterate
**Cons**: Less polished UI

### Option 2: Production-Ready
```
Frontend: React + Firebase Hosting
Backend: Cloud Functions (Node.js)
Database: PostgreSQL + BigQuery (for grid searches)
Deployment: Firebase + Cloud Run
```

**Pros**: Professional, scalable
**Cons**: Longer development time

---

## 🚦 Implementation Steps

### Step 1: Set Up (Day 1)
1. Create new Google Cloud project
2. Connect to existing PostgreSQL database
3. Test data access (query minute_stock, minute_btc)
4. Set up Streamlit app skeleton

### Step 2: Single Backtest (Day 2-3)
1. Build data fetching functions
2. Implement backtesting engine
3. Calculate performance metrics
4. Create simple UI with inputs/outputs
5. Generate equity curve chart

### Step 3: Grid Search (Day 4-5)
1. Implement parameter grid generation
2. Run multiple backtests in parallel
3. Aggregate results into matrix
4. Create heatmap visualization
5. Show top 10 performers

### Step 4: Multi-Symbol (Day 6-7)
1. Add symbol selection (multi-select)
2. Run backtests for each symbol
3. Create comparison table
4. Add export functionality

### Step 5: Polish & Deploy (Day 8-10)
1. Add error handling
2. Optimize performance
3. Add documentation
4. Deploy to Cloud Run
5. Test with real data

---

## 💡 Key Insights from Existing Tools

### From baseline_unified_app_fast_daily_btc_overlay_v2.py:

**Important Functions to Replicate**:
- `compute_daily_baselines()` - Calculate all 5 baseline methods
- `compute_daily_curve()` - Run backtest simulation
- `filter_window_str()` - Filter by RTH/AH sessions
- `prev_n_days_for()` - Get previous N trading days

**Important Concepts**:
- **Sessions**: RTH (9:30 AM - 4:00 PM ET) vs AH (After Hours)
- **Lookback**: Use previous N days to calculate baseline (default N=1)
- **Sizing Modes**: 
  - REINVEST: Use all available capital (all-in)
  - BASE_BUDGET: Fixed capital per symbol
- **Liquidity Filters**: Min shares/minute, min $/minute, max % of volume

### From bitcorr_analyzer.py:

**Advanced Features (Phase 2)**:
- Regime detection (classify market conditions)
- Confidence scoring (rate baseline reliability)
- Correlation analysis (BTC-stock relationship strength)

---

## 🎯 Success Criteria

You'll know it's working when:
1. ✅ Can run single backtest in < 5 seconds
2. ✅ Can test 100 combinations in < 30 seconds
3. ✅ Results match expectations (positive ROI for good settings)
4. ✅ Can export trade logs and performance metrics
5. ✅ UI is intuitive and responsive

---

## 🐛 Common Pitfalls to Avoid

1. **Don't recalculate baselines on every minute** - Pre-calculate daily baselines
2. **Don't fetch all data at once** - Use date range filters in SQL
3. **Don't process in Python loops** - Use vectorized operations (pandas/numpy)
4. **Don't forget session filtering** - RTH vs AH matters
5. **Don't assume all orders fill** - For now yes, but plan for slippage later

---

## 📚 Files to Reference

1. **PROJECT_HANDOFF_NEXT_CHAT.md** - Complete detailed spec
2. **baseline_unified_app_fast_daily_btc_overlay_v2.py** - Current Python tool
3. **bitcorr_analyzer.py** - Advanced analytics tool
4. **Tradiac database schema** - From previous project

---

## 🎬 First Steps for Next Chat

1. **Confirm understanding**: "I understand we're building a backtesting platform for Bitcoin mining stocks"
2. **Ask clarifying questions**: Frontend preference? Database strategy?
3. **Propose architecture**: "I recommend Streamlit + PostgreSQL for MVP"
4. **Start coding**: "Let me create the data access layer first"

---

## 💬 Example Opening Message for Next Chat

```
Hi! I'm ready to build the Bitcoin mining stock analytics platform. 

Based on the handoff document, I understand we're creating a backtesting 
tool to optimize trading settings. The MVP includes:
1. Single symbol backtester
2. Grid search optimizer  
3. Multi-symbol batch runner

I have access to your PostgreSQL database with minute-level stock and 
Bitcoin data, plus pre-calculated baselines.

My recommendation for MVP:
- Frontend: Streamlit (Python) for fast development
- Backend: Python functions (same app)
- Database: PostgreSQL (existing)
- Deployment: Google Cloud Run

Questions before I start:
1. Do you prefer Streamlit or React for the frontend?
2. Should I optimize for speed (PostgreSQL only) or scale (add BigQuery)?
3. What's your priority: get MVP working fast, or build for production?

Ready to start coding when you are!
```

---

**Good luck with the next chat!** 🚀