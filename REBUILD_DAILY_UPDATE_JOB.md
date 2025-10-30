# Rebuild and Deploy daily-update-job

## The Bug That Was Fixed

**Problem**: The `daily-update-job.js` had a parameter count mismatch:
- INSERT statement has 10 columns: `(symbol, cal_date, bar_time, o, h, l, c, v, vw, n)`
- But parameter placeholders only went up to 9: `$${i*9+1}` through `$${i*9+9}`

**Solution**: Changed to `$${i*10+1}` through `$${i*10+10}` to match the 10 columns.

**Status**: ✅ Fix committed to GitHub (commit 83690be)

---

## Option 1: Rebuild Using Cloud Shell (Recommended)

```bash
# 1. Open Cloud Shell at https://console.cloud.google.com/
# 2. Clone the repo
git clone https://github.com/loganlidster/zara.git
cd zara/processor

# 3. Build and push the image
gcloud builds submit \
  --tag gcr.io/tradiac-testing/daily-update-job:latest \
  -f Dockerfile.daily-update \
  .

# 4. Update the Cloud Run job to use the new image
gcloud run jobs update daily-update-job \
  --image gcr.io/tradiac-testing/daily-update-job:latest \
  --region us-central1
```

---

## Option 2: Rebuild Using Local Docker

```bash
# 1. Navigate to processor directory
cd processor

# 2. Pull latest code
git pull origin main

# 3. Build the image
docker build --no-cache \
  -t gcr.io/tradiac-testing/daily-update-job:latest \
  -f Dockerfile.daily-update \
  .

# 4. Push to Google Container Registry
docker push gcr.io/tradiac-testing/daily-update-job:latest

# 5. Update Cloud Run job (requires gcloud CLI)
gcloud run jobs update daily-update-job \
  --image gcr.io/tradiac-testing/daily-update-job:latest \
  --region us-central1
```

---

## Option 3: Manual Update via Cloud Console

1. Go to https://console.cloud.google.com/run/jobs
2. Click on `daily-update-job`
3. Click "EDIT & DEPLOY NEW REVISION"
4. In the "Container image URL" field, click "SELECT"
5. Navigate to: `gcr.io/tradiac-testing/daily-update-job`
6. Select the `latest` tag
7. Click "SELECT"
8. Scroll down and click "DEPLOY"

---

## Verify the Fix

After rebuilding, test with Oct 25:

```bash
# Trigger the job for Oct 25
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --args="TARGET_DATE=2024-10-25"

# Check logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=daily-update-job" \
  --limit 50 \
  --format json
```

Expected output:
- ✅ Stock bars inserted: ~40,000-50,000
- ✅ BTC bars inserted: ~1,440
- ✅ Baselines calculated: 110 (11 stocks × 5 methods × 2 sessions)

---

## Next Steps After Successful Rebuild

1. **Process Oct 25**: `TARGET_DATE=2024-10-25`
2. **Process Oct 27**: `TARGET_DATE=2024-10-27` (Oct 26 was Saturday)
3. **Process Oct 28**: `TARGET_DATE=2024-10-28`
4. **Run event-update-job** for Oct 27, 28
5. **Verify all 10 tables** have complete data

---

## Quick Command Reference

```bash
# Execute for specific date
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --args="TARGET_DATE=2024-10-25"

# Check recent logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=daily-update-job" \
  --limit 20 \
  --format "table(timestamp,textPayload)"

# List all executions
gcloud run jobs executions list \
  --job daily-update-job \
  --region us-central1
```