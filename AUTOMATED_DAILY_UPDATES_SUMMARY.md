# Automated Daily Updates - Complete Solution

## What I've Created

### 1. **Daily Update Job** (`processor/daily-update-job.js`)
A Node.js script that:
- ✅ Fetches previous day's minute data from Polygon.io (11 stocks + BTC)
- ✅ Inserts into `minute_stock` and `minute_btc` tables
- ✅ Calculates all baselines (5 methods × 2 sessions × 11 stocks)
- ✅ Inserts into `baseline_daily` table
- ✅ Supports backfilling specific dates via `TARGET_DATE` env var

### 2. **Docker Configuration** (`processor/Dockerfile.daily-update`)
- Containerizes the job for Cloud Run
- Includes all dependencies
- Ready to deploy

### 3. **Setup Scripts**
- **Linux/Mac**: `processor/setup-daily-job.sh`
- **Windows**: `processor/setup-daily-job.ps1`

Both scripts:
- Build Docker image
- Deploy to Cloud Run Jobs
- Set up Cloud Scheduler (runs at 1 AM EST daily)
- Test the job

### 4. **Backfill Scripts** (For Missing Oct 24-28 Data)
- **Linux/Mac**: `processor/backfill-oct-24-28.sh`
- **Windows**: `processor/backfill-oct-24-28.ps1`

Processes the 5 missing days (Oct 24, 25, 28 - skips weekend).

### 5. **Documentation**
- `DAILY_UPDATE_SETUP.md` - Complete setup guide
- `DATA_UPDATE_GUIDE.md` - Manual update procedures

## How to Set It Up

### Quick Start (PowerShell):

```powershell
# 1. Set your Polygon.io API key
$env:POLYGON_API_KEY = "your_polygon_api_key_here"

# 2. Navigate to processor directory
cd C:\path\to\zara\processor

# 3. Run setup script
.\setup-daily-job.ps1
```

This will:
1. Build the Docker image
2. Deploy to Cloud Run Jobs
3. Set up Cloud Scheduler to run daily at 1 AM EST
4. Ask if you want to test it

### Backfill Missing Data:

```powershell
# After setup, backfill Oct 24-28
$env:POLYGON_API_KEY = "your_polygon_api_key_here"
.\backfill-oct-24-28.ps1
```

## What Happens Daily at 1 AM EST

1. **Cloud Scheduler triggers** the Cloud Run Job
2. **Job fetches** previous day's data from Polygon.io
3. **Inserts** minute data into database
4. **Calculates** all baselines (110 total: 11 stocks × 5 methods × 2 sessions)
5. **Logs** completion status
6. **Emails** you if there's an error (optional - can set up)

## Cost

- **Cloud Run Job**: ~$0.01 per execution
- **Cloud Scheduler**: ~$0.10 per month
- **Total**: ~$3-5 per month

## Monitoring

View job status:
- **Cloud Console**: https://console.cloud.google.com/run/jobs/details/us-central1/daily-update-job?project=tradiac-testing
- **Logs**: https://console.cloud.google.com/logs/query?project=tradiac-testing

## What's NOT Included (Yet)

The job updates minute data and baselines, but does NOT process events. You'll need to either:

**Option A**: Run event processor separately after baselines are calculated
**Option B**: Add event processing to this job (would make it longer)
**Option C**: Create a second job that runs after this one completes

For now, the event processing can be done manually or we can add it to the automation.

## Next Steps

1. **Run setup script** with your Polygon.io API key
2. **Test the job** to make sure it works
3. **Backfill Oct 24-28** to catch up on missing data
4. **Verify** data in database
5. **Decide** if you want to add event processing to the automation

## Files Created

- `processor/daily-update-job.js` - Main job script
- `processor/Dockerfile.daily-update` - Docker configuration
- `processor/setup-daily-job.sh` - Linux/Mac setup
- `processor/setup-daily-job.ps1` - Windows setup
- `processor/backfill-oct-24-28.sh` - Linux/Mac backfill
- `processor/backfill-oct-24-28.ps1` - Windows backfill
- `processor/test-daily-update.js` - Local testing script
- `DAILY_UPDATE_SETUP.md` - Detailed documentation
- `DATA_UPDATE_GUIDE.md` - Manual update guide

All committed to GitHub and ready to use! 🚀