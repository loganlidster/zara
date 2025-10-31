# 🚨 URGENT: Backend Deployment Required

## Critical Issue
The backend running on Cloud Run is using **OLD CODE** that connects to the wrong database with the wrong credentials.

## Current State (OLD CODE on Cloud Run)
```
Database: postgres (EMPTY)
User: postgres (NO ACCESS TO WALLETS)
Result: 500 errors, authentication failures
```

## New Code (Ready to Deploy)
```javascript
// api-server/live-db.js
database: 'tradiac',  // ✅ Correct - contains wallets
user: 'appuser',      // ✅ Correct - has access
password: 'Fu3lth3j3t!'
```

## Why Everything is Broken
1. **Multi-Stock Math Bug**: Backend still using old query logic
2. **Wallet Loading**: Backend trying to connect to wrong database
3. **RTH/AH Methods**: Backend doesn't recognize new parameters

All fixes are written and committed, but **NOT DEPLOYED**.

## What Needs to Happen
**Deploy the backend to activate all fixes:**

### Step-by-Step Deployment
1. Open: https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing
2. Find the trigger named `tradiac-api` or similar
3. Click the "RUN" button
4. Select branch: `main`
5. Click "Run Trigger"
6. Wait 3-5 minutes for build to complete

### Alternative: Command Line
If you have gcloud CLI installed:
```bash
cd /path/to/zara
gcloud builds submit --config=api-server/cloudbuild.yaml
```

## What Will Be Fixed After Deployment
✅ Multi-Stock Daily Curve math (exact threshold matching)
✅ Wallet loading (connects to tradiac database with appuser)
✅ Separate RTH/AH method support
✅ All 27 endpoints using correct database credentials

## Verification After Deployment
1. **Check Logs**: Should see `[Live DB] Connected to tradiac live database`
2. **Test Wallets**: Real vs Projected page should load wallet dropdown
3. **Test Multi-Stock**: ROI should be reasonable (-100% to +100%)

## Current Git Status
- **Latest Commit**: `4286874`
- **Branch**: `main`
- **Status**: All code committed and pushed
- **Deployment**: ❌ NOT DEPLOYED

## Files That Need Deployment
- `api-server/live-db.js` - Correct database connection
- `api-server/wallets-endpoint.js` - Wallet loading logic
- `api-server/multi-stock-daily-curve-endpoint.js` - Fixed math
- `api-server/db.js` - Updated to use appuser
- 27+ other endpoint files - All updated to use appuser

## Time Estimate
- Build time: 3-5 minutes
- Total downtime: ~30 seconds during deployment
- Testing: 5 minutes

## Risk Assessment
- **Risk**: LOW - All changes are tested and committed
- **Rollback**: Easy - can revert to previous deployment if needed
- **Impact**: HIGH - Fixes 3 critical issues simultaneously

---

**ACTION REQUIRED**: Please deploy the backend now to activate all fixes.