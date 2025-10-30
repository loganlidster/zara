# Multi-Stock Daily Curve Report - Implementation Plan

## Overview
Run Daily Curve & ROI simulation for multiple stocks simultaneously, each with independent settings and capital. This eliminates the need to run the Daily Curve report 11 times manually.

## Key Concept
- **Each stock = Independent simulation** (like running Daily Curve 11 times)
- **Each stock starts with $10,000** (separate portfolios)
- **Each stock has unique settings** (RTH buy/sell %, AH buy/sell %, method)
- **No interaction between stocks** (CIFR trades don't affect CAN)
- **View all results together** (compare side-by-side in one chart)

## UI Design

### Input Section
```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Stock Daily Curve                                      │
├─────────────────────────────────────────────────────────────┤
│ Global Settings:                                             │
│ [Start Date: 2024-10-01] [End Date: 2024-10-31]            │
│ [Slippage: 0.1%] [✓ Conservative Rounding]                 │
│                                                              │
│ Stock Configurations:                                        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [✓] BTDR - WEIGHTED_MEDIAN                           │   │
│ │     RTH: Buy 0.5% | Sell 0.5%                        │   │
│ │     AH:  Buy 0.5% | Sell 0.5%                        │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [✓] RIOT - EQUAL_MEAN                                │   │
│ │     RTH: Buy 0.6% | Sell 0.4%                        │   │
│ │     AH:  Buy 0.7% | Sell 0.3%                        │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [ ] MARA - VWAP_RATIO                                │   │
│ │     RTH: Buy 0.5% | Sell 0.5%                        │   │
│ │     AH:  Buy 0.5% | Sell 0.5%                        │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [+ Add Stock] [Load My Live Settings] [Select All]         │
│                                                              │
│ [Run Simulation]                                             │
└─────────────────────────────────────────────────────────────┘
```

### Results Section
```
┌─────────────────────────────────────────────────────────────┐
│ Combined Performance Chart                                   │
├─────────────────────────────────────────────────────────────┤
│ [Line chart showing all stocks' cumulative returns]         │
│                                                              │
│ Summary Table:                                               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Symbol | Method      | Return % | Trades | Win Rate   │ │
│ │ BTDR   | W_MEDIAN    | +144.37% | 158    | 68.4%      │ │
│ │ RIOT   | EQUAL_MEAN  | +89.23%  | 142    | 71.2%      │ │
│ │ MARA   | VWAP_RATIO  | +56.78%  | 135    | 65.9%      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Export All Results CSV]                                     │
└─────────────────────────────────────────────────────────────┘
```

## Backend Implementation

### Endpoint: `/api/multi-stock-daily-curve`

**Request:**
```typescript
{
  startDate: string;
  endDate: string;
  slippagePct: number;
  conservativeRounding: boolean;
  stocks: [
    {
      symbol: string;
      method: string;
      rthBuyPct: number;
      rthSellPct: number;
      ahBuyPct: number;
      ahSellPct: number;
    }
  ]
}
```

**Processing:**
For each stock in the request:
1. Run Daily Curve simulation independently (reuse existing logic)
2. Each simulation starts with $10,000
3. Use stock's specific RTH/AH thresholds
4. Generate equity curve and statistics

**Response:**
```typescript
{
  success: boolean;
  dateRange: { startDate: string; endDate: string };
  results: [
    {
      symbol: string;
      method: string;
      dates: string[];
      equityCurve: number[];
      summary: {
        totalReturn: number;
        totalReturnPct: number;
        totalTrades: number;
        winRate: number;
        avgTrade: number;
        finalEquity: number;
      }
    }
  ]
}
```

## Implementation Steps

### Phase 1: Backend (2-3 hours)
- [ ] Create `/api/multi-stock-daily-curve` endpoint
- [ ] Loop through each stock configuration
- [ ] Call existing Daily Curve logic for each stock
- [ ] Aggregate results into single response
- [ ] Add error handling for individual stock failures

### Phase 2: Frontend (3-4 hours)
- [ ] Create page at `/reports/multi-stock-daily-curve`
- [ ] Build stock configuration form (11 expandable cards)
- [ ] Add global settings (date range, slippage)
- [ ] Add "Load My Live Settings" preset button
- [ ] Add enable/disable checkboxes per stock
- [ ] Form validation

### Phase 3: Results Visualization (2-3 hours)
- [ ] Combined line chart (all stocks on one graph)
- [ ] Use enhanced color palette (from Daily Curve)
- [ ] Summary statistics table
- [ ] Sortable columns
- [ ] CSV export (all stocks combined)

### Phase 4: Testing (1 hour)
- [ ] Test with 1 stock (verify matches Daily Curve)
- [ ] Test with 11 stocks
- [ ] Test with different settings per stock
- [ ] Performance testing

**Total Time: 8-11 hours**

## Key Advantages

✅ **Time Savings**: Run once instead of 11 times
✅ **Easy Comparison**: See all stocks side-by-side
✅ **Flexible Settings**: Each stock has unique configuration
✅ **Reuses Existing Code**: Leverages Daily Curve logic
✅ **Independent Simulations**: No cross-stock interference

## Example Configuration

Your live settings might look like:
```javascript
[
  { symbol: 'BTDR', method: 'WEIGHTED_MEDIAN', rthBuy: 0.5, rthSell: 0.5, ahBuy: 0.5, ahSell: 0.5 },
  { symbol: 'RIOT', method: 'EQUAL_MEAN', rthBuy: 0.6, rthSell: 0.4, ahBuy: 0.7, ahSell: 0.3 },
  { symbol: 'MARA', method: 'VWAP_RATIO', rthBuy: 0.5, rthSell: 0.5, ahBuy: 0.6, ahSell: 0.4 },
  // ... 8 more stocks
]
```

This configuration can be saved as a preset and loaded with one click.