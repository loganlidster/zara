# 🚀 Quick Fix Reference - Daily Update Job

## The Problem
❌ Syntax error in `daily-update-job.js` - parameter count mismatch (9 vs 10 columns)

## The Solution
✅ Fixed in commit 83690be - changed `i*9` to `i*10` in parameter placeholders

---

## 🎯 What You Need To Do Now

### Step 1: Rebuild the Docker Image

**Easiest Method - Cloud Shell**:
```bash
# Open https://console.cloud.google.com/ and click Cloud Shell icon
git clone https://github.com/loganlidster/zara.git
cd zara/processor
gcloud builds submit --tag gcr.io/tradiac-testing/daily-update-job:latest -f Dockerfile.daily-update .
gcloud run jobs update daily-update-job --image gcr.io/tradiac-testing/daily-update-job:latest --region us-central1
```

**Alternative - Local Docker**:
```bash
cd processor
./rebuild-daily-update.sh  # Linux/Mac
# OR
.\rebuild-daily-update.ps1  # Windows
```

---

### Step 2: Test the Fix

```bash
# Test with Oct 25
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"

# Check logs to verify success
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=daily-update-job" --limit 20
```

**Expected Output**:
- ✅ Stock bars: ~40,000-50,000
- ✅ BTC bars: ~1,440
- ✅ Baselines: 110
- ✅ No errors

---

### Step 3: Complete the Backfill

```bash
# Process remaining dates
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"

# Then run event updates
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"
```

---

## 📊 Verification Queries

```sql
-- Check minute data exists
SELECT cal_date, COUNT(*) FROM minute_stock WHERE cal_date >= '2024-10-24' GROUP BY cal_date ORDER BY cal_date;

-- Check baselines exist
SELECT cal_date, COUNT(*) FROM baseline_daily WHERE cal_date >= '2024-10-24' GROUP BY cal_date ORDER BY cal_date;

-- Check events exist (sample table)
SELECT event_date, COUNT(*) FROM trade_events_rth_equal_mean WHERE event_date >= '2024-10-24' GROUP BY event_date ORDER BY event_date;
```

---

## 📁 Key Files

- ✅ `processor/daily-update-job.js` - Fixed (commit 83690be)
- 📖 `BUG_FIX_SUMMARY.md` - Complete details
- 📖 `REBUILD_DAILY_UPDATE_JOB.md` - Deployment guide
- 🔧 `processor/rebuild-daily-update.sh` - Linux/Mac script
- 🔧 `processor/rebuild-daily-update.ps1` - Windows script

---

## ⏱️ Timeline

1. **Now**: Rebuild Docker image (5 minutes)
2. **+5 min**: Test with Oct 25 (2-3 minutes)
3. **+10 min**: Process Oct 27, 28 (4-6 minutes)
4. **+15 min**: Run event updates (6-9 minutes)
5. **+25 min**: Verify data and test dashboard

**Total Time**: ~25-30 minutes to complete everything

---

## 🎉 Success Checklist

- [ ] Docker image rebuilt
- [ ] Oct 25 minute data processed
- [ ] Oct 27 minute data processed
- [ ] Oct 28 minute data processed
- [ ] Oct 25 events generated
- [ ] Oct 27 events generated
- [ ] Oct 28 events generated
- [ ] Dashboard shows fresh data
- [ ] All 10 event tables populated

---

## 💡 Pro Tips

1. **Use Cloud Shell** - It's already authenticated and has all tools
2. **Check logs** after each run to catch issues early
3. **Process dates sequentially** - easier to track progress
4. **Verify data** after each step before moving to next
5. **Save the verification queries** - you'll use them often

---

## 🆘 If Something Goes Wrong

1. Check logs: `gcloud logging read "resource.type=cloud_run_job" --limit 50`
2. Verify image: `gcloud run jobs describe daily-update-job --region us-central1`
3. Check environment variables are set
4. Ensure POLYGON_API_KEY is valid
5. Try processing one date at a time

---

## 📞 Quick Commands

```bash
# View job details
gcloud run jobs describe daily-update-job --region us-central1

# List recent executions
gcloud run jobs executions list --job daily-update-job --region us-central1

# View specific execution logs
gcloud logging read "resource.type=cloud_run_job" --limit 50 --format json

# Check if image is updated
gcloud run jobs describe daily-update-job --region us-central1 --format="value(template.template.containers[0].image)"
```

---

**Ready to go? Start with Step 1 above! 🚀**