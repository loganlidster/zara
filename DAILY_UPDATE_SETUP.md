# Daily Update Job Setup Guide

## Overview
This automated job runs daily at 1 AM EST to:
1. Fetch previous day's minute data from Polygon.io (stocks + BTC)
2. Insert data into `minute_stock` and `minute_btc` tables
3. Calculate baselines for all methods and sessions
4. Insert into `baseline_daily` table

## Prerequisites
- Google Cloud Project: `tradiac-testing`
- Polygon.io API Key
- Cloud SQL database access

## Setup Instructions

### Step 1: Build and Deploy the Cloud Run Job

```bash
# Navigate to processor directory
cd processor

# Build the Docker image
gcloud builds submit \
  --tag gcr.io/tradiac-testing/daily-update-job \
  --project tradiac-testing \
  --dockerfile Dockerfile.daily-update

# Create the Cloud Run Job
gcloud run jobs create daily-update-job \
  --image gcr.io/tradiac-testing/daily-update-job \
  --region us-central1 \
  --project tradiac-testing \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!,POLYGON_API_KEY=YOUR_API_KEY_HERE" \
  --max-retries 3 \
  --task-timeout 30m \
  --memory 2Gi \
  --cpu 2
```

### Step 2: Create Cloud Scheduler Job (Runs at 1 AM EST)

```bash
# Create scheduler job to run daily at 1 AM EST (6 AM UTC)
gcloud scheduler jobs create http daily-update-trigger \
  --location us-central1 \
  --schedule="0 6 * * *" \
  --time-zone="America/New_York" \
  --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/tradiac-testing/jobs/daily-update-job:run" \
  --http-method POST \
  --oauth-service-account-email YOUR_SERVICE_ACCOUNT@tradiac-testing.iam.gserviceaccount.com \
  --project tradiac-testing
```

### Step 3: Test the Job Manually

```bash
# Run the job manually to test
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --project tradiac-testing
```

### Step 4: Monitor Job Execution

```bash
# View job logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=daily-update-job" \
  --limit 50 \
  --project tradiac-testing \
  --format json
```

Or view in Cloud Console:
https://console.cloud.google.com/run/jobs/details/us-central1/daily-update-job?project=tradiac-testing

## Environment Variables

The job requires these environment variables:

- `DB_HOST`: Cloud SQL IP (34.41.97.179)
- `DB_PORT`: 5432
- `DB_NAME`: tradiac_testing
- `DB_USER`: postgres
- `DB_PASSWORD`: Fu3lth3j3t!
- `POLYGON_API_KEY`: Your Polygon.io API key

## What the Job Does

### 1. Fetch Stock Data
- Fetches minute-by-minute data for all 11 stocks
- Date: Previous trading day
- Source: Polygon.io API
- Inserts into `minute_stock` table

### 2. Fetch BTC Data
- Fetches minute-by-minute BTC price data
- Date: Previous trading day
- Source: Polygon.io API (X:BTCUSD)
- Inserts into `minute_btc` table

### 3. Calculate Baselines
For each stock, calculates 5 baseline methods × 2 sessions:

**Methods:**
- EQUAL_MEAN: Average of OHLC
- VWAP_RATIO: Volume-weighted average price ratio to BTC
- VOL_WEIGHTED: Volume-weighted price
- WINSORIZED: Trimmed mean (removes top/bottom 5%)
- WEIGHTED_MEDIAN: Volume-weighted median

**Sessions:**
- RTH: Regular Trading Hours (9:30 AM - 4:00 PM)
- AH: After Hours (4:00 AM - 9:30 AM)

Inserts into `baseline_daily` table.

## Schedule

- **Frequency**: Daily
- **Time**: 1:00 AM EST (6:00 AM UTC)
- **Timezone**: America/New_York
- **Cron**: `0 6 * * *`

## Error Handling

- Job retries up to 3 times on failure
- 30-minute timeout per execution
- Logs all errors to Cloud Logging
- On conflict, updates existing data (upsert)

## Cost Estimate

- Cloud Run Job: ~$0.01 per execution
- Cloud Scheduler: ~$0.10 per month
- Polygon.io API: Depends on your plan
- **Total**: ~$3-5 per month

## Manual Backfill (If Needed)

To backfill missing dates, modify the job to accept date parameters:

```bash
# Set environment variable for specific date
gcloud run jobs update daily-update-job \
  --set-env-vars="TARGET_DATE=2025-10-24" \
  --region us-central1 \
  --project tradiac-testing

# Execute
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --project tradiac-testing
```

## Verification

After the job runs, verify data was inserted:

```sql
-- Check latest date in minute_stock
SELECT MAX(cal_date) FROM minute_stock;

-- Check latest date in minute_btc
SELECT MAX(cal_date) FROM minute_btc;

-- Check latest date in baseline_daily
SELECT MAX(cal_date) FROM baseline_daily;

-- Count records for latest date
SELECT 
  (SELECT COUNT(*) FROM minute_stock WHERE cal_date = (SELECT MAX(cal_date) FROM minute_stock)) as stock_bars,
  (SELECT COUNT(*) FROM minute_btc WHERE cal_date = (SELECT MAX(cal_date) FROM minute_btc)) as btc_bars,
  (SELECT COUNT(*) FROM baseline_daily WHERE cal_date = (SELECT MAX(cal_date) FROM baseline_daily)) as baselines;
```

## Troubleshooting

### Job Fails with "No data found"
- Check if it's a weekend or holiday (no trading data)
- Verify Polygon.io API key is valid
- Check Polygon.io API limits

### Database Connection Errors
- Verify Cloud SQL IP is correct
- Check database credentials
- Ensure Cloud Run Job has network access to Cloud SQL

### Timeout Errors
- Increase task-timeout (currently 30m)
- Increase memory/CPU allocation
- Check for slow Polygon.io API responses

## Next Steps

After setting up the daily update job, you may want to:

1. **Event Processing**: Set up a second job to process events after baselines are calculated
2. **Notifications**: Add Cloud Pub/Sub notifications on job completion/failure
3. **Monitoring**: Set up Cloud Monitoring alerts for job failures
4. **Dashboard**: Create a status dashboard showing last update time

## Support

For issues or questions:
- Check Cloud Run Job logs in Cloud Console
- Review Polygon.io API documentation
- Check database connection and permissions