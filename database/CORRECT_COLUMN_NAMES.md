# Correct Column Names Reference

Based on the actual database schema from `SQL Table Design.csv`:

## minute_btc table
- ✅ `et_date` (NOT cal_date)
- ✅ `et_time` (NOT bar_time for the original time)
- ✅ `bar_time` (timestamp with time zone - full timestamp)
- ✅ `open`, `high`, `low`, `close` (NOT open_price, etc.)
- ✅ `volume`
- ✅ `session`

## minute_stock table
- ✅ `symbol`
- ✅ `et_date` (NOT cal_date)
- ✅ `et_time` (NOT bar_time for the original time)
- ✅ `bar_time` (timestamp with time zone - full timestamp)
- ✅ `open`, `high`, `low`, `close` (NOT open_price, etc.)
- ✅ `volume`
- ✅ `session`

## baseline_daily table
- ✅ `symbol`
- ✅ `session`
- ✅ `trading_day` (NOT cal_date or et_date)
- ✅ `method`
- ✅ `baseline`

## Key Differences from What We Used Before
1. Date column is `et_date` NOT `cal_date`
2. Time column is `et_time` NOT `bar_time` (bar_time is the full timestamp)
3. Price columns are `open`, `high`, `low`, `close` NOT `open_price`, etc.
4. Baseline table uses `trading_day` NOT `cal_date`

## Files Updated with Correct Names
- ✅ `populate_btc_aggregated.sql` - Fixed to use et_date, et_time, close, high, low
- ✅ `detect_patterns.sql` - Fixed to use correct column names
- ⏳ `populate_daily_btc_context.sql` - Needs update (next)