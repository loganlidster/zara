# Trading System Logic - Confirmed Understanding

## The Correct Logic Flow

### Step 1: Calculate Baseline (Previous Day)
For trading on date D, use data from date D-1 (previous trading day):
- Get all RTH minutes from D-1
- For each minute: ratio = BTC_price / Stock_price  
- Baseline = Average of all ratios

**Example for 9/24 trading:**
- Use 9/23 data
- Baseline = 29,520.7

### Step 2: Calculate Strike Prices (Current Day)
Using the baseline from D-1, calculate strikes for trading on D:
- **Buy Strike** = Baseline × (1 + buy_adjustment)
- **Sell Strike** = Baseline × (1 - sell_adjustment)

**Example for 9/24 with 0.5% buy, 1.0% sell:**
- Buy Strike = 29,520.7 × 1.005 = 29,668.3
- Sell Strike = 29,520.7 × 0.99 = 29,225.5

### Step 3: Trade Minute-by-Minute (Current Day)
For each minute on day D:
1. Calculate current_ratio = BTC_price / Stock_price
2. Apply trading logic:
   - IF current_ratio > buy_strike AND have_cash → BUY
   - IF current_ratio < sell_strike AND have_shares → SELL
   - ELSE → HOLD

**Example at 9:30 AM on 9/24:**
- BTC = 113,013.40, Stock = 3.78
- current_ratio = 29,897.72
- 29,897.72 > 29,668.3 → BUY!

## Precomputed Grid Tables Strategy

### Goal
Pre-calculate ALL possible buy/sell combinations for fast reporting.

### Grid Parameters
- Buy percentages: 0.1%, 0.2%, 0.3%, ..., 3.0% (30 values)
- Sell percentages: 0.1%, 0.2%, 0.3%, ..., 3.0% (30 values)
- Total combinations: 30 × 30 = 900 per symbol/method/session

### Table Schema
```sql
CREATE TABLE precomputed_trades_grid (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  method VARCHAR(20) NOT NULL,
  session VARCHAR(10) NOT NULL,
  buy_pct DECIMAL(5,2) NOT NULL,
  sell_pct DECIMAL(5,2) NOT NULL,
  entry_date DATE NOT NULL,
  entry_time TIME NOT NULL,
  entry_price DECIMAL(10,2) NOT NULL,
  entry_baseline DECIMAL(15,6) NOT NULL,
  entry_ratio DECIMAL(15,6) NOT NULL,
  exit_date DATE NOT NULL,
  exit_time TIME NOT NULL,
  exit_price DECIMAL(10,2) NOT NULL,
  exit_baseline DECIMAL(15,6) NOT NULL,
  exit_ratio DECIMAL(15,6) NOT NULL,
  shares INTEGER NOT NULL,
  trade_return_pct DECIMAL(10,4) NOT NULL,
  trade_return_dollars DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_grid_lookup ON precomputed_trades_grid(symbol, method, session, buy_pct, sell_pct);
CREATE INDEX idx_grid_date ON precomputed_trades_grid(entry_date, exit_date);
```

### Benefits
1. Calculate once, query instantly
2. No real-time simulation needed
3. Reports load in milliseconds
4. Easy to add new metrics later

## Implementation Plan

### Phase 1: Fix Current System
1. Update fast-daily-endpoint.js to use correct baseline logic
2. Use trading_calendar.prev_open_date for baseline lookup
3. Calculate ratio = BTC / Stock for each minute
4. Apply buy/sell strikes correctly

### Phase 2: Build Grid Tables
1. Create precomputed_trades_grid table
2. Build grid processor to calculate all 900 combos
3. Process historical data for all symbols
4. Verify results match hand calculations

### Phase 3: Wire Up Reports
1. Update API endpoints to query grid tables
2. Add aggregation queries for summary stats
3. Build batch grid search using precomputed data
4. Add export functionality

## Key Points
- ✅ Use previous trading day's baseline (via trading_calendar)
- ✅ Calculate strikes once per day
- ✅ Compare current ratio to strikes minute-by-minute
- ✅ Precompute all combinations for speed
- ✅ Store complete trade history for analysis