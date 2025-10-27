# All Hours Mode Fix - Session-Specific Settings

## Problem Description
When using "All Hours (RTH + AH)" mode with different settings for RTH and AH sessions, the system was not applying the correct thresholds to each session. This resulted in:
- No trades appearing in pre-market hours (4:00 AM - 9:30 AM)
- No trades appearing in post-market hours (4:00 PM - 8:00 PM)
- Only RTH trades working correctly

## Root Cause
The `/api/simulate` endpoint was only accepting single `buyPct` and `sellPct` values, even when the frontend was sending separate:
- `rthMethod`, `rthBuyPct`, `rthSellPct` (for Regular Trading Hours)
- `ahMethod`, `ahBuyPct`, `ahSellPct` (for After Hours)

The backend was ignoring these session-specific parameters and using the wrong values for all bars.

## Solution
Modified `api-server/server.js` to:

1. **Accept session-specific parameters:**
```javascript
const {
  sessionMode,
  rthMethod, rthBuyPct, rthSellPct,
  ahMethod, ahBuyPct, ahSellPct,
  // ... other params
} = req.body;
```

2. **Extract session from each bar:**
```javascript
const { et_date, et_time, stock_close, btc_close, baseline, 
        current_ratio, prev_open_date, session: barSession } = bar;
```

3. **Apply correct thresholds based on session:**
```javascript
if (sessionMode === 'ALL') {
  if (barSession === 'RTH') {
    buyThreshold = baseline * (1 + rthBuyPct / 100);
    sellThreshold = baseline * (1 - rthSellPct / 100);
  } else if (barSession === 'AH') {
    buyThreshold = baseline * (1 + ahBuyPct / 100);
    sellThreshold = baseline * (1 - ahSellPct / 100);
  }
} else {
  // Single session mode
  buyThreshold = baseline * (1 + buyPct / 100);
  sellThreshold = baseline * (1 - sellPct / 100);
}
```

## How It Works Now

### Single Session Mode
- Uses single `method`, `buyPct`, `sellPct` values
- Works as before (backward compatible)

### All Hours Mode
- Uses separate settings for RTH and AH
- For each minute bar:
  - If bar is in RTH (9:30 AM - 4:00 PM): Uses RTH baseline + RTH thresholds
  - If bar is in AH (4:00 AM - 9:30 AM or 4:00 PM - 8:00 PM): Uses AH baseline + AH thresholds

## Testing
After deployment, verify:
1. Single session mode still works correctly
2. All Hours mode with same RTH/AH settings works
3. All Hours mode with different RTH/AH settings shows trades in all time periods:
   - Pre-market (4:00 AM - 9:30 AM)
   - Regular hours (9:30 AM - 4:00 PM)
   - Post-market (4:00 PM - 8:00 PM)

## Deployment
- **Commit:** cb24937
- **File Changed:** api-server/server.js
- **Status:** Pushed to GitHub, auto-deploying via Cloud Build
- **Expected Deploy Time:** 2-5 minutes

## Benefits
- Allows different trading strategies for different sessions
- More flexible parameter testing
- Better optimization for pre-market and post-market trading
- Maintains backward compatibility with existing single-session simulations