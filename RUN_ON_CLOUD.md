# Running Event Processor on Google Cloud

## Why Run on Cloud?

**Benefits:**
- ✅ **8 vCPUs** - Much faster processing
- ✅ **16GB RAM** - Handle all parallel workers easily
- ✅ **No local computer needed** - Run and go to bed
- ✅ **Reliable** - Won't fail if your computer sleeps
- ✅ **Logs saved** - Easy to check progress and debug
- ✅ **Pay only for usage** - ~$2-3 for full year processing

**Expected Time with 8 vCPUs on Cloud:**
- 55 groups ÷ 8 parallel = 7 batches
- ~30 minutes per batch (faster than local)
- **Total: ~3.5 hours** (vs 5 hours locally)

## Prerequisites

### 1. Store Database Password in Secret Manager

First time only - store your database password securely:

```powershell
# Create secret with your database password
gcloud secrets create db-password --data-file=- --project=tradiac-testing
# When prompted, type: Fu3lth3j3t!
# Then press Ctrl+Z and Enter (Windows) or Ctrl+D (Mac/Linux)
```

Or create it in the console:
1. Go to: https://console.cloud.google.com/security/secret-manager?project=tradiac-testing
2. Click "CREATE SECRET"
3. Name: `db-password`
4. Secret value: `Fu3lth3j3t!`
5. Click "CREATE"

### 2. Grant Cloud Run Access to Secret

```powershell
# Get the Cloud Run service account
$SERVICE_ACCOUNT = gcloud iam service-accounts list --project=tradiac-testing --filter="displayName:Compute Engine default service account" --format="value(email)"

# Grant access to the secret
gcloud secrets add-iam-policy-binding db-password --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor" --project=tradiac-testing
```

## Running the Processor

### Option 1: Using the Script (Easiest)

```powershell
# Make script executable (first time only)
chmod +x scripts/run-on-cloud.sh

# Run for full year with 8 parallel workers
bash scripts/run-on-cloud.sh 2024-01-01 2024-12-31 8
```

### Option 2: Manual Steps

```powershell
# 1. Build and push the image
gcloud builds submit --config=cloudbuild-processor.yaml --project=tradiac-testing

# 2. Create the Cloud Run Job
gcloud run jobs create event-processor \
  --image=gcr.io/tradiac-testing/event-processor:latest \
  --region=us-central1 \
  --project=tradiac-testing \
  --cpu=8 \
  --memory=16Gi \
  --max-retries=0 \
  --task-timeout=4h \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_SSL=true" \
  --set-secrets="DB_PASSWORD=db-password:latest" \
  --args="2024-01-01,2024-12-31,8"

# 3. Execute the job
gcloud run jobs execute event-processor --region=us-central1 --project=tradiac-testing --wait
```

## Monitoring Progress

### View Logs in Real-Time

```powershell
# Stream logs as they come in
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=event-processor" --limit=50 --format=json --project=tradiac-testing --freshness=5m
```

### Check Job Status

```powershell
# Get job status
gcloud run jobs describe event-processor --region=us-central1 --project=tradiac-testing

# List executions
gcloud run jobs executions list --job=event-processor --region=us-central1 --project=tradiac-testing
```

### View in Console

Go to: https://console.cloud.google.com/run/jobs?project=tradiac-testing

## What You'll See

The job will output progress like:

```
================================================================================
PARALLEL EVENT-BASED PROCESSOR
================================================================================
Start Date: 2024-01-01
End Date: 2024-12-31
Max Parallel: 8
Total Groups: 55
================================================================================

[START] HIVE - EQUAL_MEAN - ALL
[START] RIOT - EQUAL_MEAN - ALL
[START] MARA - EQUAL_MEAN - ALL
...
[HIVE] Starting: HIVE - EQUAL_MEAN - ALL
[HIVE] Fetching minute data...
[HIVE] Fetched 87,360 minute bars
[HIVE] Processed 50/841 combinations (1,234 events so far)
[HIVE] Processed 100/841 combinations (2,456 events so far)
...
[DONE] HIVE - EQUAL_MEAN - ALL ✓
Progress: 1/55 (1.8%) - 1 done, 0 failed, 7 running - 0.5m elapsed
...
================================================================================
PROCESSING COMPLETE
================================================================================
Total time: 3.5 hours
Completed: 55/55
Failed: 0/55
================================================================================
```

## Cost Estimate

**Cloud Run Job Pricing:**
- 8 vCPUs × 3.5 hours = 28 vCPU-hours
- 16GB RAM × 3.5 hours = 56 GB-hours
- **Estimated cost: $2-3** for full year processing

Much cheaper than leaving your computer on overnight! 💰

## Troubleshooting

### If job fails with "secret not found":
```powershell
# Verify secret exists
gcloud secrets describe db-password --project=tradiac-testing

# Recreate if needed
echo "Fu3lth3j3t!" | gcloud secrets create db-password --data-file=- --project=tradiac-testing
```

### If job fails with "permission denied":
```powershell
# Grant Cloud Run access to secret
$SERVICE_ACCOUNT = gcloud iam service-accounts list --project=tradiac-testing --filter="displayName:Compute Engine default service account" --format="value(email)"
gcloud secrets add-iam-policy-binding db-password --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor" --project=tradiac-testing
```

### If job times out:
```powershell
# Increase timeout (max 24 hours)
gcloud run jobs update event-processor --task-timeout=8h --region=us-central1 --project=tradiac-testing
```

## After Completion

Once the job completes:

1. **Verify data in database:**
```sql
SELECT COUNT(*) FROM trade_events;
-- Should be ~7.4 million events

SELECT COUNT(*) FROM simulation_metadata WHERE status='completed';
-- Should be 49,500 (55 groups × 900 combos)
```

2. **Test API endpoints:**
```powershell
curl "https://your-api-url/api/events/top-performers?startDate=2024-01-01&endDate=2024-12-31&limit=10"
```

3. **Start analyzing!** 🎉

## Advantages Over Local Processing

| Feature | Local | Cloud Run Job |
|---------|-------|---------------|
| **Speed** | 5 hours | 3.5 hours |
| **Reliability** | Can fail if computer sleeps | Always completes |
| **Cost** | Electricity + wear | $2-3 total |
| **Monitoring** | Terminal only | Full logs in console |
| **Convenience** | Must stay awake | Run and go to bed |
| **Scalability** | Limited by your PC | Up to 32 vCPUs available |

## Recommendation

**Use Cloud Run Job for:**
- ✅ Full year processing
- ✅ Production runs
- ✅ Overnight processing
- ✅ Reliable execution

**Use Local for:**
- ✅ Testing small date ranges
- ✅ Development
- ✅ Quick iterations

---

**Ready to run on Cloud?** Just execute:

```powershell
bash scripts/run-on-cloud.sh 2024-01-01 2024-12-31 8
```

And go to bed! 😴