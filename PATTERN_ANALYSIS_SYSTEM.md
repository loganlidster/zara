# Pattern Analysis System - Complete Guide

## Overview

The Pattern Analysis System identifies specific BTC market patterns and analyzes which trading strategies perform best during those patterns. This helps answer questions like:

- "What strategy works best during BTC crashes?"
- "How do my strategies perform after record highs?"
- "Are Monday gaps profitable?"
- "Do high volatility periods favor certain methods?"

## System Architecture

```
BTC Minute Data (minute_btc)
    ↓
BTC Aggregated (10-min bars) ← 90% data reduction
    ↓
Daily BTC Context (volatility, trends, record highs)
    ↓
Pattern Detection (6 pattern types)
    ↓
Pattern Performance Analysis (test strategies during patterns)
    ↓
Dashboard Reports (insights and recommendations)
```

## The 6 Pattern Types

### 1. CRASH - Down 3%+ in 72 hours
**What it detects:** Significant price drops over 3-day periods

**Why it matters:** Tests how strategies handle market panics and fear

**Example scenarios:**
- Regulatory news causes 5% drop
- Major exchange hack triggers selloff
- Macro economic concerns

**Questions it answers:**
- Which strategies protect capital during crashes?
- Do certain methods buy too early in crashes?
- Is RTH or AH better during panic selling?

### 2. SURGE - Up 5%+ in 24 hours
**What it detects:** Rapid price increases in 24 hours

**Why it matters:** Tests strategies during FOMO and euphoria

**Example scenarios:**
- ETF approval news
- Major institutional adoption
- Technical breakout

**Questions it answers:**
- Which strategies capture surge momentum?
- Do we sell too early during surges?
- Which baseline method tracks surges best?

### 3. MONDAY_GAP - Weekend moves (1%+ gap)
**What it detects:** Monday opening gaps from Friday close

**Why it matters:** Weekend trading creates gaps that may be profitable

**Example scenarios:**
- Weekend news moves BTC
- Crypto markets trade 24/7, stocks don't
- Gap up or gap down on Monday open

**Questions it answers:**
- Are Monday gaps mean-reverting or trending?
- Should we fade gaps or follow them?
- Do gap-up days differ from gap-down days?

### 4. HIGH_VOL - 30-day volatility > 4%
**What it detects:** Periods of high market uncertainty

**Why it matters:** High volatility may require different strategies

**Example scenarios:**
- Election uncertainty
- Fed policy changes
- Market regime shifts

**Questions it answers:**
- Do tighter thresholds work better in high vol?
- Which methods handle volatility best?
- Is RTH or AH more volatile?

### 5. LOW_VOL - 30-day volatility < 2%
**What it detects:** Calm, stable market periods

**Why it matters:** Low volatility may favor different approaches

**Example scenarios:**
- Summer doldrums
- Consolidation periods
- Range-bound markets

**Questions it answers:**
- Do wider thresholds work better in low vol?
- Which methods work in quiet markets?
- Are there fewer opportunities in low vol?

### 6. RECORD_HIGH_DROP - Overreaction Detection ⭐
**What it detects:** BTC hits record high, then drops 2%+ within 5 days

**Why it matters:** This is YOUR special pattern - measures overreaction behavior

**The Psychology:**
- People get excited at all-time highs (FOMO buying)
- They freak out when it drops (panic selling)
- Your algorithm measures the magnitude of that freakout
- Mining stocks may overreact more than BTC itself

**Questions it answers:**
- Which stocks overreact most to record high drops?
- What's the optimal buy threshold during overreactions?
- How long does the overreaction last?
- Which baseline method captures overreactions best?

**Overreaction Score:** Stored in `pattern_metrics->>'overreaction_score'`
- Higher score = bigger overreaction
- Measures how much stocks deviate from BTC move
- Your edge: Buying the overreaction, selling the recovery

## Workflow: From Pattern to Insight

### Phase 1: Setup (One-time, 3-5 minutes)
1. Create tables (`create_pattern_analysis_tables.sql`)
2. Populate BTC aggregated data (`populate_btc_aggregated.sql`)
3. Calculate daily context (`populate_daily_btc_context.sql`)
4. Detect patterns (`detect_patterns.sql`)

### Phase 2: Analysis (Per Pattern)
For each pattern instance:
1. Get pattern date range
2. Run Best Performers for that date range
3. Store results in `pattern_performance` table
4. Aggregate across all instances of that pattern type

### Phase 3: Insights (Dashboard)
Display:
- Pattern frequency and characteristics
- Best strategies per pattern
- Consistency scores (how often does strategy win?)
- Comparison across patterns
- Recommendations

## Example Analysis Flow

### Analyzing CRASH Patterns

**Step 1: Find all crashes**
```sql
SELECT 
    pattern_id,
    start_date,
    end_date,
    btc_change_pct,
    pattern_metrics->>'max_drawdown_pct' as max_drawdown
FROM btc_patterns 
WHERE pattern_type = 'CRASH'
ORDER BY start_date;
```

**Step 2: For each crash, run Best Performers**
```javascript
// For crash from 2024-03-15 to 2024-03-18
const results = await fetch('/api/events/top-performers-v2', {
  method: 'POST',
  body: JSON.stringify({
    startDate: '2024-03-15',
    endDate: '2024-03-18',
    symbol: 'All',
    method: 'All',
    session: 'RTH',
    limit: 100
  })
});
```

**Step 3: Store results**
```sql
INSERT INTO pattern_performance (
    pattern_id, symbol, method, session, buy_pct, sell_pct,
    total_trades, winning_trades, losing_trades, win_rate_pct,
    total_roi_pct, avg_trade_roi_pct, max_drawdown_pct,
    starting_equity, ending_equity
)
VALUES (...);
```

**Step 4: Aggregate across all crashes**
```sql
SELECT 
    symbol,
    method,
    session,
    buy_pct,
    sell_pct,
    COUNT(*) as pattern_instances,
    AVG(total_roi_pct) as avg_roi,
    AVG(win_rate_pct) as avg_win_rate,
    COUNT(*) FILTER (WHERE total_roi_pct > 0) as winning_instances,
    COUNT(*) FILTER (WHERE total_roi_pct > 0)::FLOAT / COUNT(*) * 100 as consistency_pct
FROM pattern_performance pp
JOIN btc_patterns p ON pp.pattern_id = p.pattern_id
WHERE p.pattern_type = 'CRASH'
GROUP BY symbol, method, session, buy_pct, sell_pct
ORDER BY avg_roi DESC
LIMIT 20;
```

**Step 5: Insights**
- "HIVE with EQUAL_MEAN, RTH, 2.5% buy, 0.8% sell wins 85% of crashes"
- "Average ROI during crashes: 3.2%"
- "Crashes last average 3.2 days"
- "Best to use tighter sell thresholds during crashes"

## Key Metrics

### Pattern-Level Metrics
- **Instance Count**: How often does this pattern occur?
- **Average Duration**: How long does the pattern last?
- **Average BTC Change**: Typical magnitude of the pattern
- **Frequency**: How many times per year?

### Strategy-Level Metrics (per pattern)
- **Average ROI**: Mean return across all instances
- **Consistency**: % of instances where strategy was profitable
- **Win Rate**: % of trades that were winners
- **Max Drawdown**: Worst loss during pattern
- **Trade Count**: How many trades executed

### Comparison Metrics
- **Best Strategy**: Highest average ROI
- **Most Consistent**: Highest consistency percentage
- **Safest**: Lowest max drawdown
- **Most Active**: Most trades executed

## Dashboard Reports to Build

### Report 1: Pattern Overview
- Table showing all 6 pattern types
- Instance counts, date ranges, characteristics
- Click any pattern to drill down

### Report 2: Pattern Deep Dive
- Selected pattern details
- All instances with dates and metrics
- Best strategies for this pattern
- Performance distribution chart

### Report 3: Strategy Comparison Across Patterns
- Pick a strategy (symbol, method, session, thresholds)
- See how it performs in each pattern type
- Identify which patterns favor this strategy

### Report 4: Overreaction Analysis (Special)
- Focus on RECORD_HIGH_DROP patterns
- Overreaction scores and rankings
- Which stocks overreact most?
- Optimal buy timing after record highs

### Report 5: Pattern Calendar
- Calendar view showing when patterns occurred
- Color-coded by pattern type
- Click any day to see patterns and performance

## API Endpoints Needed

### 1. Get Pattern Summary
```
GET /api/patterns/summary
Returns: List of all pattern types with counts and stats
```

### 2. Get Pattern Instances
```
GET /api/patterns/instances?type=CRASH&startDate=2024-01-01&endDate=2025-10-31
Returns: All instances of specified pattern type
```

### 3. Get Pattern Performance
```
GET /api/patterns/performance?patternId=123
Returns: All strategy results for this pattern instance
```

### 4. Get Best Strategies for Pattern Type
```
GET /api/patterns/best-strategies?type=CRASH&limit=20
Returns: Top strategies across all instances of this pattern
```

### 5. Analyze Pattern (Run Best Performers)
```
POST /api/patterns/analyze
Body: { patternId: 123, limit: 100 }
Returns: Runs Best Performers for this pattern's date range
```

### 6. Get Overreaction Rankings
```
GET /api/patterns/overreactions?limit=20
Returns: Record high drops ranked by overreaction score
```

## Implementation Priority

### Phase 1: Foundation (Today)
1. ✅ Create SQL tables
2. ✅ Write setup scripts
3. ⏳ Run setup in Cloud SQL (you do this)
4. ⏳ Verify pattern detection works

### Phase 2: API (Next)
1. Create pattern endpoints
2. Test with sample patterns
3. Deploy to Cloud Run

### Phase 3: Dashboard (After API)
1. Pattern Overview report
2. Pattern Deep Dive report
3. Overreaction Analysis report

### Phase 4: Automation (Future)
1. Daily pattern detection
2. Automatic performance analysis
3. Alert system for new patterns

## Expected Results

After running setup on Jan 2024 - Oct 2025 data:

- **CRASH**: 20-40 instances (major drops)
- **SURGE**: 30-50 instances (major rallies)
- **MONDAY_GAP**: 80-100 instances (most Mondays have some gap)
- **HIGH_VOL**: 150-200 days (volatile periods)
- **LOW_VOL**: 50-80 days (calm periods)
- **RECORD_HIGH_DROP**: 10-20 instances (your special pattern)

Total: ~350-500 pattern instances to analyze

## Performance Expectations

- **Pattern Detection**: 30-60 seconds (one-time)
- **Pattern Query**: <100ms (small tables)
- **Best Performers per Pattern**: 2-3 seconds
- **Full Analysis (all patterns)**: 10-20 minutes (one-time)
- **Dashboard Load**: <1 second (cached results)

## Next Steps

1. **You**: Run the 4 SQL scripts in Cloud SQL (3-5 minutes total)
2. **Me**: Build API endpoints for pattern queries
3. **Me**: Create Pattern Overview dashboard report
4. **Together**: Analyze results and refine thresholds
5. **Me**: Build Overreaction Analysis report (your special pattern)

Ready to start? Run the SQL scripts and let me know the results!