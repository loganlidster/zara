# Best Performers ROI Calculation Bug

## Problem Summary
Best Performers report shows **8.65% ROI** while Fast Daily shows **46.18% ROI** for the same parameters (HIVE, EQUAL_MEAN, RTH, 2.9% buy, 0.7% sell, 9/1-9/22/2025).

## Root Cause

### Current (Incorrect) Calculation
```sql
COALESCE(SUM(trade_roi_pct), 0) as roi_pct
```

This simply **sums individual trade ROI percentages**, which is mathematically wrong.

### Example with Real Data

**7 Events in Database:**
1. 09/02 13:31 - BUY @ $2.81
2. 09/16 13:30 - BUY @ $3.84 (consecutive BUY - invalid!)
3. 09/17 13:54 - SELL @ $3.91 (trade_roi: 1.76%)
4. 09/19 13:59 - SELL @ $3.90 (trade_roi: 1.95%) (consecutive SELL - invalid!)
5. 09/22 13:00 - SELL @ $3.72 (trade_roi: -0.26%) (consecutive SELL - invalid!)
6. 09/22 13:32 - BUY @ $3.56
7. 09/22 13:59 - SELL @ $3.74 (trade_roi: 5.20%)

**Best Performers Calculation (Wrong):**
```
ROI = 1.76% + 1.95% + (-0.26%) + 5.20% = 8.65%
```
- ❌ Sums all trade_roi_pct values
- ❌ Includes invalid consecutive events
- ❌ Doesn't account for compounding
- ❌ Doesn't simulate actual wallet

**Fast Daily Calculation (Correct):**
```
Filter to alternating BUY/SELL:
1. BUY @ $2.81 → 3558 shares, $1.66 cash
3. SELL @ $3.91 → $13,895.65 (38.96% gain)
6. BUY @ $3.56 → 3908 shares, $2.71 cash
7. SELL @ $3.74 → $14,618.24 (46.18% total ROI)
```
- ✅ Filters to alternating events
- ✅ Simulates actual wallet
- ✅ Calculates true portfolio ROI
- ✅ Accounts for compounding

## Why Summing Trade ROI is Wrong

### Mathematical Proof
If you have two trades:
- Trade 1: +10% on $10,000 = $11,000
- Trade 2: +10% on $11,000 = $12,100

**Correct total ROI:** ($12,100 - $10,000) / $10,000 = **21%**

**Summing individual ROIs:** 10% + 10% = **20%** ❌ WRONG!

The difference is compounding. Each trade builds on the previous equity, not the initial capital.

## Additional Issues

### 1. Consecutive Events
The database contains consecutive BUY or SELL events (events 2, 4, 5 above). These should be filtered out because:
- You can't buy if you already have shares
- You can't sell if you have no shares
- They represent invalid trading states

### 2. Trade ROI vs Portfolio ROI
- **trade_roi_pct**: Gain/loss on a single trade (SELL event only)
- **Portfolio ROI**: Total gain/loss from initial capital to final equity

These are different metrics. Best Performers should show **Portfolio ROI**, not sum of trade ROIs.

## Solution Options

### Option 1: Fix Best Performers to Match Fast Daily (Recommended)
Change Best Performers to calculate true portfolio ROI by:
1. Fetching all events for each combination
2. Filtering to alternating BUY/SELL events
3. Simulating wallet (cash + shares)
4. Calculating final equity vs initial capital

**Pros:**
- ✅ Mathematically correct
- ✅ Matches Fast Daily
- ✅ Shows true portfolio performance

**Cons:**
- ⚠️ More complex query (can't use simple SUM)
- ⚠️ Slower (needs to process events in order)

### Option 2: Add Wallet Simulation to Event Processor
When generating events, also calculate and store cumulative portfolio ROI:
1. Add `portfolio_roi_pct` column to trade_events tables
2. Calculate during event processing
3. Use MAX(portfolio_roi_pct) in Best Performers query

**Pros:**
- ✅ Fast queries (just MAX, no simulation needed)
- ✅ Mathematically correct
- ✅ Precomputed during nightly processing

**Cons:**
- ⚠️ Requires reprocessing all historical data
- ⚠️ More storage (new column)

### Option 3: Create Materialized View
Create a summary table with precomputed portfolio ROI for each combination:
```sql
CREATE TABLE combination_summary (
  symbol VARCHAR,
  method VARCHAR,
  session VARCHAR,
  buy_pct NUMERIC,
  sell_pct NUMERIC,
  start_date DATE,
  end_date DATE,
  portfolio_roi_pct NUMERIC,
  total_trades INT,
  ...
)
```

**Pros:**
- ✅ Extremely fast queries
- ✅ Can aggregate by any date range
- ✅ Mathematically correct

**Cons:**
- ⚠️ Requires nightly updates
- ⚠️ More storage
- ⚠️ Complex to maintain

## Recommended Fix: Option 1 (Short Term)

For immediate fix, update Best Performers API to:

1. **Fetch events** for each combination
2. **Filter to alternating BUY/SELL** events
3. **Simulate wallet** day-by-day
4. **Calculate true portfolio ROI**

This matches Fast Daily's logic and gives correct results.

## Long-Term Solution: Option 2

Add `portfolio_roi_pct` to event processor:
- Calculate cumulative ROI during event generation
- Store in database
- Use in Best Performers queries
- Fast and accurate

## Impact

This bug affects:
- ✅ Best Performers report (shows wrong ROI)
- ✅ Any analysis based on Best Performers data
- ❌ Fast Daily report (correct - uses wallet simulation)
- ❌ Raw event data (correct - individual trade ROIs are accurate)

## Next Steps

1. Decide on solution approach
2. Implement fix
3. Test with known data
4. Verify Fast Daily and Best Performers match
5. Document correct ROI calculation methodology