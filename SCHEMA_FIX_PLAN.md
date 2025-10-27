# Database Schema Column Name Fix

## Problem
Multiple files are using incorrect column name `baseline_method` when the actual column in the database is `method`.

## Actual Schema (from database export)

### baseline_daily table
- id (integer, NOT NULL)
- symbol (character varying, NOT NULL)
- session (character varying, NOT NULL)
- trading_day (date, NOT NULL)
- **method** (character varying, NOT NULL) ← Correct column name
- baseline (numeric, NOT NULL)
- sample_count (integer, nullable)
- min_ratio (numeric, nullable)
- max_ratio (numeric, nullable)
- std_dev (numeric, nullable)
- calculated_at (timestamp with time zone, nullable)

## Files That Need Fixing

### SQL Files
1. `database/create_precomputed_tables.sql` - Uses `baseline_method` in table definitions
2. `database/add_performance_indexes.sql` - References `baseline_method` in indexes

### JavaScript Files
1. `processor/nightly-processor.js` - Multiple references to `baseline_method`
2. `processor/test-processor.js` - References `baseline_method`
3. `processor/nightly-processor-optimized.js` - Multiple references to `baseline_method`

## Fix Strategy
Since the precomputed tables are separate from baseline_daily, we have two options:

**Option 1**: Keep `baseline_method` in precomputed tables (they're independent)
**Option 2**: Rename to `method` everywhere for consistency

**Decision**: Keep `baseline_method` in precomputed tables since they're separate tables and already use this naming. The error is likely coming from queries that JOIN or reference baseline_daily incorrectly.

## Action Items
1. Find the actual query causing the error
2. Fix any queries that reference baseline_daily.baseline_method (should be baseline_daily.method)
3. Keep precomputed table column names as-is (they use baseline_method correctly)