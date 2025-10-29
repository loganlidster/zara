# Manual Testing Guide - One Day at a Time

## Why Test Manually First?

Testing one day at a time allows us to:
1. Verify the logic works correctly for each day
2. Check that events are being logged properly
3. Ensure alternating pattern is maintained across days
4. Confirm reports show the new data
5. Catch any issues before automation

## Current State

**Last day with events:** October 23, 2025
**Days to test:** October 24, 25, 28 (skip weekend 26-27)

## Testing Process

### Day 1: October 24, 2025 (Thursday)

#### Step 1: Run the Job
```bash
gcloud run jobs execute event-update-job \
  --region=us-central1 \
  --update-env-vars=TARGET_DATE=2025-10-24 \
  --wait
```

**Expected output:**
- Processing messages for each symbol/method/session
- Progress updates every 100 combinations
- Summary showing events inserted
- Duration: ~2-3 minutes
- Exit code: 0

#### Step 2: Verify Events Were Inserted

**Check event counts:**
```sql
-- Check one table to see if events were added
SELECT 
  COUNT(*) as event_count,
  COUNT(DISTINCT symbol) as symbols,
  SUM(CASE WHEN event_type = 'BUY' THEN 1 ELSE 0 END) as buys,
  SUM(CASE WHEN event_type = 'SELL' THEN 1 ELSE 0 END) as sells
FROM trade_events_rth_equal_mean
WHERE event_date = '2025-10-24';
```

**Expected:**
- event_count > 0
- symbols = 11 (all symbols processed)
- buys and sells should be roughly equal (alternating pattern)

#### Step 3: Check Sample Events

**Look at events for one symbol:**
```sql
SELECT 
  symbol,
  buy_pct,
  sell_pct,
  event_time,
  event_type,
  stock_price,
  btc_price,
  ratio,
  baseline
FROM trade_events_rth_equal_mean
WHERE event_date = '2025-10-24'
  AND symbol = 'HIVE'
  AND buy_pct = 0.5
  AND sell_pct = 1.0
ORDER BY event_time;
```

**Verify:**
- Events alternate: BUY, SELL, BUY, SELL (or start with SELL if last event on 10/23 was BUY)
- Ratio values make sense (BTC price / Stock price)
- Baseline is from 10/23 (previous trading day)

#### Step 4: Test in Fast Daily Report

1. Go to https://raas.help
2. Open **Fast Daily** report
3. Select:
   - Symbol: HIVE
   - Method: EQUAL_MEAN
   - Session: RTH
   - Buy: 0.5%
   - Sell: 1.0%
   - Date range: Oct 23-24, 2025
4. Click "Run Simulation"

**Expected:**
- Should see events from both Oct 23 and Oct 24
- Events should alternate: BUY, SELL, BUY, SELL
- Wallet simulation should show cash/shares/portfolio value
- ROI should be calculated

#### Step 5: Verify Continuity

**Check last event from Oct 23:**
```sql
SELECT event_type, event_time
FROM trade_events_rth_equal_mean
WHERE event_date = '2025-10-23'
  AND symbol = 'HIVE'
  AND buy_pct = 0.5
  AND sell_pct = 1.0
ORDER BY event_time DESC
LIMIT 1;
```

**Check first event from Oct 24:**
```sql
SELECT event_type, event_time
FROM trade_events_rth_equal_mean
WHERE event_date = '2025-10-24'
  AND symbol = 'HIVE'
  AND buy_pct = 0.5
  AND sell_pct = 1.0
ORDER BY event_time ASC
LIMIT 1;
```

**Verify:**
- If Oct 23 ended with BUY → Oct 24 should start with SELL
- If Oct 23 ended with SELL → Oct 24 should start with BUY
- This confirms alternating pattern is maintained across days ✅

---

### Day 2: October 25, 2025 (Friday)

#### Step 1: Run the Job
```bash
gcloud run jobs execute event-update-job \
  --region=us-central1 \
  --update-env-vars=TARGET_DATE=2025-10-25 \
  --wait
```

#### Step 2: Verify Events
```sql
SELECT 
  COUNT(*) as event_count,
  COUNT(DISTINCT symbol) as symbols,
  SUM(CASE WHEN event_type = 'BUY' THEN 1 ELSE 0 END) as buys,
  SUM(CASE WHEN event_type = 'SELL' THEN 1 ELSE 0 END) as sells
FROM trade_events_rth_equal_mean
WHERE event_date = '2025-10-25';
```

#### Step 3: Test in Fast Daily Report
- Date range: Oct 24-25, 2025
- Verify events from both days appear
- Verify alternating pattern continues

#### Step 4: Verify Continuity
- Check last event from Oct 24
- Check first event from Oct 25
- Confirm alternating pattern maintained

---

### Day 3: October 28, 2025 (Monday)

**Note:** Weekend (Oct 26-27) is automatically skipped by trading_calendar

#### Step 1: Run the Job
```bash
gcloud run jobs execute event-update-job \
  --region=us-central1 \
  --update-env-vars=TARGET_DATE=2025-10-28 \
  --wait
```

#### Step 2: Verify Events
```sql
SELECT 
  COUNT(*) as event_count,
  COUNT(DISTINCT symbol) as symbols,
  SUM(CASE WHEN event_type = 'BUY' THEN 1 ELSE 0 END) as buys,
  SUM(CASE WHEN event_type = 'SELL' THEN 1 ELSE 0 END) as sells
FROM trade_events_rth_equal_mean
WHERE event_date = '2025-10-28';
```

#### Step 3: Verify Weekend Handling

**Check baseline used for Oct 28:**
```sql
SELECT 
  baseline,
  event_time
FROM trade_events_rth_equal_mean
WHERE event_date = '2025-10-28'
  AND symbol = 'HIVE'
  AND buy_pct = 0.5
  AND sell_pct = 1.0
ORDER BY event_time
LIMIT 1;
```

**Verify baseline is from Oct 25 (Friday):**
```sql
SELECT baseline
FROM baseline_daily
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND session = 'RTH'
  AND trading_day = '2025-10-25';
```

**Should match!** This confirms trading_calendar correctly skipped the weekend.

#### Step 4: Test in Fast Daily Report
- Date range: Oct 24-28, 2025
- Should see events from Oct 24, 25, and 28 (no 26-27)
- Verify alternating pattern continues from Friday to Monday

#### Step 5: Verify Continuity Across Weekend
- Check last event from Oct 25 (Friday)
- Check first event from Oct 28 (Monday)
- Confirm alternating pattern maintained across weekend

---

## Comprehensive Verification

After all three days are processed, run these checks:

### 1. Event Count Summary
```sql
SELECT 
  event_date,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols,
  COUNT(DISTINCT CONCAT(symbol, buy_pct, sell_pct)) as combinations,
  SUM(CASE WHEN event_type = 'BUY' THEN 1 ELSE 0 END) as buys,
  SUM(CASE WHEN event_type = 'SELL' THEN 1 ELSE 0 END) as sells
FROM trade_events_rth_equal_mean
WHERE event_date BETWEEN '2025-10-24' AND '2025-10-28'
GROUP BY event_date
ORDER BY event_date;
```

**Expected:**
- 3 rows (Oct 24, 25, 28)
- Each day has events for all 11 symbols
- Buys and sells roughly equal

### 2. Check All 10 Tables
```sql
SELECT 'trade_events_rth_equal_mean' as table_name, COUNT(*) as events 
FROM trade_events_rth_equal_mean WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_vwap_ratio', COUNT(*) 
FROM trade_events_rth_vwap_ratio WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_vol_weighted', COUNT(*) 
FROM trade_events_rth_vol_weighted WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_winsorized', COUNT(*) 
FROM trade_events_rth_winsorized WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_weighted_median', COUNT(*) 
FROM trade_events_rth_weighted_median WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_equal_mean', COUNT(*) 
FROM trade_events_ah_equal_mean WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_vwap_ratio', COUNT(*) 
FROM trade_events_ah_vwap_ratio WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_vol_weighted', COUNT(*) 
FROM trade_events_ah_vol_weighted WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_winsorized', COUNT(*) 
FROM trade_events_ah_winsorized WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_ah_weighted_median', COUNT(*) 
FROM trade_events_ah_weighted_median WHERE event_date >= '2025-10-24';
```

**Expected:**
- All 10 tables have events
- Counts should be similar (may vary slightly based on market activity)

### 3. Test All Reports

**Fast Daily:**
- Test multiple symbols
- Test different methods
- Test different sessions (RTH, AH, ALL)
- Verify date range Oct 24-28 works

**Best Performers:**
- Date range: Oct 24-28, 2025
- Should show results for all symbols
- Should rank by ROI correctly

**Daily Curve:**
- Select multiple symbols
- Date range: Oct 24-28, 2025
- Should show chart with 3 data points (24, 25, 28)

### 4. Verify No Duplicates
```sql
SELECT 
  symbol,
  buy_pct,
  sell_pct,
  event_date,
  event_time,
  COUNT(*) as occurrences
FROM trade_events_rth_equal_mean
WHERE event_date >= '2025-10-24'
GROUP BY symbol, buy_pct, sell_pct, event_date, event_time
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows (no duplicates)

---

## Troubleshooting

### If No Events Inserted

**Check minute data exists:**
```sql
SELECT COUNT(*) FROM minute_stock WHERE et_date = '2025-10-24';
SELECT COUNT(*) FROM minute_btc WHERE et_date = '2025-10-24';
```

**Check baselines exist:**
```sql
SELECT COUNT(*) FROM baseline_daily WHERE trading_day = '2025-10-23';
```

**Check trading calendar:**
```sql
SELECT * FROM trading_calendar WHERE cal_date = '2025-10-24';
```

### If Alternating Pattern Broken

**Check last event from previous day:**
```sql
SELECT * FROM trade_events_rth_equal_mean
WHERE symbol = 'HIVE' AND buy_pct = 0.5 AND sell_pct = 1.0
  AND event_date < '2025-10-24'
ORDER BY event_date DESC, event_time DESC
LIMIT 1;
```

**Check first event from current day:**
```sql
SELECT * FROM trade_events_rth_equal_mean
WHERE symbol = 'HIVE' AND buy_pct = 0.5 AND sell_pct = 1.0
  AND event_date = '2025-10-24'
ORDER BY event_time ASC
LIMIT 1;
```

### If Job Times Out

- Check Cloud Run logs
- Verify database connection
- Check if minute data is too large

---

## Success Criteria

After testing all three days, you should have:

✅ Events inserted for Oct 24, 25, 28 in all 10 tables
✅ Alternating BUY/SELL pattern maintained across days
✅ Weekend correctly skipped (no events for Oct 26-27)
✅ Baseline from previous trading day used correctly
✅ Fast Daily report shows all three days
✅ Best Performers report works with new data
✅ Daily Curve report shows chart with 3 points
✅ No duplicate events
✅ No errors in Cloud Run logs

---

## Next Steps After Successful Testing

Once all three days are verified:

1. **Set up Cloud Scheduler** for automatic daily runs
2. **Monitor for a week** to ensure automation works
3. **Verify reports daily** to catch any issues early
4. **Relax!** System runs automatically every night

---

## Quick Reference Commands

**Run for specific date:**
```bash
gcloud run jobs execute event-update-job \
  --region=us-central1 \
  --update-env-vars=TARGET_DATE=2025-10-24 \
  --wait
```

**Check event count:**
```sql
SELECT COUNT(*) FROM trade_events_rth_equal_mean WHERE event_date = '2025-10-24';
```

**View logs:**
```bash
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job' \
  --limit=50
```

**Check job status:**
```bash
gcloud run jobs describe event-update-job --region=us-central1
```

---

**Ready to start testing!** Begin with October 24, 2025. 🚀