# 🚀 RAAS Event Update System - Deployment Guide

**Project**: Automated Trading Event Pipeline  
**Status**: Bug Fixed - Ready for Deployment  
**Last Updated**: October 29, 2024

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [What Happened](#what-happened)
3. [What's Fixed](#whats-fixed)
4. [What You Need To Do](#what-you-need-to-do)
5. [Documentation Index](#documentation-index)
6. [Support](#support)

---

## 🎯 Quick Start

**If you just want to get this working, do this:**

1. Open Google Cloud Shell: https://console.cloud.google.com/
2. Run these commands:

```bash
git clone https://github.com/loganlidster/zara.git
cd zara/processor

# Rebuild the fixed image
gcloud builds submit --tag gcr.io/tradiac-testing/daily-update-job:latest -f Dockerfile.daily-update .

# Update the Cloud Run job
gcloud run jobs update daily-update-job --image gcr.io/tradiac-testing/daily-update-job:latest --region us-central1

# Test it
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"
```

3. Wait 2-3 minutes and check logs:
```bash
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=daily-update-job" --limit 20
```

4. If successful, process remaining dates:
```bash
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"
```

5. Generate events:
```bash
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"
```

**Done!** Your pipeline is complete. 🎉

---

## 🔍 What Happened

### The System
We built an automated data pipeline that:
1. Fetches minute-level stock and BTC data daily (1 AM EST)
2. Calculates baseline ratios using 5 different methods
3. Generates trading signals (BUY/SELL) based on thresholds (2 AM EST)
4. Populates 10 specialized tables for dashboard reports

### The Progress
- ✅ **Oct 24**: Successfully processed - 4,004 events generated
- ❌ **Oct 25-28**: Failed due to a bug in daily-update-job

### The Bug
The `daily-update-job.js` had a parameter count mismatch:
- SQL INSERT has 10 columns
- But parameter placeholders only went up to 9
- This caused: "SyntaxError: Unexpected token ':'"

**Example of the bug:**
```javascript
// WRONG (caused error):
const values = data.map((bar, i) => 
  `($${i*9+1}, ..., $${i*9+9})`  // Only 9 parameters
).join(',');

// INSERT has 10 columns:
INSERT INTO minute_stock (symbol, cal_date, bar_time, o, h, l, c, v, vw, n)
```

---

## ✅ What's Fixed

### Code Changes
- **File**: `processor/daily-update-job.js`
- **Line**: 90
- **Change**: `i*9` → `i*10` (to match 10 columns)
- **Commit**: 83690be
- **Status**: ✅ Committed to GitHub

### What's Ready
- ✅ Bug fix committed
- ✅ Deployment scripts created
- ✅ Documentation written
- ✅ Testing procedures documented
- ⏳ Docker image needs rebuild

---

## 🎯 What You Need To Do

### Step 1: Rebuild Docker Image (5 minutes)

**Option A - Cloud Shell (Easiest)**:
```bash
# Open https://console.cloud.google.com/ and click Cloud Shell
git clone https://github.com/loganlidster/zara.git
cd zara/processor
gcloud builds submit --tag gcr.io/tradiac-testing/daily-update-job:latest -f Dockerfile.daily-update .
gcloud run jobs update daily-update-job --image gcr.io/tradiac-testing/daily-update-job:latest --region us-central1
```

**Option B - Local Docker**:
```bash
cd processor
./rebuild-daily-update.sh  # Linux/Mac
# OR
.\rebuild-daily-update.ps1  # Windows
```

### Step 2: Test the Fix (3 minutes)

```bash
# Run for Oct 25
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"

# Check logs (wait 2-3 minutes)
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=daily-update-job" --limit 20
```

**Expected Output**:
- ✅ Stock bars: ~40,000-50,000
- ✅ BTC bars: ~1,440
- ✅ Baselines: 110
- ✅ No errors

### Step 3: Complete Backfill (15 minutes)

```bash
# Process remaining dates
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"
gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"

# Generate events
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-25"
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-27"
gcloud run jobs execute event-update-job --region us-central1 --args="TARGET_DATE=2024-10-28"
```

### Step 4: Verify (5 minutes)

```sql
-- Check minute data
SELECT cal_date, COUNT(*) FROM minute_stock WHERE cal_date >= '2024-10-24' GROUP BY cal_date ORDER BY cal_date;

-- Check baselines
SELECT cal_date, COUNT(*) FROM baseline_daily WHERE cal_date >= '2024-10-24' GROUP BY cal_date ORDER BY cal_date;

-- Check events
SELECT event_date, COUNT(*) FROM trade_events_rth_equal_mean WHERE event_date >= '2024-10-24' GROUP BY event_date ORDER BY event_date;
```

**Expected Results**:
- 4 dates with minute data (Oct 24, 25, 27, 28)
- 4 dates with baselines (110 each)
- 4 dates with events (~4,000-5,000 each)

---

## 📚 Documentation Index

### Start Here
- 📖 **QUICK_FIX_REFERENCE.md** - Quick reference card
- 📊 **DEPLOYMENT_STATUS.md** - Current status overview

### Detailed Guides
- 🐛 **BUG_FIX_SUMMARY.md** - Complete bug analysis
- 🚀 **REBUILD_DAILY_UPDATE_JOB.md** - Deployment options
- 📋 **EVENT_UPDATE_SYSTEM.md** - System architecture
- 🔧 **MANUAL_TESTING_GUIDE.md** - Testing procedures

### Scripts
- 🪟 **processor/rebuild-daily-update.ps1** - Windows deployment
- 🐧 **processor/rebuild-daily-update.sh** - Linux/Mac deployment

### Reference
- 📝 **COMPLETE_PIPELINE_SUMMARY.md** - Full pipeline docs
- ✅ **DEPLOYMENT_CHECKLIST.md** - Step-by-step checklist
- 🔐 **USER_MANAGEMENT_GUIDE.md** - Authentication docs

---

## 🎯 Success Checklist

After completing all steps, you should have:

- [ ] Docker image rebuilt with bug fix
- [ ] Oct 25 minute data processed (~44,000 bars)
- [ ] Oct 27 minute data processed (~44,000 bars)
- [ ] Oct 28 minute data processed (~44,000 bars)
- [ ] Oct 25 events generated (~4,000-5,000)
- [ ] Oct 27 events generated (~4,000-5,000)
- [ ] Oct 28 events generated (~4,000-5,000)
- [ ] All 10 event tables populated
- [ ] Dashboard showing fresh data
- [ ] Automated jobs running daily

---

## 💰 Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| daily-update-job | $3-5 |
| event-update-job | $3-7 |
| Cloud Scheduler | $0.40 |
| **Total** | **$6-12** |

**Note**: Cloud SQL costs are separate and already covered by existing infrastructure.

---

## 🆘 Support

### Common Issues

**Issue**: "Permission denied" when running gcloud commands
- **Solution**: Make sure you're authenticated: `gcloud auth login`

**Issue**: "Image not found" when updating job
- **Solution**: Verify image was pushed: `gcloud container images list --repository=gcr.io/tradiac-testing`

**Issue**: Job fails with timeout
- **Solution**: Check POLYGON_API_KEY is set correctly in environment variables

**Issue**: No data inserted
- **Solution**: Verify date is a trading day (not weekend/holiday)

### Getting Help

1. **Check Logs**:
```bash
gcloud logging read "resource.type=cloud_run_job" --limit 50
```

2. **Verify Job Status**:
```bash
gcloud run jobs describe daily-update-job --region us-central1
```

3. **List Recent Executions**:
```bash
gcloud run jobs executions list --job daily-update-job --region us-central1
```

### Contact

- **GitHub**: https://github.com/loganlidster/zara
- **Issues**: Create an issue in the repository
- **Email**: loganlidster@gmail.com

---

## 🎉 What's Next

After successful deployment:

1. **Monitor**: Check logs daily to ensure jobs run successfully
2. **Verify**: Confirm dashboard shows fresh data each morning
3. **Optimize**: Review performance and adjust if needed
4. **Expand**: Consider adding more symbols or methods
5. **Document**: Keep notes on any issues or improvements

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Flow Overview                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Polygon API                                                │
│       ↓                                                      │
│  daily-update-job (1 AM EST)                                │
│       ↓                                                      │
│  minute_stock + minute_btc + baseline_daily                 │
│       ↓                                                      │
│  event-update-job (2 AM EST)                                │
│       ↓                                                      │
│  10 specialized event tables                                │
│       ↓                                                      │
│  Dashboard Reports                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Tables

1. **minute_stock**: Raw minute bars for 11 stocks
2. **minute_btc**: Raw minute bars for BTC
3. **baseline_daily**: Calculated baselines (5 methods × 2 sessions)
4. **trade_events_***: 10 specialized tables for different method/session combinations

### Processing Logic

1. **Baseline Calculation**: 5 methods (EQUAL_MEAN, VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN)
2. **Session Types**: RTH (Regular Trading Hours) and AH (After Hours)
3. **Signal Generation**: BUY when ratio ≥ threshold, SELL when ratio ≤ threshold
4. **Alternating Pattern**: Enforces BUY→SELL→BUY→SELL sequence

---

## 🔐 Security Notes

- **API Keys**: POLYGON_API_KEY stored in Cloud Run environment variables
- **Database**: Cloud SQL with private IP and SSL
- **Authentication**: Multi-user support with email/password
- **Repository**: Currently public for deployment, can be made private after

---

## 📈 Performance Metrics

### Current Performance
- **daily-update-job**: 2-3 minutes per day
- **event-update-job**: 2-3 minutes per day
- **Total daily processing**: 4-6 minutes
- **Data volume**: ~50,000 records per day

### Optimization Opportunities
- Batch inserts (already implemented)
- Indexed queries (already implemented)
- Parallel processing (future enhancement)
- Caching (future enhancement)

---

**Ready to deploy? Start with the Quick Start section above! 🚀**

---

*Last updated: October 29, 2024*  
*Version: 1.0*  
*Status: Ready for Deployment*