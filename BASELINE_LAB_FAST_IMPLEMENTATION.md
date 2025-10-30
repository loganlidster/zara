# Baseline Lab — FAST Implementation Plan

## Overview
This is the MOST CRITICAL report for the business. It finds the best performing method and thresholds for each trading day, showing which strategies work best on specific days.

## Core Concept
For each trading day:
1. Calculate baselines from previous N trading days (for each method)
2. Test all combinations of (method, buy%, sell%) on that day
3. Pick the winner (best ROI) for that day
4. Calculate confidence metrics
5. Show consistency by method across all days

## Key Features from Streamlit App

### Input Parameters
1. **Multi-symbol selection** (default: first 9 symbols)
2. **Date range** (start/end dates)
3. **Window/Session** (ALL, RTH, AH, CUSTOM with time range)
4. **Baseline methods** (multi-select, default: all 5)
5. **Lookback N** (previous trading days for baseline, default: 1)
6. **Liquidity filters**:
   - Min shares/minute
   - Min $/minute
   - Max % of minute volume (participation cap)
   - Apply to baseline days (checkbox)
   - Apply to trigger days (checkbox)
7. **Thresholds**:
   - Single pair mode (checkbox, default: true)
   - Buy% start/end/step
   - Sell% start/end/step
8. **Start capital per day** (default: $10,000)
9. **Confidence horizon** (forward minutes, default: 10)

### Output Tables

#### 1. Per-Day Winners
Columns:
- et_date
- symbol
- method (winning method for that day)
- buy_pct (winning buy%)
- sell_pct (winning sell%)
- n_trades
- day_return (decimal)
- day_return_% (percentage)
- baseline (baseline value used)
- n_minutes (sample size)
- corr_pearson (correlation metric)
- corr_spearman (correlation metric)
- confidence (confidence score)

#### 2. Consistency by Method
Columns:
- symbol
- method
- days_won (how many days this method won)
- avg_day_return (average return across winning days)
- med_day_return (median return)
- avg_confidence (average confidence)
- avg_day_return_% (percentage)
- med_day_return_% (percentage)

## Implementation Strategy

### Backend Endpoint: `/api/events/batch-daily-winners`

**Input**:
```json
{
  "symbols": ["HIVE", "RIOT", "MARA"],
  "startDate": "2024-10-01",
  "endDate": "2024-10-28",
  "session": "ALL",
  "methods": ["VWAP_RATIO", "WINSORIZED", "VOL_WEIGHTED"],
  "lookbackDays": 1,
  "liquidityFilters": {
    "minShares": 0,
    "minDollar": 0,
    "participationCap": 0,
    "applyToBaseline": true,
    "applyToTriggers": true
  },
  "thresholds": {
    "singlePair": true,
    "buyStart": 0.5,
    "buyEnd": 2.0,
    "buyStep": 0.1,
    "sellStart": 1.0,
    "sellEnd": 4.0,
    "sellStep": 0.1
  },
  "startCapital": 10000,
  "confidenceHorizon": 10
}
```

**Logic**:
1. For each symbol:
   - Get all trading days in range
   - For each trading day:
     - Get previous N trading days for baseline calculation
     - For each method:
       - Calculate baseline from previous N days
       - For each (buy%, sell%) combination:
         - Simulate trading on that day only (isolated, no carry)
         - Calculate day return
       - Pick best combination for that day
     - Calculate confidence metrics for winner
   - Aggregate consistency by method

2. Use our 10 specialized tables efficiently:
   - Query `trade_events_{session}_{method}` tables
   - Filter by date and thresholds
   - Simulate wallet for each day independently

**Output**:
```json
{
  "dailyWinners": [...],
  "consistencyByMethod": [...],
  "timing": {...}
}
```

### Frontend Page: `/reports/baseline-lab-fast`

**UI Layout** (matching Streamlit):
1. **Symbol Selection** (multi-select chips)
2. **Date Range** (start/end date pickers)
3. **Window** (dropdown: ALL, RTH, AH, CUSTOM)
4. **Baseline Methods** (multi-select chips, default all 5)
5. **Lookback N** (number input, 1-5)
6. **Liquidity Filters** (collapsible section):
   - Min shares/min
   - Min $/min
   - Max % of minute volume
   - Two checkboxes for apply to baseline/triggers
7. **Thresholds** (section):
   - "Run single thresholds" checkbox
   - Buy% start/end/step (end/step disabled if single)
   - Sell% start/end/step (end/step disabled if single)
8. **Start Capital** (number input)
9. **Confidence Horizon** (number input, 1-60 minutes)
10. **Run Button** (primary, large)
11. **Progress Bar** (shows symbol progress)
12. **Results**:
    - Per-day winners table (sortable, exportable)
    - Consistency by method table (sortable, exportable)

## Key Differences from Grid Search

1. **Per-Day Isolation**: Each day is simulated independently (no carry-over)
2. **Winner Selection**: Picks ONE best combination per day
3. **Confidence Metrics**: Calculates correlation-based confidence
4. **Consistency Analysis**: Shows which methods win most often
5. **Multi-Symbol**: Processes multiple symbols in one run
6. **Liquidity Filters**: Advanced filtering options

## Performance Optimization

1. **Use Pre-calculated Baselines**: Query `baseline_daily` table
2. **Parallel Processing**: Process symbols in parallel
3. **Efficient Queries**: Use our 10 specialized tables
4. **Progress Tracking**: Show real-time progress per symbol
5. **Caching**: Cache baseline calculations

## Estimated Complexity
- **Backend**: ~500-600 lines (complex logic)
- **Frontend**: ~800-900 lines (many inputs)
- **Time**: 4-5 hours for complete implementation
- **Priority**: HIGHEST - business critical

## Next Steps
1. Build backend endpoint with full logic
2. Build frontend with all controls
3. Test thoroughly with real data
4. Optimize for performance
5. Deploy and verify