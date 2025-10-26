# 📊 Import Grant's Baseline Data - Step by Step

## Overview
Grant's baseline CSV has **session-aware baselines** (RTH and AH separate). Our database needs to be updated to support this.

## Files Provided
1. `baseline_daily2.csv` - Grant's baseline data (59,656 rows)
2. `IMPORT_BASELINES.sql` - Prepares database schema
3. This instruction file

## Step-by-Step Instructions

### Step 1: Prepare Database Schema
1. Open **Cloud SQL Editor** (console.cloud.google.com/sql)
2. Select database: `tradiac_testing`
3. Copy and paste contents of `IMPORT_BASELINES.sql`
4. Run the script
5. Verify "session" column was added

### Step 2: Import CSV Data
1. In Cloud SQL, go to **Import** tab
2. Click **Import**
3. Choose **Cloud Storage** or **Upload file**
4. Select `baseline_daily2.csv`
5. Configure import:
   - Format: **CSV**
   - Database: `tradiac_testing`
   - Table: `baseline_daily`
   - **IMPORTANT:** Check "First row is header"
6. Click **Import**

### Step 3: Verify Import
Run this query in Cloud SQL Editor:

```sql
-- Check total count
SELECT COUNT(*) as total_rows FROM baseline_daily;
-- Should be ~59,656

-- Check sessions
SELECT session, COUNT(*) as count
FROM baseline_daily
GROUP BY session;
-- Should show RTH and AH with similar counts

-- Verify against Grant's known value (2024-01-02, RTH, RIOT)
SELECT method, baseline
FROM baseline_daily
WHERE trading_day = '2024-01-02'
  AND session = 'RTH'
  AND symbol = 'RIOT'
ORDER BY method;
```

**Expected Results for RIOT 2024-01-02 RTH:**
- EQUAL_MEAN: 2840.627602246017
- MEDIAN: 2832.703842196401
- VOL_WEIGHTED: 2823.4080826827244
- WINSORIZED: 2842.0204050877223
- VWAP_RATIO: 2818.3473406249313

### Step 4: Update Processor to Use Sessions

Once baselines are imported, the nightly processor needs to:
1. Query RTH baselines for RTH hours (9:30 AM - 4:00 PM)
2. Query AH baselines for AH hours (4:00 AM - 9:30 AM, 4:00 PM - 8:00 PM)
3. Store trades in appropriate table (RTH or ALL)

## Alternative: Manual SQL Insert

If CSV import doesn't work, I can generate a SQL INSERT script. Let me know!

## Data Structure

**Grant's CSV Format:**
```
baseline_date,session,symbol,method,baseline,samples
2024-01-02,AH,BTDR,EQUAL_MEAN,4250.044690542639,206
2024-01-02,RTH,BTDR,EQUAL_MEAN,5088.374008179407,371
```

**Our Database Schema:**
```sql
CREATE TABLE baseline_daily (
    id SERIAL PRIMARY KEY,
    trading_day DATE NOT NULL,
    session VARCHAR(10) NOT NULL,  -- NEW COLUMN
    symbol VARCHAR(10) NOT NULL,
    method VARCHAR(20) NOT NULL,
    baseline NUMERIC(12,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trading_day, session, symbol, method)
);
```

## Next Steps After Import

1. ✅ Verify baselines match Grant's Python tool
2. ✅ Update processor to use session-aware baselines
3. ✅ Build dual pre-computed tables (RTH + ALL)
4. ✅ Test queries for speed
5. ✅ Deploy to production

---

**Grant:** Once you've imported the baselines, let me know and I'll update the processor to use them! 🚀