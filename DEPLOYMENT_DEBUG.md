# Deployment Debug Guide

## Current Issue
The Custom Pattern Analyzer Step 2 is returning "No results found" even though we've fixed the code.

## Root Cause
The backend API code has been updated and pushed to GitHub, but Cloud Run hasn't deployed the new version yet.

## Cloud Build Status
- **cloudbuild.yaml exists**: ✅ Yes
- **Code pushed to GitHub**: ✅ Yes (commit c0d2355)
- **Auto-deployment configured**: ✅ Yes (should deploy on push to main)

## What Should Happen
1. Push code to GitHub main branch
2. Cloud Build trigger detects the push
3. Cloud Build runs the build steps in cloudbuild.yaml
4. API gets deployed to Cloud Run automatically
5. New code is live

## Manual Deployment Options

### Option 1: Check Cloud Build Console
1. Go to: https://console.cloud.google.com/cloud-build/builds?project=tradiac-testing
2. Look for recent builds triggered by the GitHub push
3. Check if build succeeded or failed
4. If failed, check the logs for errors

### Option 2: Manual Cloud Run Deployment
If Cloud Build isn't working, deploy manually:

```bash
cd api-server
gcloud run deploy tradiac-api \
  --source=. \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --project=tradiac-testing \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!"
```

### Option 3: Reconnect Cloud Build Trigger
If the trigger is disconnected:

1. Go to: https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing
2. Check if there's a trigger for the GitHub repo
3. If not, create a new trigger:
   - Source: GitHub (loganlidster/zara)
   - Branch: ^main$
   - Configuration: cloudbuild.yaml
   - Location: /cloudbuild.yaml

## Testing the Fix

Once deployed, test with:

```bash
curl -X POST https://tradiac-api-941257247637.us-central1.run.app/api/patterns/best-worst-per-stock \
  -H "Content-Type: application/json" \
  -d '{
    "matches": [
      {"start_date": "2024-03-15", "end_date": "2024-03-17", "change_pct": -3.5},
      {"start_date": "2024-04-10", "end_date": "2024-04-12", "change_pct": -4.2},
      {"start_date": "2024-05-20", "end_date": "2024-05-22", "change_pct": -3.8}
    ],
    "offset": 1,
    "minInstances": 3
  }'
```

Expected result: Should return data with `totalResults > 0`

## What Was Fixed

### File: `api-server/pattern-best-worst-per-stock.js`

**Problem**: The minInstances filter was applied globally before grouping by stock+session, causing all strategies to be filtered out.

**Solution**: 
1. Don't filter by minInstances before grouping
2. Group all strategies by stock+session first
3. Within each group, filter by minInstances
4. If a group has no strategies meeting minInstances, use all strategies for that group
5. This ensures every stock+session gets a best and worst result

**Code Changes**:
- Line 158: Removed `.filter(strategy => strategy.instances >= minInstances)`
- Lines 194-206: Added per-group filtering with fallback to all strategies

## Verification Steps

1. **Check Cloud Build**: https://console.cloud.google.com/cloud-build/builds?project=tradiac-testing
2. **Check Cloud Run**: https://console.cloud.google.com/run/detail/us-central1/tradiac-api?project=tradiac-testing
3. **Check Logs**: Look for the new console.log statements we added
4. **Test Frontend**: Go to https://raas.help/reports/custom-pattern-analyzer and click an analysis button

## Expected Behavior After Fix

When you click "1 Day After (+1)" with 74 pattern matches:
1. Button shows "Analyzing..." for 10-20 seconds
2. System processes all 74 dates (148 API calls for RTH + AH)
3. Returns 44 results (11 stocks × 2 sessions × 2 categories)
4. Table displays with green rows (BEST) and red rows (WORST)

## Current Status

- ✅ Code fixed and pushed to GitHub
- ⏳ Waiting for Cloud Build to deploy
- ❓ Need to verify deployment succeeded
- ❓ Need to test the fix works

## Next Steps

1. Check Cloud Build console for recent builds
2. If no recent builds, check if trigger is connected
3. If trigger is connected but not firing, manually trigger a build
4. If all else fails, deploy manually using gcloud command
5. Once deployed, test the frontend