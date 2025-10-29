# PowerShell Commands - Correct Format

## The Issue

PowerShell backticks (`) for line continuation need to be at the END of each line with NO SPACES after them.

## Correct Format for Running Jobs

### Option 1: Single Line (Easiest)
```powershell
gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-24 --wait
```

### Option 2: Multi-Line (Make sure NO SPACES after backticks)
```powershell
gcloud run jobs execute event-update-job `
--region=us-central1 `
--update-env-vars=TARGET_DATE=2025-10-24 `
--wait
```

**IMPORTANT:** The backtick (`) must be the LAST character on each line. No spaces after it!

## Commands for Testing

### Deploy the Job
```powershell
cd C:\tradiac-cloud\processor
.\setup-event-job.ps1
```

### Test October 24 (Single Line - Recommended)
```powershell
gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-24 --wait
```

### Test October 25
```powershell
gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-25 --wait
```

### Test October 28
```powershell
gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-28 --wait
```

## View Logs (Single Line)
```powershell
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=event-update-job" --limit=50 --format=json
```

## Check Job Status
```powershell
gcloud run jobs describe event-update-job --region=us-central1
```

## List Recent Executions
```powershell
gcloud run jobs executions list --job=event-update-job --region=us-central1 --limit=5
```

## Quick Reference - Copy/Paste Ready

```powershell
# Deploy
cd C:\tradiac-cloud\processor
.\setup-event-job.ps1

# Test Oct 24
gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-24 --wait

# Test Oct 25
gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-25 --wait

# Test Oct 28
gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-28 --wait

# View logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=event-update-job" --limit=50

# Check status
gcloud run jobs describe event-update-job --region=us-central1
```

## Pro Tip

Use single-line commands in PowerShell to avoid backtick issues. They're easier to copy/paste and less error-prone!