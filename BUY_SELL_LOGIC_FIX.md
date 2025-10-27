# Buy/Sell Logic Fix - Critical Bug Resolution

## Problem Identified

The buy/sell threshold calculations and comparisons were **inverted**, causing the system to:
- **BUY when prices were LOW** (should buy when prices are HIGH)
- **SELL when prices were HIGH** (should sell when prices are LOW)

This is the opposite of the intended mean-reversion strategy.

## Root Cause

### BEFORE (INCORRECT):
```javascript
const buyThr = baseline * (1 - buyThreshold / 100);   // Subtracting adjustment
const sellThr = baseline * (1 + sellThreshold / 100); // Adding adjustment

if (stockPrice <= buyThr) {  // Buy when price BELOW threshold
if (stockPrice >= sellThr) { // Sell when price ABOVE threshold
```

### AFTER (CORRECT):
```javascript
const buyThr = baseline * (1 + buyThreshold / 100);   // Adding adjustment
const sellThr = baseline * (1 - sellThreshold / 100); // Subtracting adjustment

if (stockPrice >= buyThr) {  // Buy when price ABOVE threshold
if (stockPrice <= sellThr) { // Sell when price BELOW threshold
```

## Logic Explanation

The strategy is based on the ratio: `stockPrice / btcPrice`

When comparing `stockPrice` directly to a baseline (which represents the expected ratio × btcPrice):

1. **BUY Signal**: When stock price is HIGH relative to baseline
   - `buyThr = baseline × (1 + adjustment)`
   - Trigger: `stockPrice >= buyThr`
   - This means the ratio is elevated above normal

2. **SELL Signal**: When stock price is LOW relative to baseline
   - `sellThr = baseline × (1 - adjustment)`
   - Trigger: `stockPrice <= sellThr`
   - This means the ratio has reverted below normal

## Files Fixed

1. `api-server/fast-daily-endpoint.js` - Main simulation endpoint
2. `processor/nightly-processor-dual.js` - Batch processor

## Expected Impact

With the corrected logic:
- The system should now properly identify mean-reversion opportunities
- Buy signals will trigger when the stock/BTC ratio is elevated
- Sell signals will trigger when the ratio reverts to normal or below
- Results should now match hand calculations based on the correct logic

## Testing Required

1. Re-run simulation for 9/24-9/25/2025 with:
   - Method: EQUAL_MEAN
   - Buy Threshold: 0.5%
   - Sell Threshold: 1.0%
   - Session: ALL

2. Expected result: 5 trades with +4.6% ROI (matching hand calculations)

3. Verify each trade's entry/exit points match the corrected logic