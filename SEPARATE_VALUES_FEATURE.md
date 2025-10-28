# Separate RTH/AH Values Feature

## Overview
Added support for using different buy/sell percentage thresholds for Regular Trading Hours (RTH) and After Hours (AH) sessions. This allows more sophisticated trading strategies that adapt to different market conditions.

## API Changes

### New Endpoint Behavior

#### For Single Session (RTH or AH)
**No changes** - works exactly as before:
```
GET /api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-09-01&endDate=2024-09-30
```

#### For Combined Sessions (ALL)
**NEW** - accepts separate values for each session:
```
GET /api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=ALL&rthBuyPct=0.5&rthSellPct=0.5&ahBuyPct=1.0&ahSellPct=1.0&startDate=2024-09-01&endDate=2024-09-30
```

### Parameters

#### Single Session (RTH or AH)
- `symbol` - Stock symbol (required)
- `method` - Baseline method (required)
- `session` - 'RTH' or 'AH' (required)
- `buyPct` - Buy percentage threshold (required)
- `sellPct` - Sell percentage threshold (required)
- `startDate` - Start date (required)
- `endDate` - End date (required)

#### Combined Session (ALL)
- `symbol` - Stock symbol (required)
- `method` - Baseline method (required)
- `session` - 'ALL' (required)
- `rthBuyPct` - RTH buy percentage threshold (required)
- `rthSellPct` - RTH sell percentage threshold (required)
- `ahBuyPct` - AH buy percentage threshold (required)
- `ahSellPct` - AH sell percentage threshold (required)
- `startDate` - Start date (required)
- `endDate` - End date (required)

### Response Format

#### Single Session Response
```json
{
  "success": true,
  "symbol": "HIVE",
  "method": "EQUAL_MEAN",
  "session": "RTH",
  "buyPct": 0.5,
  "sellPct": 0.5,
  "dateRange": {
    "startDate": "2024-09-01",
    "endDate": "2024-09-30"
  },
  "eventCount": 37,
  "tablesQueried": ["trade_events_rth_equal_mean"],
  "events": [...]
}
```

#### Combined Session Response
```json
{
  "success": true,
  "symbol": "HIVE",
  "method": "EQUAL_MEAN",
  "session": "ALL",
  "rthBuyPct": 0.5,
  "rthSellPct": 0.5,
  "ahBuyPct": 1.0,
  "ahSellPct": 1.0,
  "dateRange": {
    "startDate": "2024-09-01",
    "endDate": "2024-09-30"
  },
  "eventCount": 89,
  "rthEventCount": 37,
  "ahEventCount": 52,
  "tablesQueried": [
    "trade_events_rth_equal_mean",
    "trade_events_ah_equal_mean"
  ],
  "events": [...]
}
```

## Implementation Details

### How It Works

1. **Session Detection**: API checks if `session === 'ALL'`

2. **Single Session**: 
   - Queries one specialized table
   - Uses `buyPct` and `sellPct` parameters
   - Returns events from that session only

3. **Combined Session**:
   - Queries both RTH and AH specialized tables
   - Uses separate thresholds for each session
   - Combines results chronologically
   - Returns combined event count plus individual counts

### Chronological Ordering

When querying ALL sessions, events are sorted by:
1. Event date (ascending)
2. Event time (ascending)

This ensures proper chronological order for wallet simulation.

### Table Selection

The API automatically selects the correct specialized tables:
- RTH queries: `trade_events_rth_{method}`
- AH queries: `trade_events_ah_{method}`
- ALL queries: Both tables

## Use Cases

### Conservative RTH, Aggressive AH
```
rthBuyPct=0.3, rthSellPct=0.3  (tight thresholds during regular hours)
ahBuyPct=1.0, ahSellPct=1.0    (wider thresholds after hours)
```

### Aggressive RTH, Conservative AH
```
rthBuyPct=1.0, rthSellPct=1.0  (wider thresholds during regular hours)
ahBuyPct=0.3, ahSellPct=0.3    (tight thresholds after hours)
```

### Same Values (Backward Compatible)
```
rthBuyPct=0.5, rthSellPct=0.5
ahBuyPct=0.5, ahSellPct=0.5
```

## Frontend Integration

### Form Updates Needed

1. **Session Selector**:
   - RTH only
   - AH only
   - ALL (with separate values)

2. **Conditional Inputs**:
   - If RTH or AH: Show single buyPct/sellPct
   - If ALL: Show rthBuyPct, rthSellPct, ahBuyPct, ahSellPct

3. **Optional Toggle**:
   - "Use same values for both sessions"
   - When checked: Copy RTH values to AH automatically

### API Client Updates

```typescript
// Single session
const params = {
  symbol,
  method,
  session: 'RTH',
  buyPct: 0.5,
  sellPct: 0.5,
  startDate,
  endDate
};

// Combined session
const params = {
  symbol,
  method,
  session: 'ALL',
  rthBuyPct: 0.5,
  rthSellPct: 0.5,
  ahBuyPct: 1.0,
  ahSellPct: 1.0,
  startDate,
  endDate
};
```

## Testing

### Test Cases

1. ✅ Single RTH session (backward compatible)
2. ✅ Single AH session (backward compatible)
3. ⏳ Combined ALL session with same values
4. ⏳ Combined ALL session with different values
5. ⏳ Verify chronological ordering
6. ⏳ Verify ROI calculation accuracy

### Test Script

Run `./test-separate-values.sh` to test all scenarios.

## Benefits

1. **Flexibility**: Different strategies for different market conditions
2. **Backward Compatible**: Old API calls still work
3. **Performance**: Uses optimized specialized tables
4. **Transparency**: Response shows which tables were queried
5. **Accuracy**: Proper chronological ordering for wallet simulation

## Files Modified

- `api-server/event-endpoints-with-separate-values.js` - New endpoint implementation
- `api-server/server.js` - Updated to use new endpoints
- `test-separate-values.sh` - Test script for new feature

## Status

- ✅ API implementation complete
- ✅ Committed to GitHub
- ⏳ Deploying to Cloud Run
- ⏳ Frontend updates pending
- ⏳ Testing pending

---

**Created:** October 28, 2025
**Status:** In Deployment