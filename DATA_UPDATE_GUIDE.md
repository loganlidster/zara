# Data Update Guide - RAAS Tracking System

## Current Status
- **Last Data Date**: October 23, 2025
- **Missing Dates**: October 24-28, 2025 (5 days)

## Data Update Process

### Step 1: Fetch Minute Data from Polygon.io

You'll need to run these queries to get the missing data:

#### A. Stock Minute Data
For each symbol (HIVE, RIOT, MARA, CLSK, BTDR, CORZ, HUT, CAN, CIFR, APLD, WULF):
```
GET https://api.polygon.io/v2/aggs/ticker/{SYMBOL}/range/1/minute/2025-10-24/2025-10-28?adjusted=true&sort=asc&limit=50000&apiKey=YOUR_API_KEY
```

Insert into `minute_stock` table:
```sql
INSERT INTO minute_stock (symbol, cal_date, bar_time, o, h, l, c, v, vw, n)
VALUES (...);
```

#### B. BTC Minute Data
```
GET https://api.polygon.io/v2/aggs/ticker/X:BTCUSD/range/1/minute/2025-10-24/2025-10-28?adjusted=true&sort=asc&limit=50000&apiKey=YOUR_API_KEY
```

Insert into `minute_btc` table:
```sql
INSERT INTO minute_btc (cal_date, bar_time, open, high, low, close, volume)
VALUES (...);
```

### Step 2: Calculate Baselines

Run baseline calculations for each missing date:

```sql
-- For each date (Oct 24-28) and each method (EQUAL_MEAN, VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN)
-- Run the baseline calculation stored procedure or script

-- Example for EQUAL_MEAN method:
INSERT INTO baseline_daily (symbol, method, session, cal_date, baseline)
SELECT 
  symbol,
  'EQUAL_MEAN' as method,
  'RTH' as session,
  '2025-10-24' as cal_date,
  AVG((o + h + l + c) / 4.0) as baseline
FROM minute_stock
WHERE cal_date = '2025-10-24'
  AND bar_time >= '09:30:00'
  AND bar_time < '16:00:00'
GROUP BY symbol;

-- Repeat for AH session and other methods
```

### Step 3: Process Events

Run the event-based processor for the missing dates:

```bash
cd processor
node process-single-group.js --symbol HIVE --method EQUAL_MEAN --startDate 2025-10-24 --endDate 2025-10-28
# Repeat for all 11 symbols × 5 methods = 55 combinations
```

Or use the parallel processor:
```bash
node run-parallel.js --startDate 2025-10-24 --endDate 2025-10-28
```

### Step 4: Verify Data

Check that data was inserted correctly:

```sql
-- Check minute data
SELECT COUNT(*) FROM minute_stock WHERE cal_date >= '2025-10-24' AND cal_date <= '2025-10-28';
SELECT COUNT(*) FROM minute_btc WHERE cal_date >= '2025-10-24' AND cal_date <= '2025-10-28';

-- Check baselines
SELECT COUNT(*) FROM baseline_daily WHERE cal_date >= '2025-10-24' AND cal_date <= '2025-10-28';

-- Check events (should have data in specialized tables)
SELECT COUNT(*) FROM trade_events_rth_equal_mean WHERE event_date >= '2025-10-24' AND event_date <= '2025-10-28';
```

## Automated Daily Updates (Future)

To automate this process, set up a Cloud Run Job or Cloud Scheduler to run daily at 1 AM EST:

1. **Fetch Data**: Pull previous day's minute data from Polygon.io
2. **Calculate Baselines**: Run baseline calculations
3. **Process Events**: Run event processor for the new date
4. **Verify**: Check data integrity

## Quick Manual Update (If You Have Access)

If you have access to the Google Cloud Console:

1. Go to Cloud SQL instance
2. Connect to the database
3. Run the SQL scripts to insert minute data
4. Run baseline calculations
5. Run event processor

## Files Needed for Updates

- `processor/process-single-group.js` - Event processor
- `processor/run-parallel.js` - Parallel event processor
- `database/calculate_baselines.sql` - Baseline calculation script (if exists)

## Notes

- The event-based system processes data continuously (positions carry overnight)
- Each symbol+method combination needs to be processed as a continuous stream
- Don't process dates out of order - always process chronologically
- The specialized tables (trade_events_rth_*, trade_events_ah_*) store the final results

## Contact

If you need help with the data update process, the scripts are in the `processor/` directory and can be run from your local machine or Cloud Run.