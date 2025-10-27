# Grid Tables Setup Guide

## Overview

The grid tables system pre-calculates ALL possible buy/sell combinations (900 per symbol/method/session) for instant reporting.

## Architecture

### Tables Created
1. **precomputed_trades_grid** - Individual trades for every combination
2. **precomputed_grid_summary** - Aggregated statistics per combination

### Grid Parameters
- Buy percentages: 0.1%, 0.2%, 0.3%, ..., 3.0% (30 values)
- Sell percentages: 0.1%, 0.2%, 0.3%, ..., 3.0% (30 values)
- Combinations: 30 × 30 = 900 per symbol/method/session

### Total Combinations
- 9 symbols × 5 methods × 3 sessions × 900 combos = **121,500 combinations**

## Setup Instructions

### Step 1: Create Tables

Run the SQL script in your Cloud SQL console:

```bash
# Copy the contents of database/create_grid_tables.sql
# Paste into Cloud SQL query editor
# Execute
```

Or via command line:
```bash
psql -h 34.41.97.179 -U postgres -d tradiac_testing -f database/create_grid_tables.sql
```

### Step 2: Run Grid Processor

Process historical data for a date range:

```bash
cd processor
node grid-processor.js 2025-09-01 2025-09-30
```

**Processing Time Estimates:**
- 1 month of data: ~2-4 hours
- 3 months of data: ~6-12 hours
- 1 year of data: ~1-2 days

The processor will:
1. For each combination (symbol/method/session/buy%/sell%)
2. Calculate baseline from previous trading day
3. Simulate trades minute-by-minute
4. Store all trades in precomputed_trades_grid

### Step 3: Verify Data

Check that data was loaded:

```sql
-- Count total trades
SELECT COUNT(*) FROM precomputed_trades_grid;

-- Check HIVE EQUAL_MEAN RTH 0.5%/1.0%
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
ORDER BY entry_date, entry_time;

-- Summary by combination
SELECT 
  symbol,
  method,
  session,
  buy_pct,
  sell_pct,
  COUNT(*) as trade_count,
  SUM(trade_return_dollars) as total_return,
  AVG(trade_return_pct) as avg_return_pct
FROM precomputed_trades_grid
GROUP BY symbol, method, session, buy_pct, sell_pct
ORDER BY total_return DESC
LIMIT 20;
```

## Usage Examples

### Query Specific Combination
```sql
-- Get all trades for HIVE EQUAL_MEAN RTH 0.5%/1.0%
SELECT * FROM precomputed_trades_grid
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND session = 'RTH'
  AND buy_pct = 0.5
  AND sell_pct = 1.0
  AND entry_date BETWEEN '2025-09-24' AND '2025-09-25';
```

### Find Best Combinations
```sql
-- Top 10 combinations by total return
SELECT 
  symbol,
  method,
  session,
  buy_pct,
  sell_pct,
  COUNT(*) as trades,
  SUM(trade_return_dollars) as total_return,
  AVG(trade_return_pct) as avg_return
FROM precomputed_trades_grid
WHERE entry_date BETWEEN '2025-09-01' AND '2025-09-30'
GROUP BY symbol, method, session, buy_pct, sell_pct
ORDER BY total_return DESC
LIMIT 10;
```

### Batch Grid Search (Fast!)
```sql
-- Get summary for all 900 combinations for HIVE EQUAL_MEAN RTH
SELECT 
  buy_pct,
  sell_pct,
  COUNT(*) as trades,
  SUM(trade_return_dollars) as total_return,
  AVG(trade_return_pct) as avg_return,
  MIN(trade_return_pct) as worst_trade,
  MAX(trade_return_pct) as best_trade
FROM precomputed_trades_grid
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND session = 'RTH'
  AND entry_date BETWEEN '2025-09-01' AND '2025-09-30'
GROUP BY buy_pct, sell_pct
ORDER BY total_return DESC;
```

## Next Steps

After grid tables are populated:

1. **Update API Endpoints** - Query grid tables instead of simulating
2. **Fix Batch Grid Search** - Use precomputed data for instant results
3. **Add Summary Table** - Pre-aggregate statistics for even faster queries
4. **Build Heatmaps** - Visualize best buy/sell combinations
5. **Add Filters** - Date ranges, min trades, min return, etc.

## Maintenance

### Incremental Updates
To add new data without recalculating everything:

```bash
# Process only new dates
node grid-processor.js 2025-10-01 2025-10-31
```

### Rebuild Specific Combinations
```sql
-- Delete and recalculate specific combination
DELETE FROM precomputed_trades_grid
WHERE symbol = 'HIVE' AND method = 'EQUAL_MEAN' AND session = 'RTH';

-- Then run processor for that combination
```

### Performance Monitoring
```sql
-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('precomputed_trades_grid'));

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'precomputed_trades_grid';
```

## Benefits

✅ **Speed**: Queries return in milliseconds instead of minutes
✅ **Consistency**: Same calculation every time
✅ **Flexibility**: Easy to add new metrics and filters
✅ **Scalability**: Can handle years of data
✅ **Analysis**: Easy to find optimal parameters