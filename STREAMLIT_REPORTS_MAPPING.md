# Streamlit App Reports - Implementation Status

## Reports in baseline_unified_app_fast_daily_btc_overlay_v2.py

### ✅ Already Implemented in Dashboard

1. **Best Performers** (Batch Fast - Leaderboard)
   - Streamlit: "Batch (Fast): multi-symbol grid — NO EOD flatten; carries wallet across days"
   - Dashboard: `/reports/best-performers`
   - Status: ✅ COMPLETE (with multi-select and per-stock view)

2. **Daily Curve & ROI**
   - Streamlit: "Daily Curve & ROI (long) — multi-symbol with BTC benchmark aligned to stock trading days"
   - Dashboard: `/reports/daily-curve`
   - Status: ✅ COMPLETE (with session-specific baselines)

3. **Fast Daily** (Single symbol/method/threshold analysis)
   - Streamlit: Part of various sections
   - Dashboard: `/reports/fast-daily`
   - Status: ✅ COMPLETE

4. **BTC Overlay**
   - Streamlit: Part of "Daily Curve & ROI" section
   - Dashboard: `/reports/btc-overlay`
   - Status: ✅ COMPLETE

### 🔄 Partially Implemented

5. **Pattern Overview**
   - Dashboard: `/reports/pattern-overview`
   - Status: 🔄 EXISTS but may need enhancement

6. **Pattern Deep Dive**
   - Dashboard: `/reports/pattern-deep-dive`
   - Status: 🔄 EXISTS but may need enhancement

7. **Overreaction Analysis**
   - Dashboard: `/reports/overreaction-analysis`
   - Status: 🔄 EXISTS but may need enhancement

8. **Custom Pattern Analyzer**
   - Dashboard: `/reports/custom-pattern-analyzer`
   - Status: 🔄 EXISTS but may need enhancement

### ❌ Not Yet Implemented

9. **Grid Report** (Buy/Sell % Grid)
   - Streamlit: "Grid: buy/sell % vs prior-N-day baseline (compare multiple methods)"
   - Description: Tests multiple buy% and sell% combinations in a grid
   - Features:
     * Single symbol
     * Multiple baseline methods comparison
     * Buy% range (min, max, step)
     * Sell% range (min, max, step)
     * Surge mode support
     * Heatmap visualization of ROI by buy%/sell% combination
   - Dashboard: ❌ NOT IMPLEMENTED
   - Priority: HIGH (useful for parameter optimization)

10. **Batch Daily Winners**
    - Streamlit: "Batch (Fast) — Daily: best (method, thresholds) per day + confidence"
    - Description: Shows best performing method/thresholds for each trading day
    - Features:
      * Per-day winners
      * Consistency by method
      * Confidence metrics
    - Dashboard: ❌ NOT IMPLEMENTED
    - Priority: MEDIUM

11. **Trade Detail with Liquidity Context**
    - Streamlit: "Trade Detail (per symbol / method / thresholds) — with ±5-minute liquidity context"
    - Description: Detailed trade-by-trade analysis with volume/liquidity context
    - Features:
      * ±5 minute volume context around each trade
      * Liquidity analysis
      * Trade execution quality
    - Dashboard: ❌ NOT IMPLEMENTED
    - Priority: MEDIUM

12. **Previous-Day Baseline Sanity Check**
    - Streamlit: "Previous-day baseline (sanity check) — supports N-day average"
    - Description: Quick check of baseline calculation for a specific date
    - Features:
      * Single date baseline calculation
      * N-day average support
      * Method comparison
    - Dashboard: ❌ NOT IMPLEMENTED
    - Priority: LOW (mostly for debugging)

13. **Coverage Report**
    - Streamlit: "Coverage (stock minutes, BTC minutes, matched)"
    - Description: Data quality and coverage analysis
    - Features:
      * Stock minute bar coverage
      * BTC minute bar coverage
      * Matched data points
    - Dashboard: ❌ NOT IMPLEMENTED
    - Priority: LOW (operational/debugging tool)

14. **Backfill Tool**
    - Streamlit: "Backfill minute bars to SQL (BTC + symbols)"
    - Description: Data loading utility
    - Dashboard: ❌ NOT IMPLEMENTED (handled by backend jobs)
    - Priority: N/A (not needed - we have automated jobs)

## Recommended Next Implementation

### **Grid Report** (Highest Priority)

This is the most valuable missing report for users:

**Why it's important:**
- Helps users find optimal buy%/sell% combinations
- Visualizes performance across parameter space
- Compares multiple baseline methods side-by-side
- Essential for strategy optimization

**Key Features to Implement:**
1. Single symbol selection
2. Multiple baseline method selection (checkboxes)
3. Buy% range inputs (min, max, step)
4. Sell% range inputs (min, max, step)
5. Date range selection
6. Session selection (RTH/AH/ALL)
7. Results display:
   - Heatmap for each method showing ROI by buy%/sell% combination
   - Best combination for each method
   - Comparison table across methods
   - Export to CSV

**Estimated Complexity:** Medium
**Estimated Time:** 3-4 hours

Would you like me to implement the Grid Report next?