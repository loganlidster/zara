# Quick Start Guide - Event Update System

## What This Does

Automatically processes daily trading data and populates the 10 specialized `trade_events` tables that power all your reports.

## Prerequisites

✅ Daily update job already deployed (fetches minute data + calculates baselines)
✅ 10 specialized tables already exist in database
✅ Google Cloud SDK installed and authenticated

## Deploy in 3 Steps

### Step 1: Deploy the Job (5 minutes)

**Windows:**
```powershell
cd C:\tradiac-cloud\processor
.\setup-event-job.ps1
```

**Linux/Mac:**
```bash
cd /path/to/tradiac-cloud/processor
./setup-event-job.sh
```

When asked about Cloud Scheduler, type **Y** to set up automatic daily runs.

### Step 2: Test It (3 minutes)

Run for yesterday:
```bash
gcloud run jobs execute event-update-job --region=us-central1 --wait
```

You should see:
- Processing messages for each symbol/method/session
- Progress updates every 100 combinations
- Summary showing events inserted
- Exit code 0 (success)

### Step 3: Backfill Missing Data (10 minutes)

**Windows:**
```powershell
cd C:\tradiac-cloud\processor
.\backfill-events-oct-24-28.ps1
```

**Linux/Mac:**
```bash
cd /path/to/tradiac-cloud/processor
./backfill-events-oct-24-28.sh
```

This processes Oct 24, 25, and 28 (skips weekend).

## Verify It's Working

### Check Event Counts
```sql
SELECT 
  'RTH EQUAL_MEAN' as table_name,
  COUNT(*) as events,
  MIN(event_date) as first_date,
  MAX(event_date) as last_date
FROM trade_events_rth_equal_mean
UNION ALL
SELECT 
  'AH EQUAL_MEAN',
  COUNT(*),
  MIN(event_date),
  MAX(event_date)
FROM trade_events_ah_equal_mean;
-- Repeat for other tables...
```

### Check Reports
1. Go to https://raas.help
2. Open **Fast Daily** report
3. Select any symbol, method, session
4. Set date range to Oct 24-28
5. You should see trade events!

## What Happens Daily

**1:00 AM EST** - Daily Update Job runs:
- Fetches minute data from Polygon
- Calculates baselines
- Takes ~2-3 minutes

**2:00 AM EST** - Event Update Job runs:
- Processes previous day's data
- Simulates 99,000 combinations
- Inserts events into 10 tables
- Takes ~2-3 minutes

**Morning** - Fresh data ready:
- All reports show yesterday's data
- No manual intervention needed

## Manual Operations

### Run for Specific Date
```bash
gcloud run jobs execute event-update-job \
  --region=us-central1 \
  --update-env-vars=TARGET_DATE=2025-10-29 \
  --wait
```

### View Logs
```bash
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job' \
  --limit=50
```

### Check Schedule
```bash
gcloud scheduler jobs describe event-update-daily --location=us-central1
```

### Pause Automation
```bash
gcloud scheduler jobs pause event-update-daily --location=us-central1
```

### Resume Automation
```bash
gcloud scheduler jobs resume event-update-daily --location=us-central1
```

## Troubleshooting

### "No data for date"
- Check if minute data exists: `SELECT COUNT(*) FROM minute_stock WHERE et_date = '2025-10-24'`
- Check if baselines exist: `SELECT COUNT(*) FROM baseline_daily WHERE trading_day = '2025-10-23'`
- Run daily-update-job first if data is missing

### "Job timed out"
- Normal processing: 2-3 minutes
- If timing out, check database connection
- View logs to see where it stopped

### "No events inserted"
- Check if date is a trading day (not weekend/holiday)
- Verify trading_calendar has is_open = true for that date
- Check if baselines were calculated for previous trading day

### Reports Show Old Data
- Check last event date: `SELECT MAX(event_date) FROM trade_events_rth_equal_mean`
- Verify Cloud Scheduler is running: `gcloud scheduler jobs describe event-update-daily --location=us-central1`
- Check for failed executions: `gcloud run jobs executions list --job=event-update-job --region=us-central1 --limit=5`

## Cost

- **Daily runs:** ~$0.10-0.20 per day
- **Monthly:** ~$3-6
- **Scheduler:** $0.10/month
- **Total:** ~$3-7/month

## Key Points

✅ **Wallet Continuity:** System correctly handles positions that carry overnight
✅ **Incremental:** Only processes new days, doesn't reprocess everything
✅ **Safe:** Uses ON CONFLICT DO NOTHING to prevent duplicates
✅ **Fast:** 2-3 minutes per day for all 10 tables
✅ **Automatic:** Runs every night at 2 AM EST
✅ **Reliable:** Transaction-based inserts, comprehensive error handling

## What You Need From Me

Nothing! The system is ready to deploy. Just run the setup script and you're done.

## Next Steps After Deployment

1. ✅ Deploy the job (Step 1)
2. ✅ Test it works (Step 2)
3. ✅ Backfill missing data (Step 3)
4. ✅ Verify reports show fresh data
5. ✅ Let it run automatically every night
6. ✅ Check logs weekly to ensure no failures

## Support

If you encounter issues:
1. Check the logs first
2. Verify source data exists (minute_stock, minute_btc, baseline_daily)
3. Test with a single date manually
4. Review EVENT_UPDATE_SYSTEM.md for detailed troubleshooting

---

**Ready to deploy?** Just run `setup-event-job.ps1` and follow the prompts!