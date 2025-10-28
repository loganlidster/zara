# Best Performers Range Testing Feature

## Concept

Add ability to test custom threshold ranges instead of just querying existing precomputed data.

## Current Behavior
- Queries existing combinations from database
- Shows top performers from what's already been processed
- Limited to combinations that were precomputed

## New Behavior

### Mode 1: "All" (Current - Default)
- Query existing precomputed combinations
- Fast (uses existing data)
- Shows best from all historical processing

### Mode 2: "Custom Range" (New)
- User specifies Buy Min/Max and Sell Min/Max
- System tests every 0.1% increment
- Simulates wallet for each combination
- Returns top performers from the range

## UI Design

```
┌─────────────────────────────────────────────────────────┐
│ Threshold Mode:  ○ All (existing data)                 │
│                  ● Custom Range (test specific range)   │
└─────────────────────────────────────────────────────────┘

When "Custom Range" selected:

┌──────────────────┬──────────────────┐
│ Buy Thresholds   │ Sell Thresholds  │
├──────────────────┼──────────────────┤
│ Min: [0.4] %     │ Min: [0.1] %     │
│ Max: [0.6] %     │ Max: [0.3] %     │
└──────────────────┴──────────────────┘

This will test:
- Buy: 0.4%, 0.5%, 0.6% (3 values)
- Sell: 0.1%, 0.2%, 0.3% (3 values)
- Total: 3 × 3 = 9 combinations
```

## Implementation

### API Endpoint: `/api/events/best-performers-range`

**Request:**
```json
{
  "symbol": "HIVE",
  "method": "EQUAL_MEAN",
  "session": "RTH",
  "buyMin": 0.4,
  "buyMax": 0.6,
  "sellMin": 0.1,
  "sellMax": 0.3,
  "startDate": "2025-09-01",
  "endDate": "2025-09-22",
  "limit": 20
}
```

**Logic:**
1. Generate all combinations:
   - Buy: [0.4, 0.5, 0.6]
   - Sell: [0.1, 0.2, 0.3]
   - Combinations: 9 total

2. For each combination:
   - Fetch events from database
   - Filter to alternating BUY/SELL
   - Simulate wallet
   - Calculate true ROI

3. Sort by ROI and return top N

**Response:**
```json
{
  "success": true,
  "mode": "range",
  "rangeParams": {
    "buyMin": 0.4,
    "buyMax": 0.6,
    "sellMin": 0.1,
    "sellMax": 0.3,
    "combinationsTested": 9
  },
  "topPerformers": [...],
  "timing": {
    "total": 2341,
    "avgPerCombination": 260
  }
}
```

## Performance Estimation

**Example: Buy 0.4-0.6, Sell 0.1-0.3**
- Buy values: 3 (0.4, 0.5, 0.6)
- Sell values: 3 (0.1, 0.2, 0.3)
- Total combinations: 9
- Time per combination: ~250ms
- Total time: ~2.25 seconds ✅ Fast!

**Example: Buy 0.1-3.0, Sell 0.1-3.0**
- Buy values: 30 (0.1 to 3.0 in 0.1 steps)
- Sell values: 30
- Total combinations: 900
- Time per combination: ~250ms
- Total time: ~225 seconds (3.75 minutes) ⚠️ Slow but acceptable

## UI Flow

1. User selects "Custom Range" mode
2. Input fields appear for Buy Min/Max and Sell Min/Max
3. System calculates and shows: "This will test X combinations"
4. User clicks "Run Report"
5. Progress indicator shows: "Testing combination 45 of 900..."
6. Results appear sorted by ROI
7. User can click any result to drill down to Fast Daily

## Frontend Changes

### Best Performers Page
```typescript
const [mode, setMode] = useState<'all' | 'range'>('all');
const [buyMin, setBuyMin] = useState(0.4);
const [buyMax, setBuyMax] = useState(0.6);
const [sellMin, setSellMin] = useState(0.1);
const [sellMax, setSellMax] = useState(0.3);

// Calculate combinations
const buyCombos = Math.round((buyMax - buyMin) / 0.1) + 1;
const sellCombos = Math.round((sellMax - sellMin) / 0.1) + 1;
const totalCombos = buyCombos * sellCombos;
```

## Benefits

1. **Flexibility**: Test any threshold range
2. **Discovery**: Find optimal thresholds for specific periods
3. **Validation**: Verify precomputed results
4. **Experimentation**: Quick what-if analysis

## Limitations

1. **Time**: Large ranges (30×30=900) take ~4 minutes
2. **No caching**: Each query recalculates (could add caching later)
3. **Single symbol**: Range testing works best with one symbol at a time

## Implementation Priority

**Phase 1** (Now):
- Add range mode to Best Performers
- Support single symbol only
- Show progress indicator

**Phase 2** (Later):
- Add caching for common ranges
- Support multiple symbols
- Add "Save Range" feature to precompute and cache

Ready to implement? 🚀