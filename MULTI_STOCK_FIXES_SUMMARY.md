# Multi-Stock Daily Curve - Fixes Summary

## Issues Fixed

### 1. Critical Math Bug ✅
**Problem**: ROI calculations were completely wrong (159,264,966.21% instead of -99.90%)

**Root Cause**: 
- Endpoint was fetching ALL events without threshold filtering
- Then tried to filter by comparing `event.buy_pct >= buyThreshold`
- But `buy_pct` column stores the threshold used to GENERATE the event, not a comparison value

**Solution**:
- Changed queries to use `WHERE buy_pct = $2 AND sell_pct = $3` (exact matching)
- Added `filterToAlternating()` function to match Daily Curve behavior
- Now simulation logic is 100% identical to Daily Curve

**Status**: ✅ Code complete, committed (77cac6c)

### 2. Separate RTH and AH Method Selection ✅
**Problem**: Each stock only had one method dropdown, but live system uses different methods for RTH vs AH

**Solution**:
- Updated `StockConfig` interface to have `rthMethod` and `ahMethod` instead of single `method`
- Added two separate method dropdowns in UI (RTH Method and AH Method)
- Updated backend to query different tables based on session-specific methods
- Updated summary table to show both RTH and AH methods
- Updated CSV export to include both methods

**Status**: ✅ Frontend deployed, backend ready for deployment

## Code Changes

### Frontend Changes
**File**: `frontend-dashboard/app/reports/multi-stock-daily-curve/page.tsx`
- Changed interface from `method: string` to `rthMethod: string, ahMethod: string`
- Changed grid from 6 columns to 8 columns to accommodate two method dropdowns
- Added separate RTH Method and AH Method dropdowns
- Updated table headers to show both methods
- Updated CSV export headers and data
- Removed old single Method dropdown

### Backend Changes
**File**: `api-server/multi-stock-daily-curve-endpoint.js`
- Updated `simulateSingleStock()` to accept `rthMethod` and `ahMethod` parameters
- Changed table name construction to use session-specific methods
- Updated validation to require both `rthMethod` and `ahMethod`
- Updated logging to show both methods
- Updated return object to include both methods

## Deployment Status

### ✅ Frontend Deployed
**URL**: https://frontend-dashboard-c48mkjgw2-logans-projects-57bfdedc.vercel.app
**Commit**: 191a654

Changes deployed:
- Separate RTH and AH method dropdowns
- Updated table with both method columns
- Fixed CSV export
- All TypeScript errors resolved

### ⏳ Backend Pending Deployment
**Latest Commit**: 191a654

Changes ready:
- Fixed math bug (exact threshold matching)
- Separate RTH and AH method support
- Updated validation and logging

**USER ACTION NEEDED**: Deploy backend to Cloud Run

## Testing After Deployment

### Test 1: Verify Math Fix
1. Go to Multi-Stock Daily Curve report
2. Add 3 stocks: HIVE, RIOT, MARA
3. Set all to EQUAL_MEAN method (both RTH and AH)
4. Set all thresholds to 0.5/0.5
5. Run simulation for Oct 1-31, 2024
6. **Expected**: ROI values between -100% and +100% (reasonable values)
7. **Compare**: Run Daily Curve with same settings - results should match

### Test 2: Verify Separate Methods
1. Add one stock (e.g., HIVE)
2. Set RTH Method to EQUAL_MEAN
3. Set AH Method to VWAP_RATIO
4. Set different thresholds: RTH 0.5/0.5, AH 0.7/0.3
5. Run simulation
6. **Expected**: System queries `trade_events_rth_equal_mean` and `trade_events_ah_vwap_ratio`
7. **Verify**: Results combine events from both tables with correct thresholds

### Test 3: Load Live Settings
1. Click "Load Live Settings" button
2. **Expected**: 11 stocks load with their actual live methods
3. **Verify**: Each stock can have different RTH and AH methods
4. Run simulation and verify results are reasonable

## Expected Behavior

### Before Fix
- MARA: 159,264,966.21% ROI ❌
- Included thousands of incorrect events
- Single method for both RTH and AH

### After Fix
- MARA: ~-99.90% ROI ✅ (or similar reasonable value)
- Only includes events matching exact thresholds
- Separate methods for RTH and AH sessions
- Matches Daily Curve results exactly

## Next Steps

1. ✅ Fix math bug (DONE)
2. ✅ Add separate RTH/AH methods (DONE)
3. ✅ Deploy frontend (DONE)
4. ⏳ **USER: Deploy backend to Cloud Run**
5. ⏳ Test both fixes
6. ⏳ Verify results match Daily Curve
7. ⏳ Test with live settings

## Files Modified

### Frontend (1 file)
- `frontend-dashboard/app/reports/multi-stock-daily-curve/page.tsx` (~50 lines changed)

### Backend (1 file)
- `api-server/multi-stock-daily-curve-endpoint.js` (~30 lines changed)

### Documentation (3 files)
- `DEPLOYMENT_NEEDED.md` (created)
- `MULTI_STOCK_FIXES_SUMMARY.md` (this file)
- `todo.md` (updated)

## Git History
- `77cac6c` - Fix Multi-Stock Daily Curve math - query exact thresholds like Daily Curve does
- `bd380c5` - Add separate RTH and AH method selection for Multi-Stock Daily Curve
- `93e0c2e` - Fix CSV export to use rthMethod and ahMethod
- `191a654` - Remove duplicate old Method dropdown