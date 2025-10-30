# Daily Update Job Bug Fix - Complete Summary

## 🐛 The Bug

**Location**: `processor/daily-update-job.js`, line 90

**Problem**: Parameter count mismatch in SQL INSERT statement
- The INSERT has 10 columns: `symbol, cal_date, bar_time, o, h, l, c, v, vw, n`
- But the parameter placeholders only went from `$1` to `$9` (using `i*9+1` through `i*9+9`)
- This caused a "SyntaxError: Unexpected token ':'" when PostgreSQL tried to parse the query

**Root Cause**: When building the parameterized query, the code multiplied by 9 instead of 10:
```javascript
// WRONG (old code):
const values = data.map((bar, i) => 
  `($${i*9+1}, $${i*9+2}, $${i*9+3}, $${i*9+4}, $${i*9+5}, $${i*9+6}, $${i*9+7}, $${i*9+8}, $${i*9+9})`
).join(',');

// CORRECT (new code):
const values = data.map((bar, i) => 
  `($${i*10+1}, $${i*10+2}, $${i*10+3}, $${i*10+4}, $${i*10+5}, $${i*10+6}, $${i*10+7}, $${i*10+8}, $${i*10+9}, $${i*10+10})`
).join(',');
```

---

## ✅ The Fix

**Commit**: 83690be
**Date**: 2024-10-29
**Changes**: Changed multiplication factor from 9 to 10 to match the 10 columns in the INSERT statement

**Status**: 
- ✅ Code fixed in repository
- ✅ Committed to GitHub
- ⏳ Docker image needs to be rebuilt
- ⏳ Cloud Run job needs to be updated

---

## 🚀 Deployment Steps

### Option 1: Cloud Shell (Easiest)

```bash
# Open Cloud Shell at https://console.cloud.google.com/
git clone https://github.com/loganlidster/zara.git
cd zara/processor

# Build and deploy
gcloud builds submit \
  --tag gcr.io/tradiac-testing/daily-update-job:latest \
  -f Dockerfile.daily-update \
  .

# Update the job
gcloud run jobs update daily-update-job \
  --image gcr.io/tradiac-testing/daily-update-job:latest \
  --region us-central1
```

### Option 2: Local Docker

```bash
cd processor
git pull origin main

# Build
docker build --no-cache \
  -t gcr.io/tradiac-testing/daily-update-job:latest \
  -f Dockerfile.daily-update \
  .

# Push
docker push gcr.io/tradiac-testing/daily-update-job:latest

# Update
gcloud run jobs update daily-update-job \
  --image gcr.io/tradiac-testing/daily-update-job:latest \
  --region us-central1
```

### Option 3: Use Provided Scripts

**Windows PowerShell**:
```powershell
cd processor
.\rebuild-daily-update.ps1
```

**Linux/Mac**:
```bash
cd processor
./rebuild-daily-update.sh
```

---

## 🧪 Testing the Fix

After rebuilding, test with Oct 25:

```bash
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --args="TARGET_DATE=2024-10-25"
```

**Expected Results**:
- ✅ Stock bars inserted: ~40,000-50,000 (11 stocks × ~4,000 minutes each)
- ✅ BTC bars inserted: ~1,440 (24 hours × 60 minutes)
- ✅ Baselines calculated: 110 (11 stocks × 5 methods × 2 sessions)
- ✅ No syntax errors
- ✅ Job completes successfully

**Check Logs**:
```bash
gcloud logging read \
  "resource.type=cloud_run_job AND resource.labels.job_name=daily-update-job" \
  --limit 50 \
  --format "table(timestamp,textPayload)"
```

---

## 📋 Complete Backfill Plan

Once the fix is deployed and tested:

### 1. Process Minute Data (daily-update-job)
```bash
# Oct 25 (Friday)
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"

# Oct 27 (Sunday - skip Oct 26 Saturday)
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"

# Oct 28 (Monday)
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"
```

### 2. Process Events (event-update-job)
```bash
# Oct 24 (already done - 4,004 events)
# Oct 25
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"

# Oct 27
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"

# Oct 28
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"
```

### 3. Verify Data
```sql
-- Check minute data
SELECT cal_date, COUNT(*) as bars
FROM minute_stock
WHERE cal_date >= '2024-10-24'
GROUP BY cal_date
ORDER BY cal_date;

-- Check baselines
SELECT cal_date, COUNT(*) as baselines
FROM baseline_daily
WHERE cal_date >= '2024-10-24'
GROUP BY cal_date
ORDER BY cal_date;

-- Check events (all 10 tables)
SELECT 'rth_equal_mean' as table_name, COUNT(*) as events
FROM trade_events_rth_equal_mean
WHERE event_date >= '2024-10-24'
UNION ALL
SELECT 'rth_vwap_ratio', COUNT(*)
FROM trade_events_rth_vwap_ratio
WHERE event_date >= '2024-10-24'
-- ... repeat for all 10 tables
ORDER BY table_name;
```

---

## 📊 Expected Data Volumes

### Per Trading Day:
- **Minute Stock Data**: ~44,000 bars (11 stocks × ~4,000 minutes)
- **Minute BTC Data**: ~1,440 bars (24 hours × 60 minutes)
- **Baselines**: 110 records (11 stocks × 5 methods × 2 sessions)
- **Events**: ~4,000-5,000 per day (varies by market conditions)

### For Oct 24-28 (4 trading days):
- **Total Minute Stock**: ~176,000 bars
- **Total Minute BTC**: ~5,760 bars
- **Total Baselines**: 440 records
- **Total Events**: ~16,000-20,000 across all 10 tables

---

## 🎯 Success Criteria

✅ **Fix Deployed**: Docker image rebuilt and Cloud Run job updated
✅ **Oct 25 Processed**: Minute data and baselines calculated
✅ **Oct 27 Processed**: Minute data and baselines calculated
✅ **Oct 28 Processed**: Minute data and baselines calculated
✅ **Events Generated**: All 10 tables populated for Oct 24-28
✅ **Reports Working**: Dashboard shows fresh data
✅ **No Errors**: All jobs complete successfully

---

## 📁 Related Files

- `processor/daily-update-job.js` - Fixed file (commit 83690be)
- `processor/Dockerfile.daily-update` - Docker configuration
- `processor/rebuild-daily-update.ps1` - Windows deployment script
- `processor/rebuild-daily-update.sh` - Linux/Mac deployment script
- `REBUILD_DAILY_UPDATE_JOB.md` - Detailed deployment guide
- `BUG_FIX_SUMMARY.md` - This file

---

## 💡 Lessons Learned

1. **Parameter Counting**: Always verify parameter counts match column counts in SQL
2. **Testing**: Test with small datasets before deploying to production
3. **Error Messages**: PostgreSQL syntax errors can be cryptic - check parameter counts
4. **Docker Caching**: Use `--no-cache` when rebuilding after code changes
5. **Incremental Processing**: The ON CONFLICT DO NOTHING pattern makes backfilling safe

---

## 🔄 Next Steps

1. **Rebuild Docker image** using one of the methods above
2. **Test with Oct 25** to verify the fix works
3. **Process Oct 27 and 28** to complete the backfill
4. **Run event-update-job** for all dates
5. **Verify dashboard** shows complete data
6. **Monitor automated runs** starting Oct 29

---

## 📞 Support

If you encounter issues:
1. Check the logs: `gcloud logging read "resource.type=cloud_run_job"`
2. Verify the image was updated: `gcloud run jobs describe daily-update-job --region us-central1`
3. Test with a single date first before processing multiple dates
4. Ensure environment variables are set correctly (especially POLYGON_API_KEY)