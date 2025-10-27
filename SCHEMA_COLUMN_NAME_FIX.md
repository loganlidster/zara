# Database Schema Column Name Fix - RESOLVED

## Problem Summary
SQL script `database/add_performance_indexes.sql` was failing with error:
```
pq: column "baseline_method" does not exist
```

## Root Cause
The database has **inconsistent column naming** across different precomputed tables:

### Table Column Name Mapping

| Table Name | Column for Method | Column for Buy | Column for Sell |
|------------|------------------|----------------|-----------------|
| `baseline_daily` | `method` | N/A | N/A |
| `precomputed_trades` | `baseline_method` | `buy_threshold_pct` | `sell_threshold_pct` |
| `precomputed_trades_rth` | `method` | `buy_threshold` | `sell_threshold` |
| `precomputed_trades_all` | `method` | `buy_threshold` | `sell_threshold` |
| `precomputed_trades_grid_rth` | `method` | `buy_pct` | `sell_pct` |
| `precomputed_trades_grid_ah` | `method` | `buy_pct` | `sell_pct` |
| `precomputed_trades_grid_all` | `method` | `buy_pct` | `sell_pct` |
| `precomputed_grid_summary` | `method` | `buy_pct` | `sell_pct` |

## The Error
The index creation script was trying to create an index on `precomputed_trades_rth` using:
```sql
CREATE INDEX IF NOT EXISTS idx_precomputed_rth_lookup 
ON precomputed_trades_rth(symbol, baseline_method, buy_threshold_pct, sell_threshold_pct);
```

But `precomputed_trades_rth` uses:
- `method` (not `baseline_method`)
- `buy_threshold` (not `buy_threshold_pct`)
- `sell_threshold` (not `sell_threshold_pct`)

## Solution Applied
Updated `database/add_performance_indexes.sql` to use the correct column names for each table:

```sql
-- Original precomputed_trades table (uses baseline_method)
CREATE INDEX IF NOT EXISTS idx_precomputed_trades_lookup 
ON precomputed_trades(symbol, baseline_method, buy_threshold_pct, sell_threshold_pct);

-- RTH trades (uses method, NOT baseline_method)
CREATE INDEX IF NOT EXISTS idx_precomputed_rth_lookup 
ON precomputed_trades_rth(symbol, method, buy_threshold, sell_threshold);

-- ALL trades (uses method, NOT baseline_method)
CREATE INDEX IF NOT EXISTS idx_precomputed_all_lookup 
ON precomputed_trades_all(symbol, method, buy_threshold, sell_threshold);

-- Grid tables (use method and buy_pct/sell_pct)
CREATE INDEX IF NOT EXISTS idx_precomputed_grid_rth_lookup 
ON precomputed_trades_grid_rth(symbol, method, buy_pct, sell_pct);
```

## Files Modified
- ✅ `database/add_performance_indexes.sql` - Fixed all index creation statements

## Status
✅ **FIXED** - The SQL script now uses the correct column names for each table.

## Next Action Required
Run the corrected SQL script in Cloud SQL to create the performance indexes.