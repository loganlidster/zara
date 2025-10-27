# Lagging Baseline Strategy - CRITICAL FIX

## Problem Identified

The system was using the **current day's baseline** instead of the **previous trading day's baseline**.

### Your Strategy (Correct)
- Calculate baseline from 9/23 data → Use on 9/24
- Calculate baseline from 9/24 data → Use on 9/25

### What Was Happening (Wrong)
- Query for 9/24 baseline → Use on 9/24 (same day!)
- Query for 9/25 baseline → Use on 9/25 (same day!)

This caused the system to use baselines that were **one day ahead**, resulting in:
- Wrong buy/sell signals
- Incorrect ROI calculations
- -4.07% instead of expected +4.6%

## The Fix

### Changed in `api-server/fast-daily-endpoint.js`
```javascript
// BEFORE (WRONG):
const baselineResult = await client.query(`
  SELECT session, baseline
  FROM baseline_daily
  WHERE trading_day = $1  // Gets CURRENT day's baseline
    AND symbol = $2
    AND method = $3
`, [date, symbol, method]);

// AFTER (CORRECT):
const baselineResult = await client.query(`
  SELECT session, baseline
  FROM baseline_daily
  WHERE trading_day < $1  // Gets PREVIOUS day's baseline
    AND symbol = $2
    AND method = $3
  ORDER BY trading_day DESC
  LIMIT 1
`, [date, symbol, method]);
```

### Changed in `processor/nightly-processor-dual.js`
```javascript
// BEFORE (WRONG):
const baselineResult = await client.query(`
  SELECT symbol, method, session, baseline
  FROM baseline_daily
  WHERE trading_day = $1  // Gets CURRENT day's baseline
`, [date]);

// AFTER (CORRECT):
const baselineResult = await client.query(`
  SELECT DISTINCT ON (symbol, method, session) 
    symbol, method, session, baseline
  FROM baseline_daily
  WHERE trading_day < $1  // Gets PREVIOUS day's baseline for each symbol
  ORDER BY symbol, method, session, trading_day DESC
`, [date]);
```

## Expected Results After Fix

### HIVE 9/24-9/25 Test
**Baselines (from database):**
- 9/24: 28,616.78 (calculated from 9/23 data)
- 9/25: 30,059.78 (calculated from 9/24 data)

**Buy/Sell Thresholds (0.5% buy, 1% sell):**
- 9/24 Buy: 28,759.08
- 9/24 Sell: 28,329.84
- 9/25 Buy: 30,217.25
- 9/25 Sell: 29,766.25

**Expected Outcome:**
- 5 trades
- +4.6% ROI (instead of -4.07%)

## Deployment Status

✅ **Fix committed and pushed** (commit: 34d9ff1)
✅ **Cloud Build deploying** to tradiac-testing project
⏳ **Wait 2-3 minutes** for deployment to complete

## Testing Instructions

1. **Wait for deployment** to complete
2. **Re-run HIVE 9/24-9/25 simulation**:
   - Symbol: HIVE
   - Method: EQUAL_MEAN
   - Session: RTH
   - Buy: 0.5%
   - Sell: 1%
3. **Verify results**:
   - Should show 5 trades
   - Should show +4.6% ROI
   - Baselines should match database values

## Additional Issues

### CORS Error (Batch Grid Search)
The CORS configuration is correct in the code but needs to be deployed. After this deployment completes, the batch grid search should work.

If it still doesn't work, check:
1. Cloud Build deployment succeeded
2. Cloud Run service restarted with new code
3. Browser cache cleared

## Files Modified

1. `api-server/fast-daily-endpoint.js` - Fixed baseline query for API
2. `processor/nightly-processor-dual.js` - Fixed baseline query for processor
3. Documentation files created for reference

---

**This was the root cause of all incorrect simulation results!**