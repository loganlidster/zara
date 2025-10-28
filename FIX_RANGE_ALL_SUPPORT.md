# Fix Range Testing to Support "All" for Method and Session

## Current Behavior
- Range testing requires specific symbol, method, and session
- Shows error if any filter is set to "All"

## Desired Behavior
- Allow "All" for method and/or session
- Test the range across all selected methods/sessions
- Example: Test Buy 2.5-3.0%, Sell 0.5-1.0% across ALL 5 methods

## Implementation

### Backend Changes
The backend already supports this! The `best-performers-range` endpoint can handle:
- Single symbol (required)
- Multiple methods (if "All" selected, test all 5)
- Multiple sessions (if "All" selected, test RTH and AH)

### Frontend Changes
Remove the validation that blocks "All" for method and session.

**Current validation (remove this):**
```typescript
if (methodFilter === 'All') {
  setError('Range testing requires a specific method.');
  setLoading(false);
  return;
}

if (sessionFilter === 'All') {
  setError('Range testing requires a specific session.');
  setLoading(false);
  return;
}
```

**New logic:**
- Symbol: Still required (must be specific)
- Method: Can be "All" or specific
- Session: Can be "All" or specific

### API Call Changes
```typescript
response = await getTopPerformersRange({
  symbol: symbolFilter,
  method: methodFilter === 'All' ? undefined : methodFilter,
  session: sessionFilter === 'All' ? undefined : sessionFilter,
  buyMin,
  buyMax,
  sellMin,
  sellMax,
  startDate,
  endDate,
  limit
});
```

### Backend Support
The backend needs to handle undefined method/session by testing all:

```javascript
const methods = method ? [method.toUpperCase()] : ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const sessions = session ? [session.toUpperCase()] : ['RTH', 'AH'];

// Then test all combinations
for (const meth of methods) {
  for (const sess of sessions) {
    for (const buyPct of buyValues) {
      for (const sellPct of sellValues) {
        // Test this combination
      }
    }
  }
}
```

## Example Use Cases

### Test range across all methods
- Symbol: HIVE
- Method: **All** (tests all 5 methods)
- Session: RTH
- Buy: 2.5-3.0% (6 values)
- Sell: 0.5-1.0% (6 values)
- Total: 6 × 6 × 5 = **180 combinations**
- Time: ~45 seconds

### Test range across all sessions
- Symbol: HIVE
- Method: EQUAL_MEAN
- Session: **All** (tests RTH and AH)
- Buy: 2.5-3.0% (6 values)
- Sell: 0.5-1.0% (6 values)
- Total: 6 × 6 × 2 = **72 combinations**
- Time: ~18 seconds

### Test range across all methods AND sessions
- Symbol: HIVE
- Method: **All**
- Session: **All**
- Buy: 2.5-3.0% (6 values)
- Sell: 0.5-1.0% (6 values)
- Total: 6 × 6 × 5 × 2 = **360 combinations**
- Time: ~90 seconds