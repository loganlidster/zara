# Daily Curve & ROI Report Analysis

## What This Report Does

The "Daily Curve & ROI" report is a **multi-symbol performance comparison tool** that shows:

1. **Daily cumulative returns** for multiple symbols over a date range
2. **Bitcoin benchmark** overlay (buy & hold) aligned to stock trading days
3. **Single line chart** showing all symbols + BTC on the same graph
4. **Summary metrics** table with total return, trades, and max drawdown per symbol

## Key Features

### 1. Multi-Symbol Selection
- User selects multiple symbols (default: first 3)
- Each symbol runs the same strategy parameters
- Results are aligned by trading days

### 2. Strategy Parameters (Applied to All Symbols)
- **Baseline method**: One of 5 methods (VWAP_RATIO, VOL_WEIGHTED, etc.)
- **N previous days**: How many previous trading days to average for baseline
- **Buy/Sell thresholds**: Single pair applied to all symbols
- **Window**: RTH, AH, CUSTOM, or ALL
- **Portfolio sizing**: REINVEST (all-in) or BASE_BUDGET (fixed)
- **Force flat EOD**: Optional - close positions at end of each day

### 3. Trading Day Alignment
Two modes:
- **Union**: Include any day where ANY selected symbol traded
- **Intersection**: Include only days where ALL selected symbols traded

### 4. Bitcoin Benchmark
- Fetches BTC minute data for the same date range
- Filters to same window (RTH/AH/etc.)
- Takes last close price of each trading day
- Calculates cumulative return vs first day
- Overlays on the same chart as stocks

### 5. Output
- **Line chart**: X-axis = date, Y-axis = cumulative return (%)
- **One line per symbol** + one line for BTC
- **Summary table**: Shows total return %, total trades, max drawdown % per symbol
- **CSV download**: All data for further analysis

## How It Works (Step by Step)

### Step 1: Compute Daily Curve Per Symbol
For each selected symbol:
1. Fetch minute data from `lab_minute_join` table
2. Filter to selected window (RTH/AH/etc.)
3. Calculate baselines using N previous trading days
4. Run simulation minute-by-minute:
   - Buy when ratio >= baseline * (1 + buy%)
   - Sell when ratio <= baseline * (1 - sell%)
   - Track cash, shares, equity
5. Aggregate to **daily level**:
   - One row per trading day
   - Columns: et_date, equity_start, equity_end, day_return, cum_return, trades, buys, sells

### Step 2: Align Trading Days
- Collect all trading days from each symbol's results
- Apply alignment mode (union or intersection)
- Create base dataframe with allowed dates

### Step 3: Merge Symbol Curves
- Start with base dates dataframe
- Left join each symbol's (et_date, cum_return) onto base
- Result: One row per date, one column per symbol

### Step 4: Add BTC Benchmark
If enabled:
1. Fetch BTC minute data for date range
2. Filter to same window
3. Take last close price per trading day
4. Calculate cumulative return vs first day
5. Merge onto main dataframe

### Step 5: Display
- Sort by date
- Plot as line chart (Streamlit's `st.line_chart`)
- Show summary metrics table
- Provide CSV download

## Data Requirements

### From Our Event-Based System
We have everything we need in `trade_events` tables:

✅ **Symbol**: Available
✅ **Method**: Available (baseline method)
✅ **Session**: Available (RTH/AH)
✅ **Buy/Sell %**: Available
✅ **Event date**: Available
✅ **Event type**: BUY/SELL
✅ **Stock price**: Available
✅ **BTC price**: Available
✅ **Ratio**: Available
✅ **Baseline**: Available
✅ **Trade ROI**: Available (for each SELL)

### What We Need to Calculate
1. **Daily aggregation**: Group events by date, calculate:
   - Starting equity (cash + shares * price at start of day)
   - Ending equity (cash + shares * price at end of day)
   - Day return = (ending - starting) / starting
   - Cumulative return = (ending / initial_capital) - 1
   - Number of trades that day

2. **Wallet simulation**: Track cash and shares across days
   - Start with initial capital
   - Process BUY events: cash -= (shares * price), shares += shares
   - Process SELL events: cash += (shares * price), shares = 0
   - Calculate equity at each day boundary

3. **BTC benchmark**: 
   - We have BTC price in every event
   - Take first BTC price on first trading day
   - Take last BTC price on each subsequent trading day
   - Calculate cumulative return

## Implementation Plan for RAAS

### API Endpoint: `/api/events/daily-curve`

**Parameters:**
```typescript
{
  symbols: string[];           // e.g., ["HIVE", "RIOT", "MARA"]
  method: string;              // e.g., "EQUAL_MEAN"
  session: string;             // "RTH" or "AH"
  buyPct: number;              // e.g., 1.0
  sellPct: number;             // e.g., 2.0
  startDate: string;           // "2025-09-01"
  endDate: string;             // "2025-09-30"
  alignmentMode: string;       // "union" or "intersection"
  includeBtc: boolean;         // true/false
}
```

**Response:**
```typescript
{
  success: boolean;
  dateRange: { startDate: string; endDate: string };
  data: {
    dates: string[];           // ["2025-09-01", "2025-09-02", ...]
    series: {
      [symbol: string]: number[];  // Cumulative returns per date
      BTC?: number[];          // BTC benchmark if included
    }
  };
  metrics: {
    symbol: string;
    totalReturn: number;       // %
    totalTrades: number;
    maxDrawdown: number;       // %
  }[];
}
```

### Frontend Component: `DailyCurveReport`

**Features:**
1. Multi-select for symbols
2. Single strategy parameters (method, buy%, sell%, session)
3. Date range picker
4. Alignment mode toggle
5. BTC benchmark checkbox
6. **Recharts line chart** with:
   - Multiple lines (one per symbol + BTC)
   - Legend
   - Tooltip showing all values on hover
   - X-axis: dates
   - Y-axis: cumulative return %
7. Summary metrics table
8. CSV export

### Database Query Strategy

Since we have specialized tables (`trade_events_rth_equal_mean`, etc.):

1. **Determine table name** from session + method
2. **Query events** for all symbols in date range:
   ```sql
   SELECT symbol, event_date, event_time, event_type, 
          stock_price, btc_price, ratio, baseline
   FROM trade_events_rth_equal_mean
   WHERE symbol IN ('HIVE', 'RIOT', 'MARA')
     AND buy_pct = 1.0
     AND sell_pct = 2.0
     AND event_date BETWEEN '2025-09-01' AND '2025-09-30'
   ORDER BY symbol, event_date, event_time
   ```

3. **Process in memory** (Node.js):
   - Group by symbol
   - For each symbol, simulate wallet day-by-day
   - Calculate daily equity and cumulative return
   - Store in array

4. **Align dates** based on mode

5. **Add BTC benchmark** if requested

## Advantages of Our Event-Based System

✅ **Fast queries**: Only fetch actual trade events (not every minute)
✅ **Accurate wallet**: Events already represent state changes
✅ **Flexible**: Can aggregate to any time period (daily, weekly, monthly)
✅ **Scalable**: Works for any date range without performance issues
✅ **Complete data**: Have all info needed (prices, ratios, baselines)

## Next Steps

1. Create API endpoint `/api/events/daily-curve`
2. Implement wallet simulation logic in Node.js
3. Build frontend component with Recharts
4. Add to dashboard navigation
5. Test with multiple symbols and date ranges

Would you like me to start implementing this report?