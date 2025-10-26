# 🚀 STEP-BY-STEP DEPLOYMENT GUIDE

## ✅ STEP 1: Import Trading Calendar (10 minutes)

### Option A: Using the Node.js Script (Recommended)

**1. Open PowerShell and navigate to your project:**
```powershell
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing
```

**2. Download the files from this workspace:**
- `import_calendar.js`
- `import_calendar.sql`
- `studio_results_20251024_0333.csv` (already have this)

**3. Install dependencies:**
```powershell
npm install pg
```

**4. Run the import:**
```powershell
node import_calendar.js
```

**Expected output:**
```
Connecting to database...
Connected successfully!

Creating trading_calendar table...
Table created successfully!

Reading CSV file...
Found 1828 rows to import

Imported 1828 rows...

Import complete!
- Imported: 1828 rows
- Skipped: 0 rows

Verifying import...
Total rows in table: 1828

Testing Monday lookup (2025-10-20):
Result: { cal_date: 2025-10-20, day_of_week: 'Monday', prev_open_date: 2025-10-17 }
Expected prev_open_date: 2025-10-17 (Friday)

✅ Trading calendar import complete!
```

### Option B: Using psql Directly

**1. Connect to database:**
```powershell
psql "host=34.41.97.179 port=5432 dbname=tradiac_testing user=postgres sslmode=require"
```
Password: `Fu3lth3j3t!`

**2. Create table:**
```sql
CREATE TABLE IF NOT EXISTS trading_calendar (
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

CREATE INDEX IF NOT EXISTS idx_calendar_date ON trading_calendar(cal_date);
CREATE INDEX IF NOT EXISTS idx_calendar_prev ON trading_calendar(prev_open_date);
CREATE INDEX IF NOT EXISTS idx_calendar_is_open ON trading_calendar(is_open);
```

**3. Import CSV:**
```sql
\copy trading_calendar(cal_date, day_of_week, is_open, session_open_et, session_close_et, prev_open_date, next_open_date, notes) FROM 'studio_results_20251024_0333.csv' WITH (FORMAT csv, HEADER true);
```

**4. Verify:**
```sql
SELECT COUNT(*) FROM trading_calendar;
-- Should return 1828

SELECT cal_date, day_of_week, prev_open_date 
FROM trading_calendar 
WHERE cal_date = '2025-10-20';
-- Should show prev_open_date = 2025-10-17

\q
```

---

## ✅ STEP 2: Deploy Fixed Simulator (5 minutes)

**1. Download the simulation-engine folder from this workspace**

The folder structure should be:
```
simulation-engine/
├── .env
├── package.json
└── src/
    ├── index.js
    └── core/
        └── simulator.js
```

**2. Navigate to the folder:**
```powershell
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing\simulation-engine
```

**3. Install dependencies:**
```powershell
npm install
```

---

## ✅ STEP 3: Test Against Known Results (10 minutes)

**Run the test simulation:**
```powershell
node src/index.js BTDR 2025-09-24 2025-09-24 EQUAL_MEAN 0.5 1.1 RTH 10000
```

**Expected Results (from your CSV):**
- **Day Return:** 10.53%
- **Trades:** 6
- **Baseline:** 6481.94 (from previous trading day)

**What to look for:**
1. The simulator should show it's using `prev_open_date` for baseline lookup
2. Each trade should show the `prev_baseline_date` field
3. The final return should match 10.53% (or very close)
4. Should have 6 trades total

**If results match:** ✅ Simulator is accurate!

**If results don't match:** 
- Check the trade log to see which trades are different
- Verify the baseline values being used
- Check if the dates align correctly

---

## ✅ STEP 4: Verify Data Coverage (5 minutes)

**Connect to database:**
```powershell
psql "host=34.41.97.179 port=5432 dbname=tradiac_testing user=postgres sslmode=require"
```

**Check data coverage:**
```sql
-- Check BTC data
SELECT 
  COUNT(*) as total_bars,
  MIN(et_date) as first_date,
  MAX(et_date) as last_date,
  COUNT(DISTINCT et_date) as trading_days
FROM minute_btc;

-- Check stock data
SELECT 
  symbol,
  COUNT(*) as bars,
  MIN(et_date) as first_date,
  MAX(et_date) as last_date
FROM minute_stock
GROUP BY symbol
ORDER BY symbol;

-- Check baselines
SELECT 
  symbol,
  method,
  COUNT(*) as days,
  MIN(trading_day) as first_day,
  MAX(trading_day) as last_day
FROM baseline_daily
GROUP BY symbol, method
ORDER BY symbol, method;

-- Check trading calendar
SELECT COUNT(*) FROM trading_calendar;

\q
```

**Expected:**
- BTC: ~700K+ bars from Sept 2023 to Oct 2025
- Each stock: ~70K+ bars each
- Baselines: ~4,400 rows (9 stocks × 5 methods × ~98 days)
- Calendar: 1,828 days

---

## 🎯 SUCCESS CRITERIA

After completing these steps, you should have:

- ✅ Trading calendar imported (1,828 days)
- ✅ Simulator using correct baseline lookup (prev_open_date)
- ✅ Test simulation matching known results (10.53% return, 6 trades)
- ✅ 2+ years of historical data loaded and verified

---

## 🔥 NEXT STEPS (After Verification)

Once all tests pass, we'll build:

1. **Batch Grid Search Runner** - Test 81,000+ combinations
2. **Performance Optimization** - Pre-compute common scenarios
3. **Web UI** - React dashboard for visualization
4. **Advanced Analytics** - Correlation metrics, regime detection

---

## 📞 TROUBLESHOOTING

### Issue: Cannot connect to database
**Solution:** Make sure you're on an authorized network or use Cloud SQL Proxy

### Issue: Import script fails
**Solution:** Check that the CSV file path is correct and the file is accessible

### Issue: Test results don't match
**Solution:** 
1. Verify trading calendar was imported correctly
2. Check that baseline_daily table has data for the test date
3. Verify the prev_open_date is correct for 2025-09-24

### Issue: Missing data for test date
**Solution:** The data pipeline may need to run longer to fetch all historical data

---

## 💡 TIPS

- Run the test simulation multiple times with different parameters to verify consistency
- Check the trade log output to understand the simulator's decision-making
- Compare the baseline values with your original Python tool
- Verify that the `prev_baseline_date` field shows the correct previous trading day

---

**Ready to proceed? Let me know when you've completed these steps!** 🚀