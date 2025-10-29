# Best/Worst Per Stock Analysis Feature

## Overview
Added a new analysis mode to the Custom Pattern Analyzer that shows the **best AND worst performing strategy** for each stock during pattern matches. This gives you 44 results per analysis (11 stocks × 2 sessions × 2 categories).

## What It Shows

### For Each Stock + Session Combination:
- **BEST Strategy**: The highest performing settings during the pattern dates
- **WORST Strategy**: The lowest performing settings during the pattern dates

### Example Output:
```
HIVE + RTH:
  - BEST:  EQUAL_MEAN, 2.9% buy, 0.7% sell → +8.5% avg ROI
  - WORST: VOL_WEIGHTED, 1.2% buy, 2.1% sell → -2.3% avg ROI

HIVE + AH:
  - BEST:  VWAP_RATIO, 1.8% buy, 1.0% sell → +6.2% avg ROI
  - WORST: WINSORIZED, 0.5% buy, 2.8% sell → -1.8% avg ROI

(Repeat for all 11 stocks × 2 sessions = 22 pairs = 44 total results)
```

## How It Works

### Backend Logic (`api-server/pattern-best-worst-per-stock.js`):

1. **Fetch All Strategies**: For each pattern date, calls Best Performers API for both RTH and AH sessions
2. **Aggregate Results**: Groups strategies by (symbol, method, session, buy%, sell%)
3. **Calculate Metrics**: Computes average ROI, consistency, win rate across all pattern instances
4. **Find Best/Worst**: For each stock+session, identifies the highest and lowest performing strategy
5. **Sort Results**: Orders by symbol → session (RTH first) → category (BEST first)

### Frontend Display (`frontend-dashboard/app/reports/custom-pattern-analyzer/page.tsx`):

- **Green rows**: BEST performers (bg-green-50)
- **Red rows**: WORST performers (bg-red-50)
- **Blue badges**: RTH session
- **Purple badges**: AH session
- **Category column**: Shows "BEST" or "WORST" in bold

## Use Cases

### 1. Pattern-Specific Optimization
**Question**: "When BTC drops 3% in 48 hours, which stocks should I trade and which should I avoid?"

**Answer**: Look at the BEST performers to see which stocks + settings work well during this pattern, and avoid the WORST performers.

### 2. Stock Comparison
**Question**: "Which stock is most reliable during this pattern?"

**Answer**: Compare the BEST strategies across all stocks - look for high consistency % and positive ROI.

### 3. Session Strategy
**Question**: "Should I trade RTH or AH during this pattern?"

**Answer**: Compare RTH vs AH results for each stock to see which session performs better.

### 4. Risk Avoidance
**Question**: "What settings should I definitely NOT use?"

**Answer**: The WORST performers show you which combinations lose money during this pattern.

## Key Metrics Explained

### Avg ROI
- Average return across all pattern instances
- Positive = profitable, Negative = losing money
- Higher is better for BEST, lower is worse for WORST

### Consistency
- % of pattern instances where the strategy was profitable
- 80%+ = Very reliable (green badge)
- 60-80% = Moderately reliable (yellow badge)
- <60% = Unreliable (red badge)

### Instances
- Number of pattern dates where this strategy had at least 3 occurrences
- Higher = more data, more reliable
- Minimum threshold: 3 instances (configurable via `minInstances` parameter)

### Win Rate
- % of individual trades that were profitable
- Different from consistency (which measures profitable days)
- Shows trade-level success rate

## API Endpoint

### POST `/api/patterns/best-worst-per-stock`

**Request Body:**
```json
{
  "matches": [
    {
      "start_date": "2024-03-15",
      "end_date": "2024-03-17",
      "change_pct": -3.5,
      ...
    }
  ],
  "offset": 1,        // 0 = during, 1 = day after, 2 = 2 days after, etc.
  "minInstances": 3   // minimum pattern instances required
}
```

**Response:**
```json
{
  "success": true,
  "offset": 1,
  "matchesAnalyzed": 74,
  "minInstances": 3,
  "totalResults": 44,
  "data": [
    {
      "symbol": "HIVE",
      "session": "RTH",
      "category": "BEST",
      "method": "EQUAL_MEAN",
      "buyPct": 2.9,
      "sellPct": 0.7,
      "avgRoi": 8.52,
      "consistency": 85.5,
      "instances": 74,
      "avgWinRate": 72.3,
      "minRoi": -2.1,
      "maxRoi": 18.7
    },
    {
      "symbol": "HIVE",
      "session": "RTH",
      "category": "WORST",
      "method": "VOL_WEIGHTED",
      "buyPct": 1.2,
      "sellPct": 2.1,
      "avgRoi": -2.34,
      "consistency": 35.2,
      "instances": 74,
      "avgWinRate": 42.1,
      "minRoi": -8.5,
      "maxRoi": 3.2
    },
    // ... 42 more results (11 stocks × 2 sessions × 2 categories)
  ]
}
```

## Performance

### Processing Time:
- **Pattern Detection**: ~1-2 seconds (unchanged)
- **Best/Worst Analysis**: ~10-15 seconds for 74 pattern dates
  - Calls Best Performers API twice per pattern date (RTH + AH)
  - 74 dates × 2 sessions = 148 API calls
  - 100ms delay between calls to avoid overwhelming API
  - Parallel processing within each call

### Optimization Opportunities:
1. **Batch API calls**: Process multiple dates in one request
2. **Cache results**: Store pattern analysis results for reuse
3. **Parallel sessions**: Query RTH and AH simultaneously instead of sequentially

## Example Workflow

### Step 1: Define Pattern
- Direction: Drop
- Magnitude: 3.5%
- Timeframe: 48 hours
- Date Range: Jan 2024 - Oct 2025

### Step 2: Review Matches
- System finds 74 matching instances
- Shows summary stats (avg change, max change, avg duration)
- Click "1 Day After (+1)" button

### Step 3: Analyze Results
- System processes all 74 dates
- Shows 44 results (best + worst for each stock+session)
- Green rows = strategies that work well
- Red rows = strategies that lose money

### Step 4: Take Action
- Pick a stock from the BEST performers
- Use those exact settings (method, buy%, sell%)
- Avoid the WORST performers entirely
- Monitor consistency % for reliability

## Files Modified

### Backend:
- `api-server/pattern-best-worst-per-stock.js` (NEW)
- `api-server/server.js` (added endpoint)

### Frontend:
- `frontend-dashboard/app/reports/custom-pattern-analyzer/page.tsx` (complete rewrite)

### Documentation:
- `BEST_WORST_PER_STOCK_FEATURE.md` (this file)

## Deployment Status

✅ Backend deployed to Cloud Run
✅ Frontend deployed to Vercel (https://raas.help)
✅ All changes committed to GitHub

## Next Steps

### Potential Enhancements:
1. **Add CSV export** for best/worst results
2. **Add filtering** by stock, session, or category
3. **Add sorting** by any column
4. **Add drill-down** to Fast Daily with those settings
5. **Add comparison mode** to compare multiple offsets side-by-side
6. **Add visualization** showing best/worst ROI distribution
7. **Add alerts** when current market matches a known pattern

## User Feedback

User requested: "I would like to see 44 things per date. Best stock settings per stock AH and RTH and worst settings per stock AH and RTH."

✅ **Delivered**: Exactly 44 results showing best + worst for each stock+session combination during the pattern dates.