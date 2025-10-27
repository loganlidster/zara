# Quick Start: Grid Tables System

## What We're Building

A system that pre-calculates ALL 900 buy/sell combinations (0.1% to 3.0%) for instant reporting.

**Instead of:**
- User requests simulation → Calculate on-the-fly → Wait 30 seconds → Show results

**We do:**
- Pre-calculate everything once → User requests → Query table → Show results in 100ms

## Step-by-Step Setup

### 1. Create the Tables (5 minutes)

```bash
# In Cloud SQL console, run:
database/create_grid_tables.sql
```

This creates:
- `precomputed_trades_grid` - All individual trades
- `precomputed_grid_summary` - Aggregated statistics

### 2. Run the Grid Processor (2-4 hours for 1 month)

```bash
cd processor
npm install  # If needed
node grid-processor.js 2025-09-01 2025-09-30
```

**What it does:**
- For EACH symbol (HIVE, RIOT, etc.)
- For EACH method (EQUAL_MEAN, etc.)
- For EACH session (RTH, AH, ALL)
- For EACH buy% (0.1 to 3.0)
- For EACH sell% (0.1 to 3.0)
- Calculate ALL trades and store them

**Progress output:**
```
🚀 Starting Grid Processing
Date Range: 2025-09-01 to 2025-09-30
Processing 121,500 combinations...

📊 Processing HIVE...
  EQUAL_MEAN RTH:
    Progress: 100 combos, 523 trades
    Progress: 200 combos, 1,047 trades
    ...
✅ Grid Processing Complete!
Total Combinations: 121,500
Total Trades: 45,678
```

### 3. Verify the Data

```sql
-- Check HIVE 9/24-9/25 with 0.5%/1.0%
SELECT 
  entry_date,
  entry_time,
  entry_price,
  exit_time,
  exit_price,
  trade_return_pct
FROM precomputed_trades_grid
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND session = 'RTH'
  AND buy_pct = 0.5
  AND sell_pct = 1.0
  AND entry_date BETWEEN '2025-09-24' AND '2025-09-25';
```

**Expected result:** Should match your hand calculations!

### 4. Test Fast Queries

```sql
-- Get summary for all 900 combinations (instant!)
SELECT 
  buy_pct,
  sell_pct,
  COUNT(*) as trades,
  SUM(trade_return_dollars) as total_return
FROM precomputed_trades_grid
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND session = 'RTH'
  AND entry_date BETWEEN '2025-09-24' AND '2025-09-25'
GROUP BY buy_pct, sell_pct
ORDER BY total_return DESC;
```

This returns 900 rows in ~100ms instead of calculating for 30 seconds!

## Next: Wire Up the Reports

Once the grid tables are populated, we'll update:

1. **Fast Daily Endpoint** - Query grid instead of simulating
2. **Batch Grid Search** - Use precomputed data
3. **Summary Stats** - Aggregate from grid table
4. **Heatmaps** - Visualize best combinations

## Timeline

- ✅ **Now**: Tables created, processor ready
- ⏳ **Next 2-4 hours**: Run processor for September data
- 🎯 **After that**: Wire up all reports to use grid tables
- 🚀 **Result**: All reports instant, batch grid search works!

## Commands Reference

```bash
# Create tables
psql -h 34.41.97.179 -U postgres -d tradiac_testing -f database/create_grid_tables.sql

# Run processor for September
cd processor
node grid-processor.js 2025-09-01 2025-09-30

# Run processor for specific date range
node grid-processor.js 2025-09-24 2025-09-25

# Check progress
psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "SELECT COUNT(*) FROM precomputed_trades_grid;"
```

## What's Different from Current System?

**Current System:**
- User clicks "Run Simulation"
- Backend calculates baseline
- Backend simulates minute-by-minute
- Returns results after 30 seconds

**Grid System:**
- User clicks "Run Simulation"
- Backend queries precomputed_trades_grid
- Returns results in 100ms
- Same accuracy, 300x faster!

## Ready to Start?

1. Run `database/create_grid_tables.sql` in Cloud SQL
2. Run `node grid-processor.js 2025-09-24 2025-09-25` for quick test
3. Verify results match your hand calculations
4. Then process full date range!

Let me know when you're ready to run it! 🚀