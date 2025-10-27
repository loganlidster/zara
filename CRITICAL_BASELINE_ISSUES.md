# CRITICAL: Baseline Data Corruption

## Multiple Critical Issues Discovered

### Issue 1: Wrong Baseline Dates (Off by 1 day)
- 9/24 trades use 9/23's baseline
- 9/25 trades use 9/24's baseline
- **Impact**: All trades trigger at wrong times

### Issue 2: Completely Wrong Baseline Values
**HIVE Example:**
- Expected 9/24: 28,616.78
- Actual in DB: 29,520.68 (9/23's value)
- Expected 9/25: 30,059.78
- Actual in DB: 28,616.78 (9/24's value)

**RIOT Example:**
- Baseline showing: 6,160.31
- This makes NO SENSE for either:
  - BTC price (should be ~28,000-30,000)
  - RIOT stock price (should be ~17.29)

### Issue 3: CORS Error Blocking Batch Grid Search
- Frontend: `https://tradiac-testing-66f6e.web.app`
- API: `https://tradiac-api-941257247637.us-central1.run.app`
- Error: "No 'Access-Control-Allow-Origin' header"
- **Impact**: Batch simulations completely broken

## Root Cause Analysis

The baseline calculation or storage is fundamentally broken. Possible causes:

1. **Date Offset Bug**: Baselines calculated for day N are stored as day N-1
2. **Wrong Calculation Method**: The EQUAL_MEAN calculation is incorrect
3. **Data Corruption**: The baseline_daily table has corrupted data
4. **Symbol Mix-up**: Baselines from wrong symbols being used

## Immediate Actions Needed

### 1. Verify Database Content
Run this query to see what's actually stored:
```sql
SELECT trading_day, symbol, method, session, baseline, prev_baseline_date
FROM baseline_daily
WHERE symbol IN ('HIVE', 'RIOT')
  AND method = 'EQUAL_MEAN'
  AND session = 'RTH'
  AND trading_day BETWEEN '2025-09-23' AND '2025-09-25'
ORDER BY symbol, trading_day;
```

### 2. Check Baseline Calculation Logic
Review `processor/nightly-processor-dual.js`:
- How is the baseline calculated for EQUAL_MEAN?
- What date is used when storing the baseline?
- Is there a date offset bug?

### 3. Fix CORS Issue
The deployed API needs to be redeployed with CORS fix:
```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://tradiac-testing-66f6e.web.app',
    'https://tradiac-testing-66f6e.firebaseapp.com'
  ],
  credentials: true
}));
```

### 4. Recalculate All Baselines
Once the bugs are fixed:
- Drop and recreate baseline_daily table
- Re-run nightly processor for all historical dates
- Verify baselines match expected values

## Expected Baseline Values (from your data)

**HIVE RTH:**
- 9/24: 28,616.780459
- 9/25: 30,059.776703

**Buy/Sell Thresholds (0.5% buy, 1% sell):**
- 9/24 Buy: 28,759.08
- 9/24 Sell: 28,329.84
- 9/25 Buy: 30,217.25
- 9/25 Sell: 29,766.25

## Impact

**ALL SIMULATIONS ARE CURRENTLY INVALID** due to:
1. Wrong baseline dates
2. Corrupted baseline values
3. Batch grid search not working

This explains why you're getting -4.07% instead of +4.6% ROI!