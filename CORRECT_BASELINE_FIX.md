# Correct Baseline Fix Using Trading Calendar

## Understanding the System

After reviewing the Python script, I now understand the correct logic:

### How It Works (Python Script)
1. For trading day `d`, get the previous `n` trading days
2. Calculate baseline from those previous days' data
3. Use that baseline to trade on day `d`

**Example with lookback_n=1:**
- Trading on 9/24: Use 9/23's data to calculate baseline → Trade on 9/24
- Trading on 9/25: Use 9/24's data to calculate baseline → Trade on 9/25

### Database Schema
We have a `trading_calendar` table with:
- `cal_date` - The calendar date
- `is_open` - Whether market is open
- `prev_open_date` - The previous trading day
- `next_open_date` - The next trading day

## The Correct Fix

We need to use the `trading_calendar` to get the previous trading day's baseline:

```sql
-- Get baseline for the PREVIOUS trading day
SELECT b.session, b.baseline
FROM trading_calendar tc
JOIN baseline_daily b ON b.trading_day = tc.prev_open_date
WHERE tc.cal_date = $1  -- Current trading day
  AND b.symbol = $2
  AND b.method = $3
```

This ensures we:
1. Get the correct previous TRADING day (skips weekends/holidays)
2. Use that day's baseline for today's trades
3. Match the Python script's logic exactly

## Files to Update

1. `api-server/fast-daily-endpoint.js` - API endpoint
2. `processor/nightly-processor-dual.js` - Batch processor

Both need to join with `trading_calendar` to get `prev_open_date`.