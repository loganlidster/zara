# Complete Dashboard Implementation Plan

## Overview
Building 5 missing reports to complete the RAAS Dashboard, matching functionality from the Streamlit app.

## Report 1: Grid Report (Parameter Optimization)

### Backend Endpoint: `/api/events/grid-search`
**Purpose**: Test multiple buy%/sell% combinations across multiple baseline methods

**Input Parameters**:
- `symbol`: Single stock symbol
- `methods`: Array of baseline methods (e.g., ['VWAP_RATIO', 'WINSORIZED'])
- `session`: 'RTH', 'AH', or 'ALL'
- `buyMin`, `buyMax`, `buyStep`: Buy percentage range
- `sellMin`, `sellMax`, `sellStep`: Sell percentage range
- `startDate`, `endDate`: Date range
- `initialCapital`: Starting capital (default 10000)

**Output**:
```json
{
  "results": [
    {
      "method": "VWAP_RATIO",
      "buyPct": 0.5,
      "sellPct": 1.0,
      "totalReturn": 15.5,
      "totalTrades": 45,
      "finalEquity": 11550
    },
    ...
  ],
  "bestPerMethod": {
    "VWAP_RATIO": { "buyPct": 1.5, "sellPct": 2.0, "roi": 25.3 },
    ...
  }
}
```

**Logic**:
1. For each method, query events from appropriate table(s)
2. For each buy%/sell% combination:
   - Filter events matching those thresholds
   - Simulate wallet (alternating BUY/SELL)
   - Calculate ROI
3. Return all combinations with metrics

### Frontend Page: `/reports/grid-search`
**Features**:
- Symbol selector (single)
- Method multi-select (checkboxes)
- Session selector
- Buy% range inputs (min, max, step)
- Sell% range inputs (min, max, step)
- Date range picker
- Results display:
  - Heatmap for each method (buy% vs sell% with ROI color)
  - Best combination table
  - Full results table (sortable)
  - Export to CSV

---

## Report 2: Batch Daily Winners

### Backend Endpoint: `/api/events/daily-winners`
**Purpose**: Find best performing method/threshold combination for each trading day

**Input Parameters**:
- `symbols`: Array of symbols
- `methods`: Array of methods (or 'All')
- `session`: 'RTH', 'AH', or 'ALL'
- `startDate`, `endDate`: Date range
- `buyMin`, `buyMax`: Buy% range to test
- `sellMin`, `sellMax`: Sell% range to test

**Output**:
```json
{
  "dailyWinners": [
    {
      "date": "2024-10-28",
      "symbol": "HIVE",
      "method": "VWAP_RATIO",
      "buyPct": 1.5,
      "sellPct": 2.0,
      "roi": 3.5,
      "trades": 8
    },
    ...
  ],
  "methodConsistency": {
    "VWAP_RATIO": { "wins": 15, "avgRoi": 2.3 },
    "WINSORIZED": { "wins": 10, "avgRoi": 1.8 },
    ...
  }
}
```

**Logic**:
1. For each trading day:
   - Test all method/threshold combinations
   - Find best ROI for that day
2. Calculate consistency metrics per method
3. Return daily winners and method stats

### Frontend Page: `/reports/daily-winners`
**Features**:
- Symbol multi-select
- Method multi-select
- Session selector
- Threshold ranges
- Date range picker
- Results display:
  - Calendar heatmap showing daily winners
  - Per-day winners table
  - Method consistency chart (bar chart)
  - Export to CSV

---

## Report 3: Trade Detail with Liquidity Context

### Backend Endpoint: `/api/events/trade-detail`
**Purpose**: Show detailed trade-by-trade analysis with volume context

**Input Parameters**:
- `symbol`: Single symbol
- `method`: Single method
- `session`: 'RTH', 'AH', or 'ALL'
- `buyPct`, `sellPct`: Specific thresholds
- `startDate`, `endDate`: Date range

**Output**:
```json
{
  "trades": [
    {
      "date": "2024-10-28",
      "time": "10:35:00",
      "type": "BUY",
      "price": 15.50,
      "shares": 645,
      "ratio": 0.0234,
      "baseline": 0.0230,
      "volumeBefore5min": 125000,
      "volumeAfter5min": 98000,
      "avgVolume5min": 111500,
      "liquidityScore": 0.85
    },
    ...
  ],
  "summary": {
    "totalTrades": 45,
    "avgLiquidityScore": 0.78,
    "highLiquidityTrades": 35,
    "lowLiquidityTrades": 10
  }
}
```

**Logic**:
1. Get all events for symbol/method/thresholds
2. For each event, calculate ±5 minute volume context
3. Calculate liquidity score
4. Return detailed trade list with context

### Frontend Page: `/reports/trade-detail`
**Features**:
- Symbol selector
- Method selector
- Session selector
- Threshold inputs
- Date range picker
- Results display:
  - Trade-by-trade table with volume columns
  - Liquidity score visualization
  - Volume context charts
  - Export to CSV

---

## Report 4: Previous-Day Baseline Check

### Backend Endpoint: `/api/baseline/check`
**Purpose**: Quick baseline calculation check for a specific date

**Input Parameters**:
- `symbol`: Single symbol
- `date`: Specific date to check
- `session`: 'RTH', 'AH', or 'ALL'
- `nDays`: Number of previous days to average (default 1)

**Output**:
```json
{
  "date": "2024-10-28",
  "symbol": "HIVE",
  "session": "RTH",
  "nDays": 1,
  "baselines": {
    "VWAP_RATIO": 0.0234,
    "VOL_WEIGHTED": 0.0235,
    "WINSORIZED": 0.0233,
    "WEIGHTED_MEDIAN": 0.0234,
    "EQUAL_MEAN": 0.0235
  },
  "previousDates": ["2024-10-25"],
  "sampleCounts": {
    "VWAP_RATIO": 390,
    ...
  }
}
```

**Logic**:
1. Get previous N trading days
2. Calculate baseline for each method
3. Return all baselines with metadata

### Frontend Page: `/reports/baseline-check`
**Features**:
- Symbol selector
- Date picker
- Session selector
- N-days input
- Results display:
  - Baseline comparison table
  - Method comparison chart
  - Sample count info
  - Previous dates used

---

## Report 5: Coverage Report

### Backend Endpoint: `/api/data/coverage`
**Purpose**: Analyze data quality and coverage

**Input Parameters**:
- `symbols`: Array of symbols (or 'All')
- `startDate`, `endDate`: Date range

**Output**:
```json
{
  "coverage": [
    {
      "symbol": "HIVE",
      "totalDays": 20,
      "stockMinutes": 7800,
      "btcMinutes": 28800,
      "matchedMinutes": 7800,
      "coveragePct": 100.0,
      "missingDates": []
    },
    ...
  ],
  "summary": {
    "totalSymbols": 11,
    "avgCoverage": 98.5,
    "symbolsWithIssues": 1
  }
}
```

**Logic**:
1. For each symbol, count minute bars
2. Check for missing dates
3. Calculate coverage percentages
4. Return coverage stats

### Frontend Page: `/reports/coverage`
**Features**:
- Symbol multi-select
- Date range picker
- Results display:
  - Coverage table per symbol
  - Coverage chart (bar chart)
  - Missing dates list
  - Data quality metrics

---

## Home Page Updates

### Add 5 New Report Cards

```typescript
const newReports = [
  {
    title: "Grid Search",
    description: "Parameter optimization - test buy%/sell% combinations",
    icon: "🔍",
    href: "/reports/grid-search"
  },
  {
    title: "Daily Winners",
    description: "Best method/thresholds per trading day",
    icon: "🏆",
    href: "/reports/daily-winners"
  },
  {
    title: "Trade Detail",
    description: "Trade-by-trade analysis with liquidity context",
    icon: "📊",
    href: "/reports/trade-detail"
  },
  {
    title: "Baseline Check",
    description: "Quick baseline calculation verification",
    icon: "✓",
    href: "/reports/baseline-check"
  },
  {
    title: "Coverage Report",
    description: "Data quality and coverage analysis",
    icon: "📈",
    href: "/reports/coverage"
  }
];
```

---

## Implementation Order

1. **Grid Search** (Highest value, most complex) - 3-4 hours
2. **Baseline Check** (Simplest, good warmup) - 1-2 hours
3. **Coverage Report** (Data quality tool) - 1-2 hours
4. **Trade Detail** (Medium complexity) - 2-3 hours
5. **Daily Winners** (Complex aggregation) - 2-3 hours
6. **Home Page Updates** - 1 hour

**Total Estimated Time: 10-15 hours**

---

## Technical Notes

### Database Tables Used
- `trade_events_rth_*` and `trade_events_ah_*` - Event data
- `baseline_daily` - Pre-calculated baselines
- `minute_stock` and `minute_btc` - Minute bar data
- `trading_calendar` - Trading days

### Shared Logic
- Wallet simulation (alternating BUY/SELL)
- ROI calculation
- Session filtering
- Date range validation

### Performance Considerations
- Grid search can test 100+ combinations - use progress indicators
- Daily winners tests many combinations per day - optimize queries
- Trade detail needs ±5min lookups - use efficient window queries
- Coverage report scans large date ranges - use aggregation queries

---

## Success Criteria

All reports working if:
- ✅ All 5 backend endpoints functional
- ✅ All 5 frontend pages render correctly
- ✅ Home page shows all report cards
- ✅ Export functionality works
- ✅ No console errors
- ✅ Results match Streamlit app logic