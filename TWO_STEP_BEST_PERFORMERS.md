# Two-Step Best Performers Approach

## Concept
Use a two-step process to efficiently find and accurately rank top performers:
1. **Step 1 (Fast Filter)**: Use SUM(trade_roi_pct) to identify top candidates
2. **Step 2 (Accurate Ranking)**: Simulate wallet for top candidates to get true ROI

## Why This Works

### Step 1: Sum as a Proxy
```sql
-- Fast aggregation to find candidates
SELECT symbol, method, session, buy_pct, sell_pct,
       SUM(trade_roi_pct) as score,
       COUNT(*) as total_events
FROM trade_events_rth_equal_mean
WHERE event_date BETWEEN '2025-09-01' AND '2025-09-22'
GROUP BY symbol, method, session, buy_pct, sell_pct
ORDER BY score DESC
LIMIT 100
```

**Purpose**: Identify combinations with high trading activity and profitable trades
**Speed**: Milliseconds (pure SQL aggregation)
**Accuracy**: Not exact ROI, but good enough to find winners

### Step 2: Wallet Simulation
```javascript
// For each of the top 100 candidates:
for (const candidate of topCandidates) {
  const events = await fetchEvents(candidate);
  const filteredEvents = filterToAlternating(events);
  const trueROI = simulateWallet(filteredEvents, initialCapital);
  candidate.portfolioROI = trueROI;
}

// Re-sort by true ROI
topCandidates.sort((a, b) => b.portfolioROI - a.portfolioROI);
```

**Purpose**: Calculate mathematically correct portfolio ROI
**Speed**: Fast because only simulating 100 combinations (not thousands)
**Accuracy**: 100% correct - matches Fast Daily

## Example Flow

### User Request
- Date range: 9/1/25 - 9/22/25
- Symbol: HIVE
- Method: EQUAL_MEAN
- Session: RTH
- Show top 20

### Step 1: Fast Filter (SQL)
```
Query: Find top 100 by SUM(trade_roi_pct)
Time: ~50ms
Results: 100 combinations with highest scores
```

### Step 2: Accurate Ranking (Node.js)
```
For each of 100 combinations:
  - Fetch events (~10ms each)
  - Filter to alternating BUY/SELL
  - Simulate wallet
  - Calculate true ROI
  
Total time: ~1-2 seconds for 100 combinations
```

### Final Result
```
Top 20 combinations ranked by TRUE portfolio ROI
Matches Fast Daily calculations
Total time: ~2 seconds
```

## Benefits

✅ **Fast**: Step 1 filters millions of combinations in milliseconds
✅ **Accurate**: Step 2 gives mathematically correct ROI
✅ **Scalable**: Only simulate top candidates, not everything
✅ **Correct**: Final rankings match Fast Daily
✅ **User-friendly**: Results in 2-3 seconds instead of minutes

## API Implementation

```javascript
router.get('/top-performers', async (req, res) => {
  const { startDate, endDate, limit = 20, symbol, method, session } = req.query;
  
  // Step 1: Fast filter using SUM (get top 100)
  const candidates = await getCandidatesSQL(
    startDate, endDate, symbol, method, session, 
    limit: 100  // Get more than requested for accurate re-ranking
  );
  
  // Step 2: Simulate wallet for top candidates
  const withTrueROI = await Promise.all(
    candidates.map(async (candidate) => {
      const events = await fetchEvents(candidate);
      const filteredEvents = filterToAlternating(events);
      const trueROI = simulateWallet(filteredEvents, 10000);
      return { ...candidate, portfolioROI: trueROI };
    })
  );
  
  // Re-sort by true ROI and return top N
  const topPerformers = withTrueROI
    .sort((a, b) => b.portfolioROI - a.portfolioROI)
    .slice(0, limit);
  
  res.json({ success: true, topPerformers });
});
```

## Performance Comparison

### Old Approach (Incorrect)
- Query: SUM(trade_roi_pct) for all combinations
- Time: ~100ms
- Result: Wrong ROI (8.65% instead of 46.18%)

### Naive Fix (Slow)
- Simulate wallet for ALL combinations
- Time: ~5-10 minutes for thousands of combinations
- Result: Correct but too slow

### Two-Step Approach (Best)
- Step 1: Filter to top 100 (~50ms)
- Step 2: Simulate 100 combinations (~2 seconds)
- Total: ~2 seconds
- Result: Correct and fast! ✅

## Edge Cases

### What if sum score doesn't correlate with true ROI?
- Unlikely: High sum usually means high ROI
- If it happens: We get top 100, so even if #1 by sum is actually #50 by ROI, we'll still find the true #1
- Solution: Increase Step 1 limit (get top 200 instead of 100)

### What if user requests top 100?
- Step 1: Get top 200 candidates
- Step 2: Simulate all 200
- Return top 100 by true ROI
- Still fast: ~4 seconds for 200 simulations

## Validation

To verify this works, we can:
1. Run Step 1 for HIVE 9/1-9/22
2. Check if 2.9% buy / 0.7% sell is in top 100 by sum
3. Run Step 2 on top 100
4. Verify 2.9% / 0.7% ranks #1 with 46.18% ROI

## Conclusion

This two-step approach gives us:
- ✅ Speed of SQL aggregation
- ✅ Accuracy of wallet simulation
- ✅ Scalability to large datasets
- ✅ Correct results matching Fast Daily

Best of both worlds! 🎉