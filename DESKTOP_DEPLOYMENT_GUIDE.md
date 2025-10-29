# Desktop Deployment Guide - Run Everything from Windows PowerShell

## Prerequisites

Make sure you have these installed on your desktop:
1. **Docker Desktop** - Running and signed in
2. **Google Cloud SDK** - Installed and authenticated
3. **Git** - To pull latest code

## Step 1: Pull Latest Code

Open PowerShell and navigate to your project:

```powershell
cd C:\tradiac-cloud
git pull origin main
```

This gets all the latest code including the event-update-job.

## Step 2: Authenticate with Google Cloud

```powershell
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project tradiac-testing

# Configure Docker to use gcloud credentials
gcloud auth configure-docker
```

## Step 3: Deploy the Event Update Job

Navigate to the processor directory and run the setup script:

```powershell
cd C:\tradiac-cloud\processor
.\setup-event-job.ps1
```

**What this does:**
1. Builds Docker image locally
2. Pushes to Google Container Registry
3. Deploys to Cloud Run Jobs
4. Asks if you want to set up Cloud Scheduler (say **N** for now - we'll test manually first)

**Expected output:**
```
========================================
Event Update Job Deployment
========================================
Project: tradiac-testing
Region: us-central1
Job Name: event-update-job

Building Docker image...
[+] Building 45.2s (10/10) FINISHED
...

Pushing image to GCR...
...

Deploying to Cloud Run Jobs...
✓ Deploying... Done.
✓ Creating execution...
  ✓ Routing traffic...
Done.

========================================
Deployment Complete!
========================================
```

## Step 4: Test with October 24

Now run the job for the first test date:

```powershell
gcloud run jobs execute event-update-job `
  --region=us-central1 `
  --update-env-vars=TARGET_DATE=2025-10-24 `
  --wait
```

**Expected output:**
```
✓ Creating execution... Done.
✓ Routing traffic...
Done.

Execution [event-update-job-xxxxx] has successfully completed.
```

**This will take 2-3 minutes.** You'll see it processing in real-time.

## Step 5: View Logs (Optional)

To see detailed logs of what happened:

```powershell
gcloud logging read `
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job' `
  --limit=50 `
  --format=json
```

Or view in Cloud Console:
https://console.cloud.google.com/run/jobs/details/us-central1/event-update-job

## Step 6: Verify Events in Database

Connect to your database and run:

```sql
-- Check if events were inserted
SELECT COUNT(*) as event_count
FROM trade_events_rth_equal_mean 
WHERE event_date = '2025-10-24';
```

**Expected:** event_count > 0

## Step 7: Test in Fast Daily Report

1. Go to https://raas.help
2. Open **Fast Daily** report
3. Select:
   - Symbol: HIVE
   - Method: EQUAL_MEAN
   - Session: RTH
   - Buy: 0.5%
   - Sell: 1.0%
   - Date range: Oct 23-24, 2025
4. Click "Run Simulation"

**Expected:** Should see events from both Oct 23 and Oct 24!

## Step 8: Run October 25

```powershell
gcloud run jobs execute event-update-job `
  --region=us-central1 `
  --update-env-vars=TARGET_DATE=2025-10-25 `
  --wait
```

Verify in database:
```sql
SELECT COUNT(*) FROM trade_events_rth_equal_mean WHERE event_date = '2025-10-25';
```

Test in Fast Daily with date range Oct 24-25.

## Step 9: Run October 28

```powershell
gcloud run jobs execute event-update-job `
  --region=us-central1 `
  --update-env-vars=TARGET_DATE=2025-10-28 `
  --wait
```

Verify in database:
```sql
SELECT COUNT(*) FROM trade_events_rth_equal_mean WHERE event_date = '2025-10-28';
```

Test in Fast Daily with date range Oct 24-28.

## Step 10: Set Up Automation (After Testing)

Once all three days are verified working, run the setup script again and say **Y** to Cloud Scheduler:

```powershell
cd C:\tradiac-cloud\processor
.\setup-event-job.ps1
```

When asked: "Would you like to set up Cloud Scheduler to run this daily at 2 AM EST? (Y/N)"
Type: **Y**

## Troubleshooting

### Docker Not Running
```
Error: Cannot connect to the Docker daemon
```
**Solution:** Start Docker Desktop and wait for it to fully start.

### Not Authenticated
```
Error: (gcloud.auth.configure-docker) You do not currently have an active account selected.
```
**Solution:** Run `gcloud auth login` and follow the prompts.

### Permission Denied
```
Error: Permission denied while trying to connect to the Docker daemon socket
```
**Solution:** Make sure Docker Desktop is running and you're in the docker-users group.

### Image Push Fails
```
Error: denied: Permission denied for "gcr.io/tradiac-testing/event-update-job"
```
**Solution:** Run `gcloud auth configure-docker` again.

### Job Execution Fails
```
Error: Job execution failed
```
**Solution:** Check logs with:
```powershell
gcloud logging read `
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job AND severity>=ERROR' `
  --limit=50
```

## Quick Reference

### Deploy Job
```powershell
cd C:\tradiac-cloud\processor
.\setup-event-job.ps1
```

### Run for Specific Date
```powershell
gcloud run jobs execute event-update-job `
  --region=us-central1 `
  --update-env-vars=TARGET_DATE=2025-10-24 `
  --wait
```

### View Logs
```powershell
gcloud logging read `
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job' `
  --limit=50
```

### Check Job Status
```powershell
gcloud run jobs describe event-update-job --region=us-central1
```

### List Recent Executions
```powershell
gcloud run jobs executions list `
  --job=event-update-job `
  --region=us-central1 `
  --limit=5
```

## Summary

**From your desktop PowerShell, you can:**
1. ✅ Deploy the job to Cloud Run
2. ✅ Run it for specific dates
3. ✅ View logs and status
4. ✅ Set up automation
5. ✅ Monitor executions

**No Cloud Shell needed!** Everything runs from your local PowerShell.

---

**Ready to deploy?** Just run:
```powershell
cd C:\tradiac-cloud\processor
.\setup-event-job.ps1
```