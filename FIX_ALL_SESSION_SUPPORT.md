# 🔧 CRITICAL FIX: Add "ALL" Session Support

## Problem Identified

The simulator only runs ONE session at a time (RTH or AH), but Grant's old system runs ALL sessions together in chronological order. This causes:

1. **Missing trades** - Trades in the other session are never seen
2. **Wrong ROI** - Only seeing partial day results
3. **Inconsistent results** - Different from the proven Python tool

## Root Cause

**Query filters by session:**
```sql
AND s.session = $5  -- Only gets RTH OR AH, not both
```

**Frontend only offers RTH or AH** - No "ALL" option

## The Fix

### 1. Backend Changes (server.js)

**Before:**
```javascript
const query = `
  ...
  WHERE s.symbol = $2
    AND s.et_date >= $3
    AND s.et_date <= $4
    AND s.session = $5  -- PROBLEM: Filters to one session
    AND tc.is_open = true
  ORDER BY s.bar_time ASC
`;

const result = await client.query(query, [method, symbol, startDate, endDate, session]);
```

**After:**
```javascript
// If session is 'ALL', don't filter by session
const sessionFilter = session === 'ALL' ? '' : 'AND s.session = $5';
const queryParams = session === 'ALL' 
  ? [method, symbol, startDate, endDate]
  : [method, symbol, startDate, endDate, session];

const query = `
  ...
  WHERE s.symbol = $2
    AND s.et_date >= $3
    AND s.et_date <= $4
    ${sessionFilter}  -- FIXED: Optional session filter
    AND tc.is_open = true
  ORDER BY s.bar_time ASC
`;

const result = await client.query(query, queryParams);
```

### 2. Frontend Changes (SimulationForm.jsx)

**Before:**
```javascript
const SESSIONS = ['RTH', 'AH']  // Missing 'ALL'
```

**After:**
```javascript
const SESSIONS = ['ALL', 'RTH', 'AH']  // Added 'ALL' option
```

**Default value:**
```javascript
session: 'ALL',  // Changed from 'RTH' to 'ALL'
```

### 3. Same Fix Needed in ALL Endpoints

- ✅ `/api/simulate` (Single Simulation)
- ⚠️ `/api/batch-simulate` (Batch Grid Search)
- ⚠️ `/api/batch-daily` (Batch Daily Report)
- ⚠️ `/api/fast-daily` (Fast Daily Report)

## Expected Results After Fix

**HIVE 9/24/2025 with EQUAL_MEAN, 0.5% buy, 1.0% sell:**
- Should see 4 trades on 9/24 (2 round trips)
- Should see 1 trade on 9/25 (position carryover)
- Should match Grant's old system: +4.6% ROI

## Implementation Steps

1. Update `api-server/server.js` - Add ALL session support to `/api/simulate`
2. Update `api-server/batch-endpoint.js` - Add ALL session support to batch
3. Update `api-server/batch-daily-endpoint.js` - Add ALL session support
4. Update `api-server/fast-daily-endpoint.js` - Add ALL session support
5. Update `web-ui/src/components/SimulationForm.jsx` - Add 'ALL' to dropdown
6. Update all batch search UIs to include 'ALL' option
7. Test with HIVE 9/24/2025 to verify 5 trades and +4.6% ROI

## CORS Fix (Separate Issue)

The Batch Grid Search CORS error needs:

```javascript
// In server.js, update CORS config
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://tradiac-testing-66f6e.web.app',
    'https://tradiac-testing-66f6e.firebaseapp.com'
  ],
  credentials: true
}));
```