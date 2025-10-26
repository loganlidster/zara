# ☀️ MORNING DEPLOYMENT GUIDE - START HERE WHEN YOU RETURN

## 🎯 MISSION: Fix simulator and verify accuracy

---

## ✅ STEP 1: Import Trading Calendar (10 minutes)

**In PowerShell, connect to database:**

```powershell
psql "host=34.41.97.179 port=5432 dbname=tradiac_testing user=postgres sslmode=require"
```

Password: `Fu3lth3j3t!`

---

**At the `tradiac_testing=>` prompt, run these commands:**

```sql
-- Create trading calendar table
CREATE TABLE trading_calendar (
    cal_date DATE PRIMARY KEY,
    day_of_week VARCHAR(10) NOT NULL,
    is_open BOOLEAN NOT NULL,
    session_open_et TIME,
    session_close_et TIME,
    prev_open_date DATE,
    next_open_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_calendar_date ON trading_calendar(cal_date);
CREATE INDEX idx_calendar_prev ON trading_calendar(prev_open_date);
CREATE INDEX idx_calendar_is_open ON trading_calendar(is_open);
```

---

**Now import the CSV file:**

You'll need to use the `\copy` command. First, make sure the CSV file is accessible.

**Option A: If the CSV is on your local machine:**

Exit psql (`\q`), then run this from PowerShell:

```powershell
# Navigate to where the CSV is
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing

# Use psql with copy command
psql "host=34.41.97.179 port=5432 dbname=tradiac_testing user=postgres sslmode=require" -c "\copy trading_calendar(cal_date, day_of_week, is_open, session_open_et, session_close_et, prev_open_date, next_open_date, notes, created_at, updated_at) FROM 'studio_results_20251024_0333.csv' WITH (FORMAT csv, HEADER true)"
```

**Note:** You'll need to download the CSV file from the workspace first. Let me know if you need help with that.

---

**Verify the import:**

```powershell
psql "host=34.41.97.179 port=5432 dbname=tradiac_testing user=postgres sslmode=require"
```

```sql
-- Check row count
SELECT COUNT(*) FROM trading_calendar;
-- Should be ~1,828 rows

-- Test Monday lookup
SELECT cal_date, day_of_week, prev_open_date 
FROM trading_calendar 
WHERE cal_date = '2025-10-20';
-- Should show: prev_open_date = '2025-10-17' (Friday)

-- Test after holiday
SELECT cal_date, day_of_week, prev_open_date, notes
FROM trading_calendar 
WHERE notes LIKE '%Holiday%'
LIMIT 5;

\q
```

---

## ✅ STEP 2: Fix Simulator Baseline Lookup (20 minutes)

**Open this file:**
```
C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing\simulation-engine\src\core\simulator.js
```

**Find this section (around line 27-40):**

```javascript
const query = `
    SELECT 
      s.et_date,
      s.et_time,
      s.bar_time,
      s.close as stock_close,
      b.close as btc_close,
      bl.baseline,
      s.session,
      (b.close / NULLIF(s.close, 0)) as current_ratio
    FROM minute_stock s
    INNER JOIN minute_btc b ON s.bar_time = b.bar_time
    INNER JOIN baseline_daily bl ON 
      bl.symbol = s.symbol 
      AND bl.trading_day = s.et_date 
      AND bl.session = s.session
      AND bl.method = $1
```

**Replace with this FIXED version:**

```javascript
const query = `
    SELECT 
      s.et_date,
      s.et_time,
      s.bar_time,
      s.close as stock_close,
      b.close as btc_close,
      bl.baseline,
      s.session,
      tc.prev_open_date,
      (b.close / NULLIF(s.close, 0)) as current_ratio
    FROM minute_stock s
    INNER JOIN minute_btc b ON s.bar_time = b.bar_time
    INNER JOIN trading_calendar tc ON s.et_date = tc.cal_date
    INNER JOIN baseline_daily bl ON 
      bl.symbol = s.symbol 
      AND bl.trading_day = tc.prev_open_date
      AND bl.session = s.session
      AND bl.method = $1
```

**Key change:** `bl.trading_day = tc.prev_open_date` (uses previous trading day!)

**Save the file.**

---

## ✅ STEP 3: Test Against Known Results (15 minutes)

**Run this simulation (from your CSV - BTDR on 2025-09-24):**

```powershell
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing\simulation-engine
$env:DB_NAME="tradiac_testing"
node src/index.js BTDR 2025-09-24 2025-09-24 EQUAL_MEAN 0.5 1.1 RTH 10000
```

**Expected results (from your CSV):**
- Day Return: 10.53%
- Trades: 6
- Baseline: 6481.94

**If results match → ✅ Simulator is accurate!**
**If results don't match → We'll debug together**

---

## ✅ STEP 4: Check Data Load Progress

**In your first PowerShell window, check if the data load finished:**

If it's still running, let it finish.

If it finished, verify:

```powershell
psql "host=34.41.97.179 port=5432 dbname=tradiac_testing user=postgres sslmode=require"
```

```sql
SELECT COUNT(*) as btc_bars, MIN(et_date) as first_date, MAX(et_date) as last_date FROM minute_btc;
```

**Expected:** ~700K+ BTC bars from Sept 2023 to Oct 2025

```sql
\q
```

---

## 🎯 SUCCESS CRITERIA

After these 4 steps, you should have:
- ✅ Trading calendar imported (1,828 days)
- ✅ Simulator using correct baseline lookup
- ✅ Test simulation matching known results
- ✅ 2+ years of historical data loaded

**Then we're ready to build the batch runner and run 81,000 simulations!** 🚀

---

## 📞 WHEN YOU'RE READY

Just tell me:
- ✅ "Calendar imported"
- ✅ "Simulator fixed"
- ✅ "Test passed" (or "Test failed - here are the results")
- ✅ "Data load complete"

Then I'll give you the batch runner code! 🔥

---

**Welcome back! Let's finish this! 💪**