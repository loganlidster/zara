# Crypto Events Expansion to 30x30 Grid

## Overview
Expanding crypto event generation from limited combinations to full 30x30 grid structure matching the stock system.

## Current State
- ✅ Crypto events regenerated with CORRECT sell threshold formula
- ✅ Currently ~5-10k events per crypto with limited combinations
- ✅ Need to expand to 900 combinations (30x30 grid)

## New Threshold Structure

### 30 Threshold Values
```
0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0,
2.2, 2.4, 2.8, 3.0, 3.5, 3.7, 3.9, 4.0, 4.5, 5.0
```

**Breakdown:**
- 0.1 to 2.0 by 0.1 increments: **20 values**
- Additional values: 2.2, 2.4, 2.8, 3.0, 3.5, 3.7, 3.9, 4.0, 4.5, 5.0: **10 values**
- **Total: 30 thresholds**

### Combinations
- **Buy thresholds:** 30 values
- **Sell thresholds:** 30 values (same set)
- **Total combinations:** 30 × 30 = **900 combinations**

## Files Updated

### 1. CORRECT_crypto_event_generation.js
- ✅ Updated with 30-value threshold array
- ✅ Generates 900 combinations
- ✅ Standalone script for reference

### 2. cloudshell_crypto/crypto-event-generation.js
- ✅ Updated with 30-value threshold array
- ✅ Used by Cloud Run deployment
- ✅ Includes proper comments

### 3. REGENERATE_CRYPTO_30x30.sh
- ✅ New automated regeneration script
- ✅ Clears existing tables
- ✅ Builds and deploys with new thresholds
- ✅ Executes both EQUAL_MEAN and WINSORIZED

## Expected Results

### Event Counts
- **Before:** ~5-10k events per crypto (limited combinations)
- **After:** Millions of events per crypto (900 combinations)
- **Total dataset:** 19 symbols × 900 combos × 2 methods = 34,200 parameter sets

### Data Structure
Each crypto will have events for:
- 900 buy/sell threshold combinations
- 2 baseline methods (EQUAL_MEAN, WINSORIZED)
- 13 months of data (Oct 2024 - Nov 2025)

## Execution Instructions

### Option 1: Automated Script (Recommended)
```bash
bash REGENERATE_CRYPTO_30x30.sh
```

This will:
1. Clear existing crypto event tables
2. Create and deploy updated script
3. Generate events for EQUAL_MEAN method
4. Generate events for WINSORIZED method
5. Provide completion summary

### Option 2: Manual Execution
If you prefer step-by-step control, the script can be run in sections.

## Time Estimates

### Per Symbol (900 combinations)
- Data loading: ~5 seconds
- Event generation: ~2-3 minutes
- Database insertion: ~1-2 minutes
- **Total per symbol:** ~3-5 minutes

### Full Regeneration
- 19 symbols × 3-5 minutes = **60-95 minutes per method**
- 2 methods (EQUAL_MEAN + WINSORIZED) = **120-190 minutes total**
- Plus setup/deployment time: ~5 minutes
- **Grand total:** ~2-3.5 hours

## Verification After Regeneration

### Check Event Counts
```sql
-- Count events per symbol and method
SELECT 
  symbol,
  COUNT(*) as event_count,
  COUNT(DISTINCT buy_pct) as unique_buy_thresholds,
  COUNT(DISTINCT sell_pct) as unique_sell_thresholds
FROM trade_events_crypto_equal_mean
GROUP BY symbol
ORDER BY symbol;
```

Expected results:
- Each symbol should have hundreds of thousands to millions of events
- 30 unique buy thresholds
- 30 unique sell thresholds

### Verify Threshold Values
```sql
-- Check all threshold values are present
SELECT DISTINCT buy_pct FROM trade_events_crypto_equal_mean ORDER BY buy_pct;
SELECT DISTINCT sell_pct FROM trade_events_crypto_equal_mean ORDER BY sell_pct;
```

Should return all 30 values from the threshold array.

### Test Reports
1. **Grid Search Report** - Should show 30×30 grid
2. **Fast Daily Report** - Should have 900 combinations to analyze
3. **Daily Curve Report** - Should show performance across all thresholds

## Benefits of 30×30 Grid

### 1. Comprehensive Analysis
- Full parameter space exploration
- Better optimization opportunities
- More granular performance insights

### 2. Consistency with Stock System
- Same grid structure as stocks
- Familiar analysis patterns
- Unified reporting interface

### 3. Better Trading Strategies
- Fine-tuned threshold selection
- Risk/reward optimization
- Multiple strategy options

## Next Steps After Regeneration

1. ✅ Verify event counts in database
2. ✅ Test all three crypto reports
3. ✅ Validate Grid Search functionality
4. ✅ Compare EQUAL_MEAN vs WINSORIZED performance
5. ✅ Document optimal threshold ranges per crypto

## Notes

- The correct sell threshold formula is maintained: `baseline * (1 - sellPct / 100)`
- All events are generated with proper buy/sell logic
- 24/7 crypto trading (no session restrictions)
- Fees are NOT deducted in event generation (handled in reports)

---

**Status:** Ready to execute
**Script:** `REGENERATE_CRYPTO_30x30.sh`
**Estimated Time:** 2-3.5 hours
**Expected Output:** ~34,200 parameter sets across 19 cryptos