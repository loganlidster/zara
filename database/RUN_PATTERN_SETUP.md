# Quick Pattern Setup Guide

## Copy and Paste These 4 Scripts into Cloud SQL

### Step 1: Create Tables (5 seconds)
Open Cloud SQL Console → Query Editor → Paste this entire file:

**File:** `database/create_pattern_analysis_tables.sql`

Expected output: "Query completed successfully"

---

### Step 2: Populate BTC Aggregated (30-60 seconds)
Paste this entire file:

**File:** `database/populate_btc_aggregated.sql`

Expected output:
```
total_bars | first_date  | last_date   | unique_days | avg_bars_per_day
-----------+-------------+-------------+-------------+-----------------
~25000     | 2024-01-01  | 2025-10-XX  | ~650        | 144.00
```

---

### Step 3: Calculate Daily Context (60-90 seconds)
Paste this entire file:

**File:** `database/populate_daily_btc_context.sql`

Expected output:
```
total_days | first_date  | last_date   | record_high_days | monday_count | avg_30d_volatility
-----------+-------------+-------------+------------------+--------------+-------------------
~650       | 2024-01-01  | 2025-10-XX  | 10-20           | ~90          | 2.5-3.5
```

---

### Step 4: Detect Patterns (30-60 seconds)
Paste this entire file:

**File:** `database/detect_patterns.sql`

Expected output:
```
pattern_type        | instance_count | avg_change_pct | min_change_pct | max_change_pct
--------------------+----------------+----------------+----------------+----------------
HIGH_VOL           | 150-200        | varies         | varies         | varies
MONDAY_GAP         | 80-100         | varies         | varies         | varies
CRASH              | 20-40          | -5 to -10      | -15            | -3
SURGE              | 30-50          | 7 to 12        | 5              | 20
RECORD_HIGH_DROP   | 10-20          | -3 to -8       | -12            | -2
LOW_VOL            | 50-80          | varies         | varies         | varies
```

---

## Total Time: 3-5 minutes

## Verification Queries

After all 4 steps, run these to verify:

### Check table sizes:
```sql
SELECT 
    'btc_aggregated' as table_name, COUNT(*) as row_count FROM btc_aggregated
UNION ALL
SELECT 'daily_btc_context', COUNT(*) FROM daily_btc_context
UNION ALL
SELECT 'btc_patterns', COUNT(*) FROM btc_patterns;
```

Expected:
- btc_aggregated: ~25,000 rows
- daily_btc_context: ~650 rows
- btc_patterns: ~350-500 rows

### View pattern summary:
```sql
SELECT * FROM pattern_summary;
```

### View recent patterns:
```sql
SELECT 
    pattern_type,
    start_date,
    ROUND(btc_change_pct, 2) as change_pct,
    pattern_metrics
FROM btc_patterns
ORDER BY start_date DESC
LIMIT 20;
```

## Troubleshooting

### If Step 2 is slow (>2 minutes):
- This is normal for first run
- It's aggregating 1.5M+ minute bars
- Just wait, it will complete

### If Step 3 is slow (>3 minutes):
- This calculates rolling metrics for 650 days
- Multiple UPDATE statements run sequentially
- Just wait, it will complete

### If Step 4 finds 0 patterns:
- Check that Steps 2 and 3 completed successfully
- Verify btc_aggregated has data: `SELECT COUNT(*) FROM btc_aggregated;`
- Verify daily_btc_context has data: `SELECT COUNT(*) FROM daily_btc_context;`

### If you need to start over:
```sql
DROP TABLE IF EXISTS pattern_performance CASCADE;
DROP TABLE IF EXISTS btc_patterns CASCADE;
DROP TABLE IF EXISTS daily_btc_context CASCADE;
DROP TABLE IF EXISTS btc_aggregated CASCADE;
```

Then run all 4 steps again.

## What Happens Next

After you complete these 4 steps:

1. **I'll build API endpoints** to query patterns
2. **I'll create dashboard reports** to visualize patterns
3. **We'll analyze results** together
4. **We'll focus on overreaction patterns** (your special edge)

## Ready?

1. Open Cloud SQL Console
2. Navigate to Query Editor
3. Copy/paste each file in order
4. Wait for each to complete
5. Report back the pattern counts!

Let me know when you're done and what the pattern summary shows! 🚀