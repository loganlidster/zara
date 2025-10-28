# Daily Curve & ROI Report - Implementation Plan

## What We're Building

A multi-symbol performance comparison tool that shows:
- **Daily cumulative returns** for multiple symbols on one line chart
- **Bitcoin buy & hold benchmark** overlay
- **Summary metrics** (total return, trades, max drawdown per symbol)
- **All aligned to stock trading days**

## Architecture

### API Endpoint: `/api/events/daily-curve`

**Input Parameters:**
```typescript
{
  symbols: string[];           // ["HIVE", "RIOT", "MARA"]
  method: string;              // "EQUAL_MEAN"
  session: string;             // "RTH" or "AH"
  buyPct: number;              // 2.9
  sellPct: number;             // 0.7
  startDate: string;           // "2025-09-01"
  endDate: string;             // "2025-09-22"
  alignmentMode: string;       // "union" or "intersection"
  includeBtc: boolean;         // true/false
}
```

**Output:**
```typescript
{
  success: boolean;
  dateRange: { startDate: string; endDate: string };
  data: {
    dates: string[];                    // ["2025-09-01", "2025-09-02", ...]
    series: {
      [symbol: string]: number[];       // Cumulative ROI per date
      BTC?: number[];                   // BTC benchmark if included
    }
  };
  metrics: {
    symbol: string;
    totalReturn: number;                // Final ROI %
    totalTrades: number;
    maxDrawdown: number;                // %
    finalEquity: number;
  }[];
}
```

## Implementation Steps

### Step 1: Create API Endpoint (Node.js)

**File:** `api-server/daily-curve-endpoint.js`

**Logic:**
1. For each symbol:
   - Fetch events from specialized table
   - Filter to alternating BUY/SELL
   - Simulate wallet day-by-day
   - Calculate daily equity and cumulative ROI
   - Store as array of {date, roi}

2. Align dates based on mode:
   - **Union**: Include any day where ANY symbol traded
   - **Intersection**: Include only days where ALL symbols traded

3. Create time series:
   - Base array of aligned dates
   - For each symbol, map ROI to each date (null if no data)

4. Add BTC benchmark if requested:
   - Get BTC price on first trading day
   - Get BTC price on each subsequent trading day
   - Calculate cumulative return vs first day

5. Calculate metrics:
   - Total return (final ROI)
   - Total trades
   - Max drawdown (running max equity vs current)

### Step 2: Create Frontend Component

**File:** `frontend-dashboard/app/reports/daily-curve/page.tsx`

**UI Elements:**
1. **Filters Section:**
   - Multi-select for symbols (default: first 3)
   - Single method dropdown
   - Single session dropdown
   - Buy/Sell percentage inputs
   - Date range picker
   - Alignment mode toggle
   - Include BTC checkbox

2. **Chart Section:**
   - Recharts LineChart with:
     * Multiple lines (one per symbol + BTC)
     * Legend
     * Tooltip showing all values on hover
     * X-axis: dates
     * Y-axis: cumulative return %
     * Responsive sizing

3. **Metrics Table:**
   - One row per symbol
   - Columns: Symbol, Total Return %, Trades, Max Drawdown %
   - Sortable
   - Color-coded returns (green/red)

4. **Export Button:**
   - CSV download with all data

## Data Flow

```
User selects:
  - Symbols: [HIVE, RIOT, MARA]
  - Method: EQUAL_MEAN
  - Session: RTH
  - Buy: 2.9%, Sell: 0.7%
  - Dates: 9/1 - 9/22
  - Alignment: Union
  - Include BTC: Yes

↓

API processes:
  1. Query trade_events_rth_equal_mean for each symbol
  2. Filter to alternating BUY/SELL
  3. Simulate wallet day-by-day:
     - 9/1: No trades → ROI = 0%
     - 9/2: BUY HIVE → ROI = 0%
     - 9/3: SELL HIVE → ROI = 5.2%
     - ... continue for all days
  4. Collect all trading days from all symbols
  5. Align to union of dates
  6. Add BTC benchmark
  7. Calculate metrics

↓

Frontend displays:
  - Line chart with 4 lines (HIVE, RIOT, MARA, BTC)
  - Metrics table with 3 rows
  - CSV export button
```

## Key Implementation Details

### Wallet Simulation (Per Symbol)
```javascript
function simulateDailyCurve(events, initialCapital = 10000) {
  let cash = initialCapital;
  let shares = 0;
  const dailyData = [];
  
  // Group events by date
  const eventsByDate = groupBy(events, 'event_date');
  
  for (const [date, dayEvents] of Object.entries(eventsByDate)) {
    const startEquity = cash + (shares * getFirstPrice(dayEvents));
    
    // Process events for this day
    for (const event of dayEvents) {
      if (event.event_type === 'BUY' && shares === 0) {
        shares = Math.floor(cash / event.stock_price);
        cash -= shares * event.stock_price;
      } else if (event.event_type === 'SELL' && shares > 0) {
        cash += shares * event.stock_price;
        shares = 0;
      }
    }
    
    const endEquity = cash + (shares * getLastPrice(dayEvents));
    const cumulativeROI = ((endEquity - initialCapital) / initialCapital) * 100;
    
    dailyData.push({
      date: date,
      equity: endEquity,
      roi: cumulativeROI
    });
  }
  
  return dailyData;
}
```

### Date Alignment
```javascript
function alignDates(symbolData, mode) {
  // Extract all dates from all symbols
  const allDates = symbolData.flatMap(s => s.dates);
  
  if (mode === 'union') {
    // Include any date where ANY symbol traded
    return [...new Set(allDates)].sort();
  } else {
    // Include only dates where ALL symbols traded
    const dateCounts = {};
    allDates.forEach(d => dateCounts[d] = (dateCounts[d] || 0) + 1);
    return Object.keys(dateCounts)
      .filter(d => dateCounts[d] === symbolData.length)
      .sort();
  }
}
```

### BTC Benchmark
```javascript
function calculateBtcBenchmark(events, alignedDates) {
  // Get BTC price on first date
  const firstDate = alignedDates[0];
  const firstEvent = events.find(e => e.event_date === firstDate);
  const firstPrice = firstEvent.btc_price;
  
  // Calculate return for each date
  return alignedDates.map(date => {
    const event = events.find(e => e.event_date === date);
    if (!event) return null;
    return ((event.btc_price - firstPrice) / firstPrice) * 100;
  });
}
```

## Frontend Chart Configuration

```typescript
<ResponsiveContainer width="100%" height={500}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis 
      dataKey="date" 
      tickFormatter={(date) => new Date(date).toLocaleDateString()}
    />
    <YAxis 
      label={{ value: 'Cumulative Return (%)', angle: -90, position: 'insideLeft' }}
    />
    <Tooltip 
      labelFormatter={(date) => new Date(date).toLocaleDateString()}
      formatter={(value) => `${value.toFixed(2)}%`}
    />
    <Legend />
    {symbols.map((symbol, i) => (
      <Line 
        key={symbol}
        type="monotone"
        dataKey={symbol}
        stroke={COLORS[i]}
        strokeWidth={2}
        dot={false}
      />
    ))}
    {includeBtc && (
      <Line 
        type="monotone"
        dataKey="BTC"
        stroke="#F7931A"
        strokeWidth={2}
        strokeDasharray="5 5"
        dot={false}
      />
    )}
  </LineChart>
</ResponsiveContainer>
```

## Testing Plan

1. **Single Symbol Test:**
   - HIVE, EQUAL_MEAN, RTH, 2.9%/0.7%, 9/1-9/22
   - Should match Fast Daily final ROI (46.18%)

2. **Multi-Symbol Test:**
   - HIVE + RIOT + MARA
   - Verify each line shows correct cumulative returns
   - Check alignment works correctly

3. **BTC Benchmark Test:**
   - Enable BTC overlay
   - Verify BTC line shows buy & hold returns
   - Check alignment to stock trading days

4. **Edge Cases:**
   - Symbol with no trades (should show 0% line)
   - Intersection mode with no common dates
   - Single day date range

## Performance Expectations

- **Single symbol**: ~500ms (similar to Fast Daily)
- **3 symbols**: ~1.5 seconds (parallel processing)
- **5 symbols**: ~2.5 seconds
- **With BTC**: +200ms

## Files to Create

1. `api-server/daily-curve-endpoint.js` - API logic
2. `frontend-dashboard/app/reports/daily-curve/page.tsx` - UI component
3. `frontend-dashboard/lib/api.ts` - Add getDailyCurve function

## Next Steps

1. Create API endpoint
2. Test with Postman/curl
3. Create frontend component
4. Test with UI
5. Deploy both
6. Verify with real data

Ready to start? 🚀