# 🎯 TRADIAC TRADING SYSTEM - Complete Technical Explanation

## EXECUTIVE SUMMARY

Tradiac is an **autonomous Bitcoin-correlated trading system** that trades 9 Bitcoin mining stocks based on their price relationship with Bitcoin. The system capitalizes on market inefficiencies where mining stocks overreact to Bitcoin price movements, buying when stocks are "cheap" relative to Bitcoin and selling when they're "expensive."

**Core Insight**: Bitcoin mining companies' stock prices should correlate with Bitcoin's price (since they mine Bitcoin), but the market often overreacts. When Bitcoin drops 3% but a mining stock drops 10%, that's an overreaction - the stock is now "cheap" relative to Bitcoin. Tradiac detects and exploits these inefficiencies.

---

## 🏗️ SYSTEM ARCHITECTURE

### Technology Stack
- **Frontend**: React + Firebase Hosting (web-based UI)
- **Backend**: Google Cloud Functions (Node.js)
- **Database**: PostgreSQL (hosted on Google Cloud SQL)
- **Data Source**: Polygon.io API (minute-level market data)
- **Broker**: Alpaca Markets API (order execution)
- **Deployment**: Google Cloud Platform (fully serverless)

### System Components
1. **Data Collection** - Fetches minute-level price data for BTC and 9 mining stocks
2. **Baseline Calculation** - Computes daily "normal" BTC/Stock price ratios
3. **Trading Engine** - Makes buy/sell decisions based on ratio deviations
4. **Order Management** - Places and tracks orders via Alpaca
5. **Portfolio Management** - Manages multiple wallets with different strategies
6. **Monitoring & Analytics** - Tracks performance and errors

---

## 📊 THE CORE TRADING CONCEPT

### The Ratio-Based Strategy

**Fundamental Principle**: 
The price of a Bitcoin mining stock should have a stable relationship with Bitcoin's price. We measure this relationship as a **ratio**:

```
Ratio = Bitcoin Price / Stock Price
```

**Example**:
- Bitcoin: $67,000
- RIOT stock: $10.00
- Ratio: 67,000 / 10 = 6,700

### Why This Works

**Normal Market Behavior**:
- Bitcoin up 2% → Mining stocks up ~2-3%
- Bitcoin down 2% → Mining stocks down ~2-3%
- Ratio stays relatively stable

**Market Overreaction** (Our Opportunity):
- Bitcoin down 3% → Mining stock down 10% ❌ OVERREACTION
  - Stock is now "cheap" relative to Bitcoin
  - Ratio has increased significantly
  - **Action: BUY the stock**

- Bitcoin up 2% → Mining stock up 8% ❌ OVERREACTION
  - Stock is now "expensive" relative to Bitcoin
  - Ratio has decreased significantly
  - **Action: SELL the stock**

### The Baseline Concept

**What is a Baseline?**
A baseline is the "normal" or "expected" ratio between Bitcoin and a stock. We calculate this using historical data to establish what the ratio typically is under normal conditions.

**Example**:
- Historical average ratio for RIOT: 6,500
- Current ratio: 7,150
- Difference: +10% above baseline
- **Interpretation**: RIOT is 10% cheaper than normal relative to Bitcoin
- **Action**: BUY signal

---

## 🔢 BASELINE CALCULATION METHODS

The system supports **5 different methods** to calculate baselines, each with different strengths:

### 1. VWAP_RATIO (Volume-Weighted Average Price Ratio)
**Formula**:
```
baseline = sum(btc_vwap × volume) / sum(stock_vwap × volume)
```

**How it works**:
- Uses volume-weighted average prices (VWAP) from each minute
- Gives more weight to high-volume periods
- Smooths out noise from low-liquidity moments

**Best for**: Liquid stocks with consistent volume

### 2. VOL_WEIGHTED (Volume-Weighted Ratio Average)
**Formula**:
```
For each minute: ratio = btc_close / stock_close
baseline = sum(ratio × volume) / sum(volume)
```

**How it works**:
- Calculates ratio for each minute
- Weights each ratio by its trading volume
- Optional winsorization (removes extreme outliers)

**Best for**: Stocks with variable liquidity

### 3. WINSORIZED (Outlier-Resistant Average)
**Formula**:
```
1. Calculate ratios for all minutes
2. Remove top 5% and bottom 5% (outliers)
3. baseline = average(remaining ratios)
```

**How it works**:
- Removes extreme values that could skew the average
- Protects against flash crashes or spikes
- More robust to anomalies

**Best for**: Volatile stocks with occasional extreme moves

### 4. WEIGHTED_MEDIAN (Volume-Weighted Median)
**Formula**:
```
baseline = weighted_median(ratios, weights=volume)
```

**How it works**:
- Finds the middle value (median) instead of average
- Weights by volume
- Extremely resistant to outliers

**Best for**: Stocks with frequent outliers or gaps

### 5. EQUAL_MEAN (Simple Average)
**Formula**:
```
baseline = average(all ratios)
```

**How it works**:
- Simple arithmetic mean of all minute ratios
- No weighting, no filtering
- Fastest to calculate

**Best for**: Stable stocks with consistent behavior

---

## ⚙️ HOW THE TRADING ENGINE WORKS

### Step-by-Step Execution Flow

#### 1. Data Collection (Every Minute)
```javascript
// Fetch latest prices
const btcPrice = await getLatestBTCPrice();
const stockPrice = await getLatestStockPrice(symbol);

// Store in database
await saveToDatabase({
  symbol: symbol,
  bar_time: currentMinute,
  close: stockPrice,
  volume: volume,
  session: isRTH ? 'RTH' : 'AH'
});
```

#### 2. Baseline Retrieval
```javascript
// Get today's baseline (calculated from previous day's data)
const baseline = await getBaseline(symbol, session, method);

// Example result:
// baseline = 6,500 (for RIOT in RTH session using WINSORIZED method)
```

#### 3. Current Ratio Calculation
```javascript
const currentRatio = btcPrice / stockPrice;

// Example:
// btcPrice = $67,000
// stockPrice = $9.50
// currentRatio = 7,052.63
```

#### 4. Deviation Analysis
```javascript
const difference = currentRatio - baseline;
const differencePct = (difference / baseline) * 100;

// Example:
// baseline = 6,500
// currentRatio = 7,052.63
// difference = 552.63
// differencePct = +8.5%
```

#### 5. Trading Decision
```javascript
let action = 'HOLD';

if (differencePct > buyThreshold) {
  // Stock is "cheap" relative to Bitcoin
  action = 'BUY';
} else if (differencePct < -sellThreshold) {
  // Stock is "expensive" relative to Bitcoin
  action = 'SELL';
}

// Example with thresholds: buy=1.0%, sell=2.0%
// differencePct = +8.5%
// 8.5% > 1.0% → BUY signal
```

#### 6. Order Execution
```javascript
if (action === 'BUY') {
  // Calculate position size
  const buyingPower = await getAccountBuyingPower();
  const maxShares = Math.floor(buyingPower / stockPrice);
  const sharesToBuy = Math.min(maxShares, 100); // Cap at 100 shares
  
  // Place limit order (1% above current price for quick fill)
  const limitPrice = stockPrice * 1.01;
  
  await placeLimitOrder({
    symbol: symbol,
    side: 'buy',
    qty: sharesToBuy,
    limit_price: limitPrice,
    time_in_force: 'day'
  });
}
```

#### 7. Order Tracking
```javascript
// Track order status
await updateOrderStatus(orderId);

// Record fills
if (order.status === 'filled') {
  await recordFill({
    order_id: orderId,
    filled_qty: order.filled_qty,
    filled_avg_price: order.filled_avg_price,
    filled_at: order.filled_at
  });
}

// Calculate metrics
const slippage = order.filled_avg_price - order.limit_price;
const timeToFill = order.filled_at - order.created_at;
```

---

## 📈 TRADING SESSIONS & TIMING

### Two Trading Sessions

#### RTH (Regular Trading Hours)
- **Time**: 9:30 AM - 4:00 PM Eastern Time
- **Characteristics**:
  - High liquidity
  - Tight spreads
  - Fast fills
  - More predictable behavior
- **Baseline**: Calculated from previous RTH session

#### AH (After Hours)
- **Time**: 4:00 PM - 9:30 AM Eastern Time (includes pre-market and after-hours)
- **Characteristics**:
  - Lower liquidity
  - Wider spreads
  - Slower fills
  - More volatile
  - Bigger overreactions
- **Baseline**: Calculated from previous AH session

### Why Separate Sessions Matter

**Different Market Dynamics**:
- RTH: Institutional traders, high volume, efficient pricing
- AH: Retail traders, low volume, emotional reactions

**Different Baselines**:
- RTH baseline for RIOT might be 6,500
- AH baseline for RIOT might be 6,800 (different normal ratio)

**Different Thresholds**:
- RTH: Tighter thresholds (buy=1.0%, sell=2.0%)
- AH: Wider thresholds (buy=1.5%, sell=3.0%) to account for volatility

---

## 💼 PORTFOLIO MANAGEMENT

### Multi-Wallet System

**Wallet Structure**:
```javascript
{
  wallet_id: "wallet_001",
  wallet_name: "Conservative Strategy",
  env: "paper", // or "live"
  alpaca_key: "...",
  alpaca_secret: "...",
  symbols: ["RIOT", "MARA", "CLSK"], // Which stocks to trade
  enabled: true
}
```

**Why Multiple Wallets?**
1. **Strategy Testing**: Test different approaches simultaneously
2. **Risk Management**: Separate capital allocations
3. **Symbol Specialization**: Some wallets trade specific stocks
4. **Paper vs Live**: Test strategies before going live

### Wallet Configuration

**Per-Symbol Settings**:
```javascript
{
  wallet_id: "wallet_001",
  symbol: "RIOT",
  enabled: true,
  method_rth: "WINSORIZED",      // Baseline method for RTH
  method_ah: "VOL_WEIGHTED",     // Baseline method for AH
  buy_threshold_rth: 1.0,        // Buy if +1.0% above baseline (RTH)
  sell_threshold_rth: 2.0,       // Sell if -2.0% below baseline (RTH)
  buy_threshold_ah: 1.5,         // Buy if +1.5% above baseline (AH)
  sell_threshold_ah: 3.0,        // Sell if -3.0% below baseline (AH)
  budget_mode: "fixed",          // or "percentage"
  budget_amount: 10000           // $10,000 per symbol
}
```

---

## 🎯 THE 9 MINING STOCKS

### Stock Selection Criteria
All stocks are Bitcoin mining companies with:
- ✅ High correlation with Bitcoin price
- ✅ Sufficient liquidity (tradeable volume)
- ✅ Listed on major exchanges
- ✅ Minute-level data available

### The Stocks
1. **RIOT** - Riot Platforms (formerly Riot Blockchain)
2. **MARA** - Marathon Digital Holdings
3. **CLSK** - CleanSpark
4. **HUT** - Hut 8 Mining
5. **BTDR** - Bitdeer Technologies
6. **CORZ** - Core Scientific
7. **CIFR** - Cipher Mining
8. **CAN** - Canaan Inc.
9. **HIVE** - HIVE Digital Technologies

### Why These Stocks?
- **Direct Bitcoin Exposure**: They mine Bitcoin, so their revenue is directly tied to BTC price
- **Market Overreaction**: Retail investors often overreact to Bitcoin moves
- **Liquidity**: Enough volume to enter/exit positions
- **Volatility**: Provides trading opportunities

---

## 📊 DATABASE SCHEMA

### Core Tables

#### 1. `minute_stock` - Stock Price Data
```sql
CREATE TABLE minute_stock (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  bar_time TIMESTAMP NOT NULL,
  open NUMERIC(10,2),
  high NUMERIC(10,2),
  low NUMERIC(10,2),
  close NUMERIC(10,2),
  volume BIGINT,
  session VARCHAR(10), -- 'RTH' or 'AH'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Store minute-level stock prices
**Data Volume**: ~1,440 minutes/day × 9 stocks = ~13,000 rows/day

#### 2. `minute_btc` - Bitcoin Price Data
```sql
CREATE TABLE minute_btc (
  id SERIAL PRIMARY KEY,
  bar_time TIMESTAMP NOT NULL,
  open NUMERIC(10,2),
  high NUMERIC(10,2),
  low NUMERIC(10,2),
  close NUMERIC(10,2),
  volume BIGINT,
  session VARCHAR(10), -- 'RTH' or 'AH'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Store minute-level Bitcoin prices
**Data Volume**: ~1,440 minutes/day = ~1,440 rows/day

#### 3. `baseline_daily` - Pre-calculated Baselines
```sql
CREATE TABLE baseline_daily (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  session VARCHAR(10) NOT NULL, -- 'RTH' or 'AH'
  trading_day DATE NOT NULL,
  method VARCHAR(50) NOT NULL, -- 'VWAP_RATIO', 'WINSORIZED', etc.
  baseline NUMERIC(18,6) NOT NULL,
  sample_count INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, session, trading_day, method)
);
```

**Purpose**: Store pre-calculated baselines for fast lookup
**Data Volume**: 9 stocks × 2 sessions × 5 methods = 90 rows/day

#### 4. `execution_snapshots` - Trading Decisions
```sql
CREATE TABLE execution_snapshots (
  snapshot_id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  wallet_id VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  session VARCHAR(10) NOT NULL,
  btc_close NUMERIC(10,2),
  stock_close NUMERIC(10,2),
  current_ratio NUMERIC(18,6),
  baseline_value NUMERIC(18,6),
  difference NUMERIC(18,6),
  difference_pct NUMERIC(10,4),
  action VARCHAR(10), -- 'BUY', 'SELL', 'HOLD'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Log every trading decision (audit trail)
**Data Volume**: ~1,440 minutes × 9 stocks = ~13,000 rows/day

#### 5. `execution_orders` - Order Tracking
```sql
CREATE TABLE execution_orders (
  order_id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  wallet_id VARCHAR(100) NOT NULL,
  snapshot_id INTEGER REFERENCES execution_snapshots(snapshot_id),
  alpaca_order_id VARCHAR(100),
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
  qty NUMERIC(10,2) NOT NULL,
  limit_price NUMERIC(10,2),
  status VARCHAR(50), -- 'new', 'filled', 'canceled', etc.
  filled_qty NUMERIC(10,2),
  filled_avg_price NUMERIC(10,2),
  filled_at TIMESTAMP,
  canceled_at TIMESTAMP,
  cancel_reason TEXT,
  time_to_accept_seconds INTEGER,
  time_to_fill_seconds INTEGER,
  time_in_market_seconds INTEGER,
  slippage NUMERIC(10,4),
  slippage_pct NUMERIC(10,4),
  fill_rate NUMERIC(10,2),
  price_improvement NUMERIC(10,4),
  last_status_check TIMESTAMP,
  last_updated_at TIMESTAMP,
  status_check_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Track all orders from placement to fill/cancel
**Data Volume**: Variable (depends on trading activity)

#### 6. `execution_order_status_history` - Order Lifecycle
```sql
CREATE TABLE execution_order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES execution_orders(order_id),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  filled_qty NUMERIC(10,2),
  filled_avg_price NUMERIC(10,2),
  changed_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Track every status change for each order
**Data Volume**: ~3-5 rows per order (new → accepted → filled)

#### 7. `wallets` - Wallet Configuration
```sql
CREATE TABLE wallets (
  wallet_id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  wallet_name VARCHAR(200),
  env VARCHAR(10), -- 'paper' or 'live'
  alpaca_key VARCHAR(200),
  alpaca_secret VARCHAR(200),
  symbols TEXT[], -- Array of symbols to trade
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Store wallet configurations
**Data Volume**: Small (typically 4-6 wallets per user)

---

## 🔄 DAILY WORKFLOW

### Nightly Baseline Calculation (Automated)
```
1. At 12:00 AM ET (after market close):
   - Fetch previous day's minute data
   - Calculate baselines for each symbol
   - Calculate for both RTH and AH sessions
   - Calculate all 5 methods
   - Store in baseline_daily table

2. Result: 90 new baseline records
   - 9 symbols × 2 sessions × 5 methods = 90 baselines
```

### Intraday Trading (Continuous)
```
Every minute during market hours:
1. Fetch latest BTC and stock prices
2. Store in minute_stock and minute_btc tables
3. For each enabled wallet:
   a. For each symbol in wallet:
      - Get current prices
      - Calculate current ratio
      - Get baseline for today
      - Calculate difference percentage
      - Make trading decision (BUY/SELL/HOLD)
      - If BUY or SELL: place order
      - Log decision in execution_snapshots
4. Track all open orders
5. Update order status when filled/canceled
```

### Order Management (Continuous)
```
Every few minutes:
1. Check status of all open orders
2. Update execution_orders table
3. Record status changes in execution_order_status_history
4. Calculate metrics (slippage, time to fill, etc.)
5. Cancel stale orders (end of day)
```

---

## 📊 PERFORMANCE METRICS & MONITORING

### Real-Time Metrics
1. **Order Fill Rate**: % of orders that fill
2. **Average Time to Fill**: How long orders take to execute
3. **Slippage**: Difference between limit price and fill price
4. **Win Rate**: % of profitable trades
5. **Daily P&L**: Profit/loss for the day
6. **Position Sizes**: Current holdings per symbol

### Historical Metrics
1. **Cumulative ROI**: Total return since inception
2. **Sharpe Ratio**: Risk-adjusted returns
3. **Max Drawdown**: Largest peak-to-trough decline
4. **Trade Frequency**: Trades per day/week
5. **Best/Worst Performers**: Which symbols/settings work best

### System Health Metrics
1. **Data Freshness**: Are we getting real-time data?
2. **Error Rate**: How many errors per hour?
3. **API Latency**: How fast are Alpaca/Polygon responding?
4. **Database Performance**: Query execution times

---

## 🎯 WHY THIS SYSTEM WORKS

### The Edge
1. **Speed**: Automated execution beats manual trading
2. **Discipline**: No emotional decisions
3. **Consistency**: Same logic applied every time
4. **Scalability**: Can trade multiple symbols simultaneously
5. **Data-Driven**: Decisions based on quantitative analysis

### Market Inefficiency Exploited
**Human Behavior**:
- Retail investors overreact to Bitcoin moves
- Fear and greed drive irrational pricing
- Mining stocks often move 2-3x Bitcoin's percentage move

**Our Advantage**:
- We measure the "normal" relationship (baseline)
- We detect when the relationship breaks down
- We profit when the relationship reverts to normal

### Risk Management
1. **Position Limits**: Cap at 100 shares per order
2. **Diversification**: Trade 9 different stocks
3. **Stop Losses**: (Future feature)
4. **Paper Trading**: Test strategies before going live
5. **Multiple Wallets**: Isolate risk per strategy

---

## 🔮 WHAT THE ANALYTICS PLATFORM WILL DO

### The Problem We're Solving
**Current State**: We have a working trading system, but we don't know:
- Which baseline method works best for each stock?
- What buy/sell thresholds are optimal?
- Should we use different settings for RTH vs AH?
- How do settings perform in different market conditions?

**Solution**: Build a backtesting platform to:
1. **Simulate** historical trading with different settings
2. **Measure** performance of each combination
3. **Identify** optimal parameters for each stock
4. **Predict** when to change settings based on market conditions

### How It Will Work
```
1. Load historical data (minute_stock, minute_btc)
2. For each combination of:
   - Symbol (RIOT, MARA, etc.)
   - Baseline method (5 options)
   - Buy threshold (0.5% to 2.0%)
   - Sell threshold (1.0% to 4.0%)
   - Session (RTH, AH)
3. Simulate trading:
   - Calculate what trades would have been made
   - Track hypothetical P&L
   - Measure performance metrics
4. Compare results:
   - Which combinations performed best?
   - Which stocks respond best to which settings?
   - What patterns emerge?
5. Apply insights:
   - Update live system with optimal settings
   - Adjust settings when market conditions change
```

### Expected Outcomes
1. **Optimized Settings**: Know the best baseline method and thresholds for each stock
2. **Confidence**: Data-driven decisions instead of guessing
3. **Adaptability**: Detect when to change settings
4. **Performance**: Improve ROI by 20-50% through optimization
5. **Risk Reduction**: Avoid settings that historically underperform

---

## 🎓 KEY CONCEPTS SUMMARY

### The Ratio
- **What**: Bitcoin Price / Stock Price
- **Why**: Measures the relationship between BTC and mining stocks
- **Normal**: Stays relatively stable over time
- **Opportunity**: When it deviates significantly from normal

### The Baseline
- **What**: The "normal" or "expected" ratio
- **How**: Calculated from previous day's data using 5 different methods
- **Purpose**: Reference point to detect deviations
- **Critical**: Different baselines work better for different stocks

### The Signal
- **Buy Signal**: Current ratio > baseline (stock is cheap)
- **Sell Signal**: Current ratio < baseline (stock is expensive)
- **Threshold**: How much deviation triggers a trade (e.g., 1.0%)
- **Optimization**: Finding the right threshold for each stock

### The Execution
- **Order Type**: Limit orders (not market orders)
- **Fill Assumption**: For backtesting, assume all orders fill
- **Position Management**: Carry positions overnight
- **Capital Allocation**: Fixed budget per symbol or reinvest all

---

## 🎯 SUCCESS METRICS FOR ANALYTICS PLATFORM

The analytics platform will be successful when we can:

1. ✅ **Answer**: "What's the best baseline method for RIOT?"
2. ✅ **Answer**: "What buy/sell thresholds maximize ROI for MARA?"
3. ✅ **Answer**: "Should we use different settings for RTH vs AH?"
4. ✅ **Answer**: "Which stocks perform best with which strategies?"
5. ✅ **Predict**: "When should we switch from WINSORIZED to VOL_WEIGHTED?"
6. ✅ **Measure**: "How much better are optimized settings vs current settings?"
7. ✅ **Validate**: "Do backtest results match live trading results?"

---

## 📚 TECHNICAL GLOSSARY

- **Ratio**: Bitcoin Price / Stock Price
- **Baseline**: Expected "normal" ratio calculated from historical data
- **Deviation**: How far current ratio is from baseline (in %)
- **Threshold**: Minimum deviation required to trigger a trade
- **RTH**: Regular Trading Hours (9:30 AM - 4:00 PM ET)
- **AH**: After Hours (all other times)
- **VWAP**: Volume-Weighted Average Price
- **Winsorization**: Removing extreme outliers from data
- **Slippage**: Difference between expected and actual fill price
- **Fill Rate**: Percentage of orders that execute
- **Sharpe Ratio**: Risk-adjusted return metric
- **Max Drawdown**: Largest peak-to-trough decline
- **Backtest**: Simulating trading on historical data
- **Grid Search**: Testing many parameter combinations

---

This system represents a sophisticated, data-driven approach to trading Bitcoin mining stocks. The analytics platform will unlock its full potential by identifying optimal settings through rigorous backtesting and analysis.