# Pattern Analysis System Setup Guide

## Overview
This guide walks through setting up the Pattern Analysis system to detect and analyze BTC patterns and their impact on trading strategies.

## Step-by-Step Setup

### Step 1: Create Tables (5 seconds)
Run this in Cloud SQL to create the pattern analysis tables:

```sql
-- Copy and paste: database/create_pattern_analysis_tables.sql
```

This creates:
- `btc_aggregated` - 10-minute BTC bars (144 rows/day vs 1,440)
- `btc_patterns` - Detected pattern instances
- `pattern_performance` - Strategy performance during patterns
- `daily_btc_context` - Daily BTC metrics for pattern detection

### Step 2: Populate BTC Aggregated Data (30-60 seconds)
Aggregates minute data into 10-minute bars:

```sql
-- Copy and paste: database/populate_btc_aggregated.sql
```

Expected result:
- ~25,000 bars for Jan 2024 - Oct 2025 (144 bars/day × ~650 days)
- 90% reduction in data volume

### Step 3: Calculate Daily Context (60-90 seconds)
Calculates volatility, trends, record highs, gaps:

```sql
-- Copy and paste: database/populate_daily_btc_context.sql
```

This calculates:
- Rolling volatility (10-day and 30-day)
- Moving averages (20-day and 50-day)
- Record high tracking
- Monday gap detection
- Volume analysis

### Step 4: Detect Patterns (30-60 seconds)
Finds all pattern instances:

```sql
-- Copy and paste: database/detect_patterns.sql
```

Detects 6 pattern types:
1. **CRASH** - Down 3%+ in 72 hours
2. **SURGE** - Up 5%+ in 24 hours
3. **MONDAY_GAP** - Weekend moves (1%+ gap)
4. **HIGH_VOL** - 30-day volatility > 4%
5. **LOW_VOL** - 30-day volatility < 2%
6. **RECORD_HIGH_DROP** - Record high followed by 2%+ drop within 5 days

### Step 5: Verify Results
Check pattern counts:

```sql
SELECT * FROM pattern_summary;
```

Expected output:
```
pattern_type        | instance_count | avg_change_pct | first_occurrence | last_occurrence
--------------------+----------------+----------------+------------------+-----------------
HIGH_VOL           | 150-200        | varies         | 2024-01-XX       | 2025-10-XX
MONDAY_GAP         | 80-100         | varies         | 2024-01-XX       | 2025-10-XX
CRASH              | 20-40          | -5 to -10      | 2024-01-XX       | 2025-10-XX
SURGE              | 30-50          | 7 to 12        | 2024-01-XX       | 2025-10-XX
RECORD_HIGH_DROP   | 10-20          | -3 to -8       | 2024-01-XX       | 2025-10-XX
LOW_VOL            | 50-80          | varies         | 2024-01-XX       | 2025-10-XX
```

## Total Setup Time
**3-5 minutes** for all steps

## Next Steps

After setup is complete, you can:

1. **Query Patterns**: Find specific pattern instances
2. **Analyze Performance**: Run Best Performers for each pattern
3. **Build Dashboard Report**: Create Pattern Analysis UI
4. **Identify Overreactions**: Focus on RECORD_HIGH_DROP patterns

## Pattern Definitions

### 1. CRASH (Down 3%+ in 72 hours)
Identifies significant price drops over 3-day periods. Useful for testing strategies during market panics.

### 2. SURGE (Up 5%+ in 24 hours)
Identifies rapid price increases. Tests strategies during FOMO and euphoria.

### 3. MONDAY_GAP (Weekend moves)
Identifies Monday opening gaps from Friday close. Tests strategies for weekend momentum.

### 4. HIGH_VOL (30-day volatility > 4%)
Identifies volatile market periods. Tests strategies in uncertain conditions.

### 5. LOW_VOL (30-day volatility < 2%)
Identifies calm market periods. Tests strategies in stable conditions.

### 6. RECORD_HIGH_DROP (Overreaction Detection)
**Your special pattern** - Identifies when BTC hits record high then drops 2%+ within 5 days.
This captures the "overreaction" behavior you're measuring:
- People get excited at all-time highs
- They freak out when it drops
- Your algorithm measures the magnitude of that freakout

## Example Queries

### Find all crashes in 2024:
```sql
SELECT * FROM btc_patterns 
WHERE pattern_type = 'CRASH' 
AND start_date >= '2024-01-01'
ORDER BY btc_change_pct ASC;
```

### Find biggest record high drops:
```sql
SELECT 
    start_date,
    btc_start_price as record_high_price,
    btc_end_price as price_after_drop,
    btc_change_pct as drop_pct,
    pattern_metrics->>'overreaction_score' as overreaction_score
FROM btc_patterns 
WHERE pattern_type = 'RECORD_HIGH_DROP'
ORDER BY (pattern_metrics->>'overreaction_score')::NUMERIC DESC;
```

### Find Monday gaps with biggest moves:
```sql
SELECT 
    start_date,
    pattern_metrics->>'gap_pct' as gap_pct,
    pattern_metrics->>'gap_direction' as direction,
    btc_change_pct as day_change_pct
FROM btc_patterns 
WHERE pattern_type = 'MONDAY_GAP'
ORDER BY ABS((pattern_metrics->>'gap_pct')::NUMERIC) DESC;
```

## Troubleshooting

### If aggregation is slow:
- Check if indexes exist on `minute_btc(cal_date, bar_time)`
- Consider running during off-peak hours

### If pattern detection finds too few/many instances:
- Adjust thresholds in `detect_patterns.sql`
- For CRASH: Change `-3.0` to different percentage
- For SURGE: Change `5.0` to different percentage
- For MONDAY_GAP: Change `1.0` to different gap threshold

### If you want to rerun pattern detection:
```sql
DELETE FROM btc_patterns;
-- Then run detect_patterns.sql again
```

## Performance Notes

- **btc_aggregated**: 90% smaller than minute_btc (144 vs 1,440 rows/day)
- **Pattern queries**: Very fast (<100ms) due to small table size
- **Daily context**: Calculated once, reused for all pattern types
- **Indexes**: Automatically created for efficient querying

## Data Freshness

To update with new data:
1. Run `populate_btc_aggregated.sql` (adds new days)
2. Run `populate_daily_btc_context.sql` (updates metrics)
3. Run `detect_patterns.sql` (finds new patterns)

All scripts use `ON CONFLICT DO NOTHING` so they're safe to rerun.