# Manual Deployment Instructions

## The Issue
The backend code has been fixed and pushed to GitHub, but Cloud Run hasn't automatically deployed the new version yet. You need to manually trigger the deployment.

## Quick Fix - Deploy Backend Manually

### Step 1: Open Google Cloud Console
Go to: https://console.cloud.google.com/run/detail/us-central1/tradiac-api?project=tradiac-testing

### Step 2: Click "Edit & Deploy New Revision"
- Click the blue "EDIT & DEPLOY NEW REVISION" button at the top

### Step 3: Deploy from Source Repository
- Under "Source", select "Deploy from source repository"
- Repository: loganlidster/zara
- Branch: main
- Build type: Dockerfile or Buildpacks (it will auto-detect)

### Step 4: Click "Deploy"
- Wait 2-3 minutes for the build and deployment to complete
- You'll see a green checkmark when it's done

## Alternative: Use Cloud Build Console

### Step 1: Open Cloud Build
Go to: https://console.cloud.google.com/cloud-build/builds?project=tradiac-testing

### Step 2: Check Recent Builds
- Look for builds triggered in the last 10 minutes
- If you see a recent build, check its status:
  - ✅ Green = Success (deployment worked)
  - ❌ Red = Failed (click to see error logs)
  - 🔵 Blue = Running (wait for it to finish)

### Step 3: If No Recent Builds
The Cloud Build trigger might not be connected. Go to:
https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing

Check if there's a trigger for the GitHub repository. If not, you'll need to create one or use the manual deployment method above.

## Verify Deployment Worked

After deployment completes, test the API:

```bash
curl -X POST https://tradiac-api-941257247637.us-central1.run.app/api/patterns/best-worst-per-stock \
  -H "Content-Type: application/json" \
  -d '{
    "matches": [
      {"start_date": "2024-03-15", "end_date": "2024-03-17", "change_pct": -3.5},
      {"start_date": "2024-04-10", "end_date": "2024-04-12", "change_pct": -4.2}
    ],
    "offset": 1,
    "minInstances": 3
  }'
```

**Expected Result**: Should return `"totalResults": 44` (or similar non-zero number)

**Current Result**: Returns `"totalResults": 0` (old code still deployed)

## Test the Frontend

Once the API is deployed:
1. Go to: https://raas.help/reports/custom-pattern-analyzer
2. Click "Find Patterns" (should show 74 matches)
3. Click "1 Day After (+1)" button
4. Wait 10-20 seconds
5. Should see a table with 44 rows (best + worst for each stock+session)

## What We Fixed

The backend code now:
- Processes ALL strategies across all pattern dates
- Groups by stock+session
- Finds best and worst within each group
- Always returns results for every stock (even if only 1-2 instances)

This ensures you get 44 results (11 stocks × 2 sessions × 2 categories) instead of 0.

## Need Help?

If deployment fails or you see errors:
1. Check the Cloud Build logs for error messages
2. Check the Cloud Run logs for runtime errors
3. Share the error message and I can help debug

The code is ready and working - it just needs to be deployed to Cloud Run!