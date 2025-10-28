# Pattern Analysis System - Setup Instructions

## Quick Start (3-5 minutes)

### What You'll Do
Run 4 SQL scripts in Cloud SQL to set up the Pattern Analysis System. This will detect 6 types of BTC patterns from your historical data (Jan 2024 - Oct 2025).

### The 6 Patterns
1. **CRASH** - BTC drops 3%+ in 72 hours
2. **SURGE** - BTC rises 5%+ in 24 hours  
3. **MONDAY_GAP** - Weekend moves (1%+ gap)
4. **HIGH_VOL** - 30-day volatility > 4%
5. **LOW_VOL** - 30-day volatility < 2%
6. **RECORD_HIGH_DROP** ⭐ - Your special pattern (overreaction detection)

---

## Step-by-Step Instructions

### Step 1: Open Cloud SQL Console
1. Go to Google Cloud Console
2. Navigate to SQL → tradiac-testing database
3. Click "Query" or "Open Cloud Shell"

### Step 2: Run Script 1 - Create Tables (5 seconds)
**File:** `database/create_pattern_analysis_tables.sql`

**What it does:** Creates 4 new tables for pattern analysis

**Copy the entire file and paste into Cloud SQL Query Editor, then click "Run"**

**Expected output:**
```
Query completed successfully
```

---

### Step 3: Run Script 2 - Populate BTC Aggregated (30-60 seconds)
**File:** `database/populate_btc_aggregated.sql`

**What it does:** Aggregates 1-minute BTC data into 10-minute bars (90% data reduction)

**Copy the entire file and paste into Cloud SQL Query Editor, then click "Run"**

**Expected output:**
```
total_bars | first_date  | last_date   | unique_days | avg_bars_per_day
-----------+-------------+-------------+-------------+-----------------
~25000     | 2024-01-01  | 2025-10-XX  | ~650        | 144.00
```

---

### Step 4: Run Script 3 - Calculate Daily Context (60-90 seconds)
**File:** `database/populate_daily_btc_context.sql`

**What it does:** Calculates daily metrics (volatility, trends, record highs, gaps)

**Copy the entire file and paste into Cloud SQL Query Editor, then click "Run"**

**Expected output:**
```
total_days | first_date  | last_date   | record_high_days | monday_count | avg_30d_volatility
-----------+-------------+-------------+------------------+--------------+-------------------
~650       | 2024-01-01  | 2025-10-XX  | 10-20           | ~90          | 2.5-3.5
```

---

### Step 5: Run Script 4 - Detect Patterns (30-60 seconds)
**File:** `database/detect_patterns.sql`

**What it does:** Detects all 6 pattern types from the data

**Copy the entire file and paste into Cloud SQL Query Editor, then click "Run"**

**Expected output:**
```
pattern_type        | instance_count | avg_change_pct | first_occurrence | last_occurrence
--------------------+----------------+----------------+------------------+-----------------
HIGH_VOL           | 150-200        | varies         | 2024-01-XX       | 2025-10-XX
MONDAY_GAP         | 80-100         | varies         | 2024-01-XX       | 2025-10-XX
SURGE              | 30-50          | 7 to 12        | 2024-01-XX       | 2025-10-XX
CRASH              | 20-40          | -5 to -10      | 2024-01-XX       | 2025-10-XX
RECORD_HIGH_DROP   | 10-20          | -3 to -8       | 2024-01-XX       | 2025-10-XX
LOW_VOL            | 50-80          | varies         | 2024-01-XX       | 2025-10-XX
```

---

### Step 6: Verify Setup (Optional but Recommended)
**File:** `database/verify_pattern_setup.sql`

**What it does:** Runs comprehensive checks to verify everything worked

**Copy the entire file and paste into Cloud SQL Query Editor, then click "Run"**

**Expected output:** Multiple sections showing:
- Table row counts (all ✓ PASS)
- Pattern summary
- Sample patterns
- Record high drops (your special pattern!)
- Success indicators

---

## What to Report Back

After running all scripts, please share:

1. **Pattern counts** from Step 5 output:
   - How many CRASH patterns?
   - How many SURGE patterns?
   - How many RECORD_HIGH_DROP patterns?
   - Total patterns detected?

2. **Any errors or warnings?**

3. **Verification results** (if you ran Step 6):
   - Did all checks show ✓ PASS?

---

## Troubleshooting

### Script is taking longer than expected
- **This is normal for first run**
- Step 2 aggregates 1.5M+ minute bars
- Step 3 calculates rolling metrics for 650 days
- Just wait, it will complete

### Script shows an error
- **Check that previous steps completed successfully**
- Scripts must be run in order (1 → 2 → 3 → 4)
- If you need to start over, see "Starting Over" below

### No patterns detected (count = 0)
- Verify Step 2 completed: `SELECT COUNT(*) FROM btc_aggregated;` (should be ~25,000)
- Verify Step 3 completed: `SELECT COUNT(*) FROM daily_btc_context;` (should be ~650)
- Check date range: `SELECT MIN(bar_date), MAX(bar_date) FROM btc_aggregated;`

### Starting Over
If you need to start fresh:
```sql
DROP TABLE IF EXISTS pattern_performance CASCADE;
DROP TABLE IF EXISTS btc_patterns CASCADE;
DROP TABLE IF EXISTS daily_btc_context CASCADE;
DROP TABLE IF EXISTS btc_aggregated CASCADE;
```
Then run Steps 2-5 again.

---

## What Happens Next

### After You Complete Setup:

**Phase 2: I Build API Endpoints (2-3 hours)**
- `/api/patterns/summary` - Overview of all patterns
- `/api/patterns/instances` - Get specific pattern instances  
- `/api/patterns/overreactions` - Record high drops ranked
- And more...

**Phase 3: I Build Dashboard Reports (3-4 hours)**
- Pattern Overview report
- Pattern Deep Dive report
- Overreaction Analysis report (your special pattern!)

**Phase 4: We Analyze Results Together**
- Which patterns occur most?
- Which strategies win during each pattern?
- How big are the overreactions?
- Which stocks overreact the most?

---

## Expected Results

After setup completes, you should have:
- **~25,000 rows** in btc_aggregated (10-min bars)
- **~650 rows** in daily_btc_context (daily metrics)
- **350-500 rows** in btc_patterns (pattern instances)
- **0 rows** in pattern_performance (populated later)

Pattern breakdown:
- HIGH_VOL: 150-200 instances
- MONDAY_GAP: 80-100 instances
- SURGE: 30-50 instances
- CRASH: 20-40 instances
- LOW_VOL: 50-80 instances
- RECORD_HIGH_DROP: 10-20 instances ⭐

---

## Files Reference

All files are in the `database/` folder:

1. `create_pattern_analysis_tables.sql` - Creates tables
2. `populate_btc_aggregated.sql` - Aggregates BTC data
3. `populate_daily_btc_context.sql` - Calculates daily metrics
4. `detect_patterns.sql` - Detects patterns
5. `verify_pattern_setup.sql` - Verification queries

Documentation:
- `PATTERN_ANALYSIS_SETUP.md` - Detailed setup guide
- `RUN_PATTERN_SETUP.md` - Quick reference
- `PATTERN_ANALYSIS_SYSTEM.md` - Complete system overview
- `PATTERN_ANALYSIS_READY.md` - What we've built
- `SETUP_INSTRUCTIONS.md` - This file

---

## Ready to Start?

1. ✅ Open Cloud SQL Console
2. ✅ Run Script 1 (create tables)
3. ✅ Run Script 2 (aggregate BTC data)
4. ✅ Run Script 3 (calculate daily context)
5. ✅ Run Script 4 (detect patterns)
6. ✅ Run Script 5 (verify - optional)
7. ✅ Report back the results!

**Total time: 3-5 minutes**

Let's find those patterns! 🚀