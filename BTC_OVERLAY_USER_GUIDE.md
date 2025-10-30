# BTC Overlay Report - User Guide

## Overview
The BTC Overlay Report visualizes stock prices alongside Bitcoin prices and simulates ratio-based trading strategies. It helps identify optimal entry and exit points based on the relationship between stock and BTC prices.

## Accessing the Report
Navigate to: `/reports/btc-overlay`

## Quick Start

### 1. Load Data
1. Select a **Symbol** (e.g., RIOT, MARA, CLSK)
2. Choose a **Date Range** (start and end dates)
3. Select **Session Type**:
   - **RTH**: Regular Trading Hours (9:30 AM - 4:00 PM ET)
   - **AH**: After Hours (4:00 AM - 9:30 AM, 4:00 PM - 8:00 PM ET)
   - **ALL**: Both RTH and AH combined
4. Click **"Load Data"** to fetch minute-by-minute prices

### 2. Configure Strategy
1. Select **Baseline Method**:
   - **VWAP_RATIO**: Ratio of volume-weighted average prices
   - **VOL_WEIGHTED**: Volume-weighted average ratio
   - **WINSORIZED**: Winsorized volume-weighted ratio (removes outliers)
   - **WEIGHTED_MEDIAN**: Volume-weighted median ratio
   - **EQUAL_MEAN**: Simple average ratio

2. Set **Thresholds**:
   - **Buy Threshold %**: How much above baseline to trigger buy (e.g., 0.5%)
   - **Sell Threshold %**: How much below baseline to trigger sell (e.g., 1.0%)

3. **Advanced Options**:
   - **Conservative Pricing**: Round up for buys, down for sells (recommended)
   - **Slippage**: Account for execution slippage (e.g., 0.0001 = 0.01%)

4. **Session-Specific Thresholds** (ALL mode only):
   - Set different thresholds for RTH vs AH sessions
   - RTH typically has tighter spreads
   - AH may require wider thresholds

### 3. Run Simulation
Click **"Run Simulation"** to execute the strategy and see results.

## Understanding the Results

### Summary Statistics
- **Total Return**: Overall profit/loss percentage
- **Trades**: Number of completed trades
- **Win Rate**: Percentage of profitable trades
- **Avg Return**: Average return per trade
- **Best Trade**: Highest single trade return
- **Worst Trade**: Lowest single trade return

### Price Chart
- **Blue Line**: Stock price (left axis)
- **Green Line**: BTC price (right axis)
- **Green Dashed Lines**: Buy signals
- **Red Dashed Lines**: Sell signals
- Hover over chart to see exact values

### Equity Curve
- Shows portfolio value over time
- Red dashed line indicates initial capital ($10,000)
- Upward slope = profitable strategy
- Downward slope = losing strategy

### Trade List
Detailed breakdown of each trade:
- **Entry**: Date/time and price of purchase
- **Exit**: Date/time and price of sale
- **Return %**: Profit/loss on the trade
- **Stock Δ %**: Stock price change during trade
- **BTC Δ %**: BTC price change during trade

## Strategy Explanation

### How It Works
1. **Ratio Calculation**: `ratio = BTC price / Stock price`
2. **Baseline**: Average ratio from previous trading day
3. **Buy Signal**: When ratio rises above `baseline × (1 + buy%)`
4. **Sell Signal**: When ratio falls below `baseline × (1 - sell%)`

### Example
- Stock price: $12.00
- BTC price: $67,500
- Ratio: 5,625 (67,500 / 12)
- Baseline: 5,400
- Buy threshold: 0.5%
- Buy trigger: 5,427 (5,400 × 1.005)
- **Result**: Ratio (5,625) > Buy trigger (5,427) → BUY SIGNAL

### Why This Works
When BTC rises faster than the stock, the ratio increases. This often indicates the stock will "catch up" to BTC's movement. The strategy buys when the ratio is high (expecting mean reversion) and sells when it normalizes.

## Tips for Best Results

### 1. Choosing Thresholds
- **Tighter thresholds** (0.3-0.5%): More trades, smaller gains
- **Wider thresholds** (1.0-2.0%): Fewer trades, larger gains
- Start with 0.5% buy / 1.0% sell and adjust based on results

### 2. Baseline Methods
- **VWAP_RATIO**: Most stable, good for beginners
- **VOL_WEIGHTED**: Emphasizes high-volume periods
- **WINSORIZED**: Removes outliers, more robust
- **WEIGHTED_MEDIAN**: Less sensitive to extremes
- **EQUAL_MEAN**: Simplest, treats all minutes equally

### 3. Session Selection
- **RTH**: More liquidity, tighter spreads, more reliable
- **AH**: Higher volatility, wider spreads, more risk
- **ALL**: Captures both sessions, use session-specific thresholds

### 4. Date Range
- **Short range** (1-5 days): Quick testing, less reliable
- **Medium range** (1-4 weeks): Good balance
- **Long range** (1-3 months): More reliable statistics

### 5. Conservative Pricing
- **Always enable** for realistic results
- Rounds up for buys (pay more)
- Rounds down for sells (receive less)
- Accounts for bid-ask spread

## Exporting Results

Click **"Export CSV"** to download trade list with:
- Entry/exit dates and times
- Entry/exit prices
- Returns and deltas
- Can be opened in Excel or Google Sheets

## Common Issues

### "No minute data found"
- Check if date range includes trading days
- Verify symbol has data for selected dates
- Try a different date range

### "No baselines found"
- Baseline requires previous trading day data
- Try starting one day later
- Check if baseline method has data

### "No trades triggered"
- Thresholds may be too wide
- Try tighter buy/sell percentages
- Check if baseline is reasonable

### Chart is too crowded
- Reduce date range
- Use RTH session only
- Focus on specific days

## Advanced Features

### Session-Specific Thresholds (ALL mode)
When using ALL session type, you can set different thresholds for RTH and AH:

**Example Configuration:**
- RTH Buy: 0.5% (tighter, more liquid)
- RTH Sell: 1.0%
- AH Buy: 0.8% (wider, less liquid)
- AH Sell: 1.5%

This accounts for different market conditions in each session.

### Slippage
Add realistic execution costs:
- 0.0001 = 0.01% slippage
- 0.001 = 0.1% slippage
- Increases buy prices, decreases sell prices

## Interpreting Results

### Good Strategy Indicators
✅ Win rate > 60%
✅ Positive total return
✅ Consistent equity curve growth
✅ Average return > 1%
✅ Best trade > Worst trade (in absolute terms)

### Warning Signs
⚠️ Win rate < 50%
⚠️ Negative total return
⚠️ Erratic equity curve
⚠️ Large worst trade
⚠️ Very few trades (< 3)

## Best Practices

1. **Start Simple**: Use RTH, VWAP_RATIO, 0.5%/1.0% thresholds
2. **Test Multiple Periods**: Don't rely on one date range
3. **Compare Methods**: Try different baseline methods
4. **Adjust Gradually**: Make small threshold changes
5. **Consider Context**: Market conditions affect results
6. **Use Conservative Pricing**: Always enable for realism
7. **Export and Analyze**: Review trade details in Excel

## Support

For questions or issues:
1. Check this guide first
2. Review the implementation documentation
3. Contact the development team

## Version History

- **v1.0** (Current): Initial release with core features
  - 3 backend API endpoints
  - Complete frontend UI
  - 5 baseline methods
  - 3 session types
  - CSV export