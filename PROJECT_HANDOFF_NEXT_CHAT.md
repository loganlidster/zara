# 🎯 PROJECT HANDOFF: Bitcoin Mining Stock Testing & Analytics Platform

## EXECUTIVE SUMMARY

The user wants to build a **comprehensive backtesting and analytics platform** to optimize trading settings for their Bitcoin-correlated mining stock trading system. This is a **standalone Google Cloud application** (similar to their existing Tradiac trading system) that will analyze historical data to find optimal baseline methods and buy/sell thresholds.

---

## 🎯 PROJECT GOAL

Build a web-based analytics platform that:
1. **Simulates historical trading** with different settings
2. **Identifies optimal parameters** (baseline methods, buy/sell percentages)
3. **Analyzes Bitcoin correlation patterns** to predict when settings should change
4. **Provides actionable insights** to improve live trading performance

---

## 📊 WHAT WE'RE BUILDING

### Core Functionality (Phase 1 - MVP)
1. **Single Symbol Backtester**
   - Select: Date range, Symbol, Baseline method, Buy%, Sell%
   - Output: Performance metrics (ROI, trades, win rate, etc.)
   - Simulate: Assumes full fills on all orders, carry positions overnight

2. **Grid Search Optimizer**
   - Test multiple baseline methods simultaneously
   - Test range of buy/sell percentages (e.g., buy 0.5%-2.0%, sell 1.0%-4.0%)
   - Output: Heatmap showing which combinations performed best

3. **Multi-Symbol Batch Runner**
   - Run backtests across all 9 mining stocks
   - Compare performance across symbols
   - Identify which stocks respond best to which settings

### Advanced Functionality (Phase 2 - Future)
4. **Bitcoin Correlation Analyzer**
   - Detect when market "overreacts" (BTC -3%, Stock -10%)
   - Find patterns in correlation breakdowns
   - Predict when to adjust settings based on market conditions

5. **Regime Detection & Auto-Adjustment**
   - Identify market regimes (high volatility, low volatility, trending, etc.)
   - Automatically recommend baseline method changes
   - Suggest buy/sell threshold adjustments

---

## 🗄️ DATA WE ALREADY HAVE (Tradiac Database)

### PostgreSQL Tables Available:
1. **`minute_stock`** - Minute-level stock price data
   - Columns: `symbol`, `bar_time`, `open`, `high`, `low`, `close`, `volume`, `session` (RTH/AH)
   - Data: All 9 mining stocks (RIOT, HIVE, BTDR, MARA, CORZ, CLSK, HUT, CAN, CIFR)

2. **`minute_btc`** - Minute-level Bitcoin price data
   - Columns: `bar_time`, `open`, `high`, `low`, `close`, `volume`, `session` (RTH/AH)
   - Data: Bitcoin prices aligned with stock data

3. **`baseline_daily`** - Pre-calculated daily baselines
   - Columns: `symbol`, `session`, `trading_day`, `method`, `baseline`, `sample_count`
   - Methods: VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN, EQUAL_MEAN

4. **`execution_orders`** - Live trading order history (for validation)
   - Real-world order data to compare against simulations

### Data Coverage:
- **Historical depth**: October 2024 - Present (expandable via Polygon.io API)
- **Granularity**: Minute-level bars
- **Sessions**: RTH (9:30 AM - 4:00 PM ET) and AH (After Hours)
- **Symbols**: 9 Bitcoin mining stocks + Bitcoin

---

## 🏗️ ARCHITECTURE DECISIONS

### Technology Stack (Recommended):
1. **Frontend**: Google Cloud Run + Streamlit (like current Python tools)
   - OR: Firebase Hosting + React (like Tradiac frontend)
   - User preference: Streamlit for faster development

2. **Backend**: Google Cloud Functions (Node.js or Python)
   - Compute-intensive backtests
   - Batch processing for grid searches

3. **Database Options**:
   - **PostgreSQL** (existing Tradiac DB): For moderate data volumes
   - **BigQuery**: For massive grid searches (millions of combinations)
   - **Hybrid approach**: PostgreSQL for data storage, BigQuery for analytics

4. **Data Pipeline**:
   - Use existing Polygon.io integration for historical data
   - Leverage existing `minute_stock` and `minute_btc` tables
   - Pre-calculate baselines (already done in `baseline_daily`)

---

## 📋 CURRENT TESTING TOOLS (Python/Streamlit)

The user has two existing Python tools that we're replicating/improving:

### 1. **baseline_unified_app_fast_daily_btc_overlay_v2.py** (2,740 lines)
**Purpose**: Main backtesting and analysis tool

**Key Features**:
- **Backfill Tab**: Download historical data from Polygon.io
- **Baseline Tab**: Calculate baselines for specific dates
- **Threshold Grid Tab**: Test buy/sell % ranges for single symbol
- **Daily Curve Tab**: Analyze daily performance with ROI curves
- **Batch (Fast) Tab**: Multi-symbol grid search
- **Trade Detail Tab**: View individual trade logs
- **Coverage Tab**: Check data availability

**Core Functions**:
- `compute_daily_baselines()` - Calculate 5 baseline methods
- `compute_daily_curve()` - Simulate trading for a date range
- `filter_window_str()` - Filter by RTH/AH/Custom time windows
- `vwap_ratio()`, `vol_weighted_ratio()`, etc. - Baseline calculations

**Key Concepts**:
- **Baseline Methods**: 5 different ways to calculate BTC/Stock ratio
  1. VWAP_RATIO - Volume-weighted average price ratio
  2. VOL_WEIGHTED - Volume-weighted with optional winsorization
  3. WINSORIZED - Removes outliers before averaging
  4. WEIGHTED_MEDIAN - Median with volume weighting
  5. EQUAL_MEAN - Simple average of all ratios

- **Trading Logic**:
  - Calculate current ratio: `BTC_price / Stock_price`
  - Compare to baseline: `difference_pct = (current_ratio - baseline) / baseline * 100`
  - **BUY** if `difference_pct > buy_threshold%` (stock is "cheap" relative to BTC)
  - **SELL** if `difference_pct < -sell_threshold%` (stock is "expensive" relative to BTC)

- **Assumptions**:
  - All orders fill immediately at limit price
  - Carry positions overnight (no EOD flatten)
  - Can use "REINVEST" mode (all-in) or "BASE_BUDGET" mode (fixed capital per symbol)

### 2. **bitcorr_analyzer.py** (607 lines)
**Purpose**: Advanced correlation and regime analysis

**Key Features**:
- **Regime Detection**: Classify market conditions (high/low volatility, trending, etc.)
- **Confidence Scoring**: Rate how reliable each baseline method is
- **Correlation Analysis**: Measure BTC-stock correlation strength
- **Sharpe-like Metrics**: Risk-adjusted return calculations

**Core Functions**:
- `load_actions()` - Load historical buy/sell signals
- `regime_bins()` - Classify market into regimes (quantile or fixed bins)
- `sharpe_like()` - Calculate risk-adjusted performance
- `equity_from_returns()` - Build equity curve from returns

---

## 🎯 WHAT NEEDS TO BE BUILT

### Phase 1: Core Backtesting Platform (MVP)

#### 1. **Data Access Layer**
- [ ] Connect to existing PostgreSQL database
- [ ] Query `minute_stock`, `minute_btc`, `baseline_daily` tables
- [ ] Handle date range filtering and session filtering (RTH/AH)
- [ ] Optimize queries for performance (millions of rows)

#### 2. **Backtesting Engine**
- [ ] Implement trading simulation logic:
  ```
  For each minute in date range:
    1. Get current BTC price and Stock price
    2. Calculate current ratio = BTC / Stock
    3. Get baseline for that day/session/method
    4. Calculate difference_pct = (ratio - baseline) / baseline * 100
    5. If difference_pct > buy_threshold: BUY (if cash available)
    6. If difference_pct < -sell_threshold: SELL (if shares held)
    7. Track: position, cash, equity, trades
  ```
- [ ] Support multiple baseline methods
- [ ] Support RTH/AH session filtering
- [ ] Track performance metrics: ROI, # trades, win rate, max drawdown, Sharpe ratio

#### 3. **Grid Search Optimizer**
- [ ] Test multiple baseline methods simultaneously
- [ ] Test range of buy/sell thresholds (e.g., buy: 0.5-2.0%, sell: 1.0-4.0%)
- [ ] Generate performance matrix (heatmap)
- [ ] Identify top-performing combinations
- [ ] **Challenge**: This could be millions of combinations
  - 5 methods × 16 buy thresholds × 31 sell thresholds × 9 symbols × 365 days = ~8M simulations
  - **Solution**: Use BigQuery for parallel processing OR optimize with vectorized operations

#### 4. **Web Interface (Streamlit or React)**
- [ ] **Single Backtest View**:
  - Inputs: Symbol, Date Range, Baseline Method, Buy%, Sell%
  - Outputs: Equity curve chart, performance metrics, trade log
- [ ] **Grid Search View**:
  - Inputs: Symbol, Date Range, Baseline Methods (multi-select), Buy% range, Sell% range
  - Outputs: Heatmap of ROI by buy/sell combination, top 10 performers
- [ ] **Multi-Symbol Batch View**:
  - Inputs: Symbols (multi-select), Date Range, Settings
  - Outputs: Comparison table, best symbol for each setting

#### 5. **Export & Reporting**
- [ ] Export trade logs to CSV
- [ ] Export performance summaries
- [ ] Generate PDF reports (optional)

### Phase 2: Advanced Analytics (Future)

#### 6. **Bitcoin Correlation Analyzer**
- [ ] Calculate rolling correlation between BTC and each stock
- [ ] Detect "overreaction" events (BTC -3%, Stock -10%)
- [ ] Identify patterns in correlation breakdowns
- [ ] Predict when correlation will strengthen/weaken

#### 7. **Regime Detection**
- [ ] Classify market conditions (volatility, trend, etc.)
- [ ] Recommend baseline method changes based on regime
- [ ] Auto-adjust buy/sell thresholds based on conditions

#### 8. **Machine Learning Integration**
- [ ] Train models to predict optimal settings
- [ ] Feature engineering: volatility, volume, correlation, etc.
- [ ] Real-time setting recommendations

---

## 🔑 KEY DESIGN DECISIONS NEEDED

### 1. **Database Strategy**
**Option A: PostgreSQL Only**
- ✅ Pros: Use existing data, simpler architecture
- ❌ Cons: May be slow for massive grid searches

**Option B: PostgreSQL + BigQuery**
- ✅ Pros: Fast parallel processing for grid searches
- ❌ Cons: More complex, data duplication, cost

**Option C: Hybrid**
- Use PostgreSQL for data storage and single backtests
- Use BigQuery for massive grid searches (export data as needed)

**Recommendation**: Start with PostgreSQL, migrate to BigQuery if performance becomes an issue.

### 2. **Frontend Framework**
**Option A: Streamlit (Python)**
- ✅ Pros: Faster development, user already familiar
- ❌ Cons: Less polished UI, harder to customize

**Option B: React + Firebase (like Tradiac)**
- ✅ Pros: Professional UI, better user experience
- ❌ Cons: Longer development time

**Recommendation**: Start with Streamlit for MVP, migrate to React if needed.

### 3. **Computation Strategy**
**Option A: On-Demand Computation**
- Run backtests when user clicks "Run"
- ✅ Pros: Always up-to-date, flexible
- ❌ Cons: Slow for large grid searches

**Option B: Pre-Computed Results**
- Pre-calculate common scenarios, store in database
- ✅ Pros: Instant results
- ❌ Cons: Storage overhead, less flexible

**Option C: Hybrid**
- Pre-compute common scenarios (e.g., standard date ranges)
- On-demand for custom queries

**Recommendation**: Start with on-demand, add caching for common queries.

---

## 📊 DATA VOLUME ESTIMATES

### Current Data:
- **Minute bars per symbol per day**: ~390 (RTH) + ~1,050 (AH) = ~1,440 minutes
- **Days of data**: ~120 days (Oct 2024 - Feb 2025)
- **Total rows per symbol**: 1,440 × 120 = ~172,800 rows
- **Total rows (9 symbols)**: 172,800 × 9 = ~1.5M rows
- **With Bitcoin**: ~1.7M rows total

### Grid Search Volume:
- **Single symbol, single date range**:
  - 5 methods × 16 buy thresholds × 31 sell thresholds = 2,480 combinations
  - Each combination processes ~172,800 rows
  - Total: ~428M row operations

- **All symbols, 1 year**:
  - 2,480 combinations × 9 symbols × 365 days = ~8.1M simulations
  - This is where BigQuery becomes valuable

---

## 🚀 RECOMMENDED IMPLEMENTATION PLAN

### Week 1: Foundation
1. Set up Google Cloud project
2. Connect to existing PostgreSQL database
3. Build basic data access layer
4. Implement single backtest engine
5. Create simple Streamlit UI for single backtests

### Week 2: Grid Search
1. Implement grid search logic
2. Optimize for performance (vectorization, parallel processing)
3. Add grid search UI
4. Generate heatmaps and top performers

### Week 3: Multi-Symbol & Polish
1. Add multi-symbol batch processing
2. Implement export functionality
3. Add performance metrics (Sharpe, max drawdown, etc.)
4. Polish UI and add documentation

### Week 4: Advanced Features (Optional)
1. Add correlation analyzer
2. Implement regime detection
3. Add predictive scoring
4. Deploy to production

---

## 📝 QUESTIONS FOR NEXT CHAT

1. **Frontend preference**: Streamlit (fast) or React (polished)?
2. **Database strategy**: PostgreSQL only, or add BigQuery for grid searches?
3. **Deployment target**: Google Cloud Run, Cloud Functions, or Firebase?
4. **Priority features**: Which features are must-have for MVP?
5. **Data range**: How much historical data do you want to analyze? (affects performance)
6. **Real-time updates**: Do you want to automatically fetch new data daily?

---

## 🎯 SUCCESS CRITERIA

The platform is successful when you can:
1. ✅ Run a backtest for any symbol/date range in < 5 seconds
2. ✅ Test 100+ parameter combinations in < 30 seconds
3. ✅ Identify the best-performing settings for each symbol
4. ✅ Export results for further analysis
5. ✅ Make data-driven decisions to improve live trading performance

---

## 📚 REFERENCE FILES TO SHARE WITH NEXT CHAT

1. **baseline_unified_app_fast_daily_btc_overlay_v2.py** - Current testing tool
2. **bitcorr_analyzer.py** - Correlation analysis tool
3. **Database schema** - From Tradiac project
4. **This handoff document** - Complete context

---

## 💡 KEY INSIGHTS FROM CURRENT TOOLS

### Trading Logic (Critical to Replicate):
```python
# Calculate ratio
current_ratio = btc_close / stock_close

# Get baseline (from previous N days)
baseline = calculate_baseline(previous_days, method)

# Calculate difference
diff_pct = (current_ratio - baseline) / baseline * 100

# Trading signals
if diff_pct > buy_threshold:
    # Stock is "cheap" relative to BTC - BUY
    action = "BUY"
elif diff_pct < -sell_threshold:
    # Stock is "expensive" relative to BTC - SELL
    action = "SELL"
else:
    action = "HOLD"
```

### Baseline Methods (All 5 Must Be Supported):
1. **VWAP_RATIO**: `sum(btc_vwap * volume) / sum(stock_vwap * volume)`
2. **VOL_WEIGHTED**: Volume-weighted average of ratios, with optional outlier removal
3. **WINSORIZED**: Remove top/bottom 5% outliers, then average
4. **WEIGHTED_MEDIAN**: Median of ratios weighted by volume
5. **EQUAL_MEAN**: Simple average of all minute ratios

### Performance Metrics (Must Calculate):
- **ROI**: `(final_equity - initial_capital) / initial_capital * 100`
- **Total Trades**: Count of buy + sell transactions
- **Win Rate**: `winning_trades / total_trades * 100`
- **Max Drawdown**: Largest peak-to-trough decline
- **Sharpe Ratio**: Risk-adjusted return
- **Average Trade**: Average profit/loss per trade

---

## 🎬 READY TO START

This document provides everything needed to start building the analytics platform. The next chat should:
1. Review this document
2. Ask clarifying questions
3. Propose an architecture
4. Start building the MVP

**Good luck!** 🚀