# Manual Deployment Steps

## Backend Deployment to Cloud Run

Since the service account credentials are not available in the environment, please follow these manual steps:

### Option 1: Using Google Cloud Console

1. **Go to Cloud Build**:
   - Visit: https://console.cloud.google.com/cloud-build/builds?project=tradiac-testing

2. **Trigger Manual Build**:
   - Click "Run" or "Trigger Build"
   - Select repository: `github_loganlidster_zara`
   - Branch: `main`
   - Build configuration: Use `api-server/cloudbuild.yaml`

3. **Monitor Build**:
   - Wait for build to complete (~3-5 minutes)
   - Check logs for any errors

### Option 2: Using gcloud CLI (if available locally)

```bash
cd /path/to/zara
gcloud builds submit --config api-server/cloudbuild.yaml --project tradiac-testing
```

### Option 3: Using Cloud Shell

1. **Open Cloud Shell**: https://console.cloud.google.com/cloudshell
2. **Clone repository**:
   ```bash
   git clone https://github.com/loganlidster/zara.git
   cd zara
   ```
3. **Trigger build**:
   ```bash
   gcloud builds submit --config api-server/cloudbuild.yaml
   ```

## Frontend Deployment to Vercel

The frontend should auto-deploy when changes are pushed to GitHub. To verify:

1. **Check Vercel Dashboard**: https://vercel.com/dashboard
2. **Look for deployment**: Should show "Building" or "Ready"
3. **If not auto-deploying**:
   - Go to project settings
   - Ensure GitHub integration is connected
   - Manually trigger deployment if needed

## Verification Steps

After deployment completes:

### 1. Test Best Performers Multi-Select
- Go to: https://your-frontend-url.vercel.app/reports/best-performers
- Select multiple symbols (e.g., HIVE, RIOT, MARA)
- Click "Find Best Performers"
- Verify results show data for all selected symbols

### 2. Test Best Performers Per-Stock View
- On Best Performers page
- Select "Top Performers Per Stock" radio button
- Click "Find Best Performers"
- Verify separate tables appear for each symbol

### 3. Test Daily Curve Session-Specific Baselines
- Go to: https://your-frontend-url.vercel.app/reports/daily-curve
- Select session: "ALL"
- Uncheck "Use same values for RTH and AH"
- Enter different values:
  - RTH Buy %: 3.0
  - RTH Sell %: 0.8
  - AH Buy %: 2.5
  - AH Sell %: 0.5
- Click "Generate Curve"
- Verify chart displays without errors

## Troubleshooting

### Backend Not Updating
- Check Cloud Build logs for errors
- Verify Docker image was pushed to GCR
- Check Cloud Run service is using latest image
- Restart Cloud Run service if needed

### Frontend Not Updating
- Check Vercel deployment logs
- Clear browser cache
- Try incognito/private window
- Verify correct branch is deployed

### API Errors
- Check Cloud Run logs: https://console.cloud.google.com/run/detail/us-central1/tradiac-api/logs
- Verify environment variables are set correctly
- Check database connectivity

## Current Deployment Status

- **Code committed**: ✅ Commit 2132991
- **Backend deployment**: ⏳ Pending manual trigger
- **Frontend deployment**: ⏳ Should auto-deploy from GitHub

## Next Steps

1. Manually trigger backend deployment using one of the options above
2. Wait for Vercel to auto-deploy frontend (or manually trigger)
3. Run verification tests
4. Report any issues found