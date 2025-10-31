# Deployment Status - Multi-Stock Daily Curve Fix

## What Was Fixed

### Critical Bug in Multi-Stock Daily Curve
**Problem**: ROI calculations were completely wrong (159,264,966.21% instead of reasonable values like -99.90%)

**Root Cause**: 
- Multi-stock endpoint was fetching ALL events from database without threshold filtering
- Then tried to filter by comparing `event.buy_pct >= buyThreshold`
- But `buy_pct` column stores the threshold used to GENERATE the event, not a comparison value
- This caused it to include thousands of incorrect events

**Solution**:
- Changed queries to match Daily Curve logic exactly
- Now uses `WHERE buy_pct = $2 AND sell_pct = $3` to fetch only events matching exact thresholds
- Removed incorrect filtering logic
- Added `filterToAlternating()` function to match Daily Curve behavior
- Simulation logic now matches Daily Curve 100%

## Code Changes

### Modified Files
1. `api-server/multi-stock-daily-curve-endpoint.js` - Complete rewrite to match Daily Curve logic

### Git Status
- ✅ Changes committed: `77cac6c`
- ✅ Pushed to GitHub: `main` branch
- ⏳ Backend deployment needed

## Deployment Instructions

### Option 1: Manual Cloud Build Trigger (Recommended)
1. Go to Google Cloud Console
2. Navigate to Cloud Build > Triggers
3. Find the trigger for `tradiac-api`
4. Click "Run" and select branch `main`
5. Wait 3-5 minutes for build to complete

### Option 2: Command Line (If you have gcloud CLI)
```bash
gcloud builds submit --config=api-server/cloudbuild.yaml
```

## Testing After Deployment

1. Go to Multi-Stock Daily Curve report
2. Set up 3 stocks with same settings (e.g., HIVE, RIOT, MARA with 0.5/0.5 thresholds)
3. Run simulation for Oct 1-31, 2024
4. Verify ROI values are reasonable (should be between -100% and +100%)
5. Compare with Daily Curve report using same settings - results should match

## Expected Results After Fix

Instead of:
- MARA: 159,264,966.21% ROI ❌

Should see:
- MARA: ~-99.90% ROI ✅
- HIVE: ~-99.80% ROI ✅
- RIOT: ~-99.90% ROI ✅

(Exact values depend on date range and thresholds)

## Wallet Loading Issue (Separate Issue)

The Real vs Projected report wallet dropdown is not loading. This is a separate issue from the math bug.

**Status**: Not yet investigated
**Priority**: Medium (after confirming multi-stock fix works)

## Next Steps

1. ✅ Fix multi-stock math (DONE)
2. ⏳ Deploy backend (USER ACTION NEEDED)
3. ⏳ Test multi-stock report
4. ⏳ Investigate wallet loading issue
5. ⏳ Add per-stock baseline method selection (if needed)