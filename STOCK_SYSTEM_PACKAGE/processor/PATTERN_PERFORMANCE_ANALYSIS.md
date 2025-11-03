# Pattern Performance Analysis - Automated System

## Overview

This system automatically analyzes ALL pattern instances (e.g., all 14,394 CRASH patterns) by running Best Performers for each one and storing the results. Then it tells you which strategies consistently win during that pattern type.

## How It Works

### Step 1: Analyze Patterns
The script:
1. Fetches all instances of a pattern type (e.g., CRASH)
2. For each instance, runs Best Performers for that date range
3. Tests all symbols, methods, and thresholds
4. Stores results in `pattern_performance` table
5. Repeats for all pattern instances

### Step 2: Generate Report
After analysis, the script:
1. Aggregates results across all instances
2. Calculates average ROI, win rate, consistency
3. Shows which strategies win most often
4. Ranks by performance

## Usage

### Analyze CRASH Patterns (First 50)
```bash
node processor/analyze-pattern-performance.js analyze CRASH 50
```

This will:
- Process the first 50 CRASH pattern instances
- Run Best Performers for each one
- Store results in database
- Take ~5-10 minutes

### Analyze ALL CRASH Patterns (14,394)
```bash
node processor/analyze-pattern-performance.js analyze CRASH
```

This will:
- Process ALL 14,394 CRASH instances
- Take ~24-48 hours (1-2 seconds per pattern)
- Store ~1.4M performance records

### Generate Report
```bash
node processor/analyze-pattern-performance.js report CRASH
```

This shows:
- Top 20 strategies for CRASH patterns
- Average ROI across all instances
- Win rate and consistency percentage
- Min/Max ROI range

## Example Output

### During Analysis:
```
=== Analyzing CRASH Patterns ===

Processing batch: 1 to 10 of 14394

[1] Pattern ID: 12345
  Date Range: 2024-03-15 to 2024-03-18
  BTC Change: -5.2%
  Running Best Performers...
  Found 100 strategies
  ✓ Stored performance data

[2] Pattern ID: 12346
  Date Range: 2024-03-20 to 2024-03-23
  BTC Change: -4.8%
  Running Best Performers...
  Found 100 strategies
  ✓ Stored performance data

...

=== Analysis Complete ===
Total Processed: 50
Total Errors: 0
Success Rate: 100.0%
```

### Report Output:
```
=== Best Strategies for CRASH ===

┌─────────┬──────────────┬─────────┬────────┬─────────┬───────────┬──────────┬──────────┬─────────────┬──────────┬──────────┐
│ Symbol  │ Method       │ Session │ Buy %  │ Sell %  │ Instances │ Avg ROI  │ Win Rate │ Consistency │ Min ROI  │ Max ROI  │
├─────────┼──────────────┼─────────┼────────┼─────────┼───────────┼──────────┼──────────┼─────────────┼──────────┼──────────┤
│ HIVE    │ EQUAL_MEAN   │ RTH     │ 2.5    │ 0.8     │ 45        │ 3.2%     │ 72.5%    │ 85.0%       │ -2.1%    │ 12.5%    │
│ MARA    │ VWAP_RATIO   │ RTH     │ 2.8    │ 0.7     │ 42        │ 2.9%     │ 68.3%    │ 82.0%       │ -3.5%    │ 11.2%    │
│ RIOT    │ EQUAL_MEAN   │ RTH     │ 2.3    │ 0.9     │ 40        │ 2.7%     │ 70.1%    │ 80.0%       │ -1.8%    │ 10.8%    │
...
```

## What The Report Tells You

### Key Metrics:

1. **Avg ROI**: Average return across all instances of this pattern
   - "When CRASH happens, this strategy averages 3.2% ROI"

2. **Win Rate**: Percentage of trades that were profitable
   - "72.5% of trades during crashes are winners"

3. **Consistency**: Percentage of pattern instances where strategy was profitable
   - "85% of the time a crash happens, this strategy makes money"

4. **Min/Max ROI**: Range of returns
   - Shows best and worst case scenarios

5. **Instances**: How many times this was tested
   - More instances = more reliable data

## Strategy Recommendations

After running analysis, you'll know:

### For CRASH Patterns:
- "When BTC crashes 3%+ in 72 hours, use HIVE with EQUAL_MEAN, RTH, 2.5% buy, 0.8% sell"
- "This wins 85% of the time with average 3.2% ROI"
- "Tighter sell thresholds (0.7-0.9%) work best during crashes"

### For SURGE Patterns:
- "When BTC surges 5%+ in 24 hours, use MARA with VWAP_RATIO, RTH, 1.8% buy, 1.2% sell"
- "Wider thresholds capture more of the surge momentum"

### For RECORD_HIGH_DROP (Your Special Pattern):
- "When BTC hits record high then drops 2%+, use RIOT with VOL_WEIGHTED, RTH, 3.0% buy, 0.5% sell"
- "Buy the overreaction, sell the recovery quickly"

## Performance Considerations

### Processing Time:
- **Per pattern**: ~1-2 seconds
- **50 patterns**: ~5-10 minutes
- **1,000 patterns**: ~1-2 hours
- **14,394 patterns**: ~24-48 hours

### Database Storage:
- **Per pattern**: ~100 strategy results
- **50 patterns**: ~5,000 records
- **14,394 patterns**: ~1.4M records

### Recommendations:
1. **Start small**: Test with 50-100 patterns first
2. **Run overnight**: For large batches (1,000+)
3. **Use Cloud Run Job**: For full analysis (all 14,394)

## Running on Cloud Run Job

For processing all patterns, deploy as a Cloud Run Job:

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/tradiac-testing/pattern-analyzer
gcloud run jobs create pattern-analyzer \
  --image gcr.io/tradiac-testing/pattern-analyzer \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --max-retries 3 \
  --task-timeout 3h

# Run the job
gcloud run jobs execute pattern-analyzer \
  --args="analyze,CRASH,1000"
```

## Next Steps

### Phase 1: Test with Small Batch
```bash
node processor/analyze-pattern-performance.js analyze CRASH 50
node processor/analyze-pattern-performance.js report CRASH
```

### Phase 2: Analyze All Patterns
```bash
# Run for each pattern type
node processor/analyze-pattern-performance.js analyze CRASH
node processor/analyze-pattern-performance.js analyze SURGE
node processor/analyze-pattern-performance.js analyze RECORD_HIGH_DROP
node processor/analyze-pattern-performance.js analyze MONDAY_GAP
node processor/analyze-pattern-performance.js analyze HIGH_VOL
node processor/analyze-pattern-performance.js analyze LOW_VOL
```

### Phase 3: Build Dashboard Report
Create a new dashboard report showing:
- Best strategies per pattern type
- Consistency scores
- When to use which strategy
- Real-time recommendations

## Database Schema

The results are stored in `pattern_performance` table:

```sql
CREATE TABLE pattern_performance (
    performance_id SERIAL PRIMARY KEY,
    pattern_id INTEGER REFERENCES btc_patterns(pattern_id),
    symbol VARCHAR(10) NOT NULL,
    method VARCHAR(50) NOT NULL,
    session VARCHAR(10) NOT NULL,
    buy_pct DECIMAL(5,2) NOT NULL,
    sell_pct DECIMAL(5,2) NOT NULL,
    total_trades INTEGER NOT NULL,
    winning_trades INTEGER NOT NULL,
    losing_trades INTEGER NOT NULL,
    win_rate_pct DECIMAL(8,4),
    total_roi_pct DECIMAL(10,4) NOT NULL,
    avg_trade_roi_pct DECIMAL(10,4),
    max_drawdown_pct DECIMAL(10,4),
    starting_equity DECIMAL(12,2) NOT NULL,
    ending_equity DECIMAL(12,2) NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pattern_id, symbol, method, session, buy_pct, sell_pct)
);
```

## Example Queries

### Get best strategies for CRASH:
```sql
SELECT 
  symbol, method, session, buy_pct, sell_pct,
  COUNT(*) as instances,
  AVG(total_roi_pct) as avg_roi,
  AVG(win_rate_pct) as avg_win_rate,
  COUNT(*) FILTER (WHERE total_roi_pct > 0)::FLOAT / COUNT(*) * 100 as consistency
FROM pattern_performance pp
JOIN btc_patterns p ON pp.pattern_id = p.pattern_id
WHERE p.pattern_type = 'CRASH'
GROUP BY symbol, method, session, buy_pct, sell_pct
HAVING COUNT(*) >= 10
ORDER BY avg_roi DESC
LIMIT 20;
```

### Compare strategies across pattern types:
```sql
SELECT 
  p.pattern_type,
  pp.symbol,
  pp.method,
  AVG(pp.total_roi_pct) as avg_roi,
  COUNT(*) as instances
FROM pattern_performance pp
JOIN btc_patterns p ON pp.pattern_id = p.pattern_id
WHERE pp.symbol = 'HIVE' AND pp.method = 'EQUAL_MEAN'
GROUP BY p.pattern_type, pp.symbol, pp.method
ORDER BY p.pattern_type, avg_roi DESC;
```

## Troubleshooting

### Script fails with timeout:
- Reduce batch size from 10 to 5
- Add longer delays between API calls
- Run in smaller chunks (50-100 patterns at a time)

### API rate limiting:
- Add delays between requests (currently 100ms)
- Reduce concurrent requests
- Run during off-peak hours

### Database connection errors:
- Check Cloud SQL connection settings
- Verify database credentials
- Ensure connection pool is properly configured

## Summary

This automated system will:
1. ✅ Process ALL pattern instances (not just a few)
2. ✅ Test every strategy combination for each pattern
3. ✅ Store results for analysis
4. ✅ Tell you which strategies consistently win
5. ✅ Give you actionable recommendations

**Result:** "When BTC crashes, use THESE settings. When it surges, use THOSE settings."

Ready to run the first test batch? 🚀