# Event Update System - Deployment Checklist

## Pre-Deployment Verification

- [x] Daily Update Job is deployed and running (1 AM EST)
- [x] Minute data exists in database (minute_stock, minute_btc)
- [x] Baselines are being calculated (baseline_daily)
- [x] 10 specialized tables exist in database
- [x] Docker is installed and running
- [x] Google Cloud SDK is installed and authenticated
- [x] You have access to tradiac-testing project

## Deployment Steps

### Step 1: Deploy Event Update Job

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

**Expected Output:**
- ✅ Docker image builds successfully
- ✅ Image pushes to GCR
- ✅ Cloud Run Job created/updated
- ✅ Cloud Scheduler configured (if you said yes)

**Verification:**
```bash
gcloud run jobs describe event-update-job --region=us-central1
```

Should show:
- Status: Ready
- Memory: 4Gi
- CPU: 2
- Timeout: 3600s

### Step 2: Test Manual Execution

**Run for yesterday:**
```bash
gcloud run jobs execute event-update-job --region=us-central1 --wait
```

**Expected Output:**
- Processing messages for each symbol/method/session
- Progress updates every 100 combinations
- Summary showing events inserted
- Duration: ~2-3 minutes
- Exit code: 0

**Verification:**
```sql
-- Check if events were inserted
SELECT COUNT(*) FROM trade_events_rth_equal_mean 
WHERE event_date = (CURRENT_DATE - INTERVAL '1 day');
```

Should return > 0 events.

### Step 3: Backfill Missing Data

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

**Expected Output:**
- Processing Oct 24... ✓
- Processing Oct 25... ✓
- Processing Oct 28... ✓
- Total time: ~6-9 minutes

**Verification:**
```sql
-- Check event counts for backfilled dates
SELECT 
  event_date,
  COUNT(*) as event_count
FROM trade_events_rth_equal_mean
WHERE event_date BETWEEN '2025-10-24' AND '2025-10-28'
GROUP BY event_date
ORDER BY event_date;
```

Should show data for Oct 24, 25, and 28.

### Step 4: Verify All Tables

**Check all 10 tables:**
```sql
SELECT 'trade_events_rth_equal_mean' as table_name, COUNT(*) as events FROM trade_events_rth_equal_mean WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_vwap_ratio', COUNT(*) FROM trade_events_rth_vwap_ratio WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_vol_weighted', COUNT(*) FROM trade_events_rth_vol_weighted WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_winsorized', COUNT(*) FROM trade_events_rth_winsorized WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_weighted_median', COUNT(*) FROM trade_events_rth_weighted_median WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_equal_mean', COUNT(*) FROM trade_events_ah_equal_mean WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_vwap_ratio', COUNT(*) FROM trade_events_ah_vwap_ratio WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_vol_weighted', COUNT(*) FROM trade_events_ah_vol_weighted WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_winsorized', COUNT(*) FROM trade_events_ah_winsorized WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_weighted_median', COUNT(*) FROM trade_events_ah_weighted_median WHERE event_date >= '2025-10-24';
```

All tables should show > 0 events.

### Step 5: Verify Reports

**Go to https://raas.help and test:**

1. **Fast Daily Report:**
   - Select: HIVE, EQUAL_MEAN, RTH
   - Date range: Oct 24-28, 2025
   - Should show trade events

2. **Best Performers Report:**
   - Date range: Oct 24-28, 2025
   - Should show results for all symbols

3. **Daily Curve Report:**
   - Select: HIVE, MARA, RIOT
   - Date range: Oct 24-28, 2025
   - Should show chart with data

### Step 6: Verify Cloud Scheduler

**Check scheduler status:**
```bash
gcloud scheduler jobs describe event-update-daily --location=us-central1
```

**Expected:**
- Schedule: 0 7 * * * (2 AM EST / 7 AM UTC)
- State: ENABLED
- Next run time: Should be scheduled

**View upcoming runs:**
```bash
gcloud scheduler jobs list --location=us-central1
```

## Post-Deployment Monitoring

### Daily Checks (First Week)

**Check execution status:**
```bash
gcloud run jobs executions list \
  --job=event-update-job \
  --region=us-central1 \
  --limit=5
```

**Check logs:**
```bash
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job' \
  --limit=50 \
  --format=json
```

**Check event counts:**
```sql
SELECT 
  event_date,
  COUNT(*) as events
FROM trade_events_rth_equal_mean
WHERE event_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY event_date
ORDER BY event_date DESC;
```

Should show increasing counts each day.

### Weekly Checks (Ongoing)

- [ ] Verify Cloud Scheduler is running
- [ ] Check for failed executions
- [ ] Verify event counts are growing
- [ ] Check reports show fresh data
- [ ] Review logs for errors

## Troubleshooting

### Job Failed

**Check logs:**
```bash
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job AND severity>=ERROR' \
  --limit=50
```

**Common issues:**
- Database connection timeout → Check Cloud SQL is running
- No minute data → Check daily-update-job ran successfully
- No baselines → Check baseline_daily table has data

### No Events Inserted

**Check source data:**
```sql
-- Check minute data exists
SELECT COUNT(*) FROM minute_stock WHERE et_date = '2025-10-24';

-- Check baselines exist
SELECT COUNT(*) FROM baseline_daily WHERE trading_day = '2025-10-23';

-- Check trading calendar
SELECT * FROM trading_calendar WHERE cal_date = '2025-10-24';
```

### Reports Show Old Data

**Check last event date:**
```sql
SELECT MAX(event_date) FROM trade_events_rth_equal_mean;
```

**If behind, run manual backfill:**
```bash
gcloud run jobs execute event-update-job \
  --region=us-central1 \
  --update-env-vars=TARGET_DATE=2025-10-29 \
  --wait
```

## Success Criteria

✅ **Deployment Successful:**
- Event Update Job deployed to Cloud Run
- Cloud Scheduler configured for 2 AM EST
- Manual test run completes successfully
- Backfill processes Oct 24, 25, 28
- All 10 tables have events for Oct 24-28
- Reports show data through Oct 28
- Daily automation runs successfully

✅ **System Operational:**
- Jobs run automatically every night
- Event counts increase daily
- Reports show fresh data every morning
- No failed executions
- Logs show no errors

## Rollback Plan

If something goes wrong:

**Pause automation:**
```bash
gcloud scheduler jobs pause event-update-daily --location=us-central1
```

**Delete job:**
```bash
gcloud run jobs delete event-update-job --region=us-central1
```

**Restore from backup:**
- Event tables can be truncated and repopulated
- Source data (minute_stock, minute_btc, baseline_daily) is preserved
- Re-run backfill scripts to restore data

## Support

If you need help:
1. Check logs first
2. Verify source data exists
3. Test with single date manually
4. Review EVENT_UPDATE_SYSTEM.md
5. Check QUICK_START_EVENT_UPDATES.md

## Summary

This checklist ensures:
- ✅ Event Update Job is deployed correctly
- ✅ System processes data successfully
- ✅ All tables are populated
- ✅ Reports show fresh data
- ✅ Automation runs daily
- ✅ Monitoring is in place

**Ready to deploy?** Start with Step 1!