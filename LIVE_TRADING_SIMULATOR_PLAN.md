# Live Trading Simulator Report - Implementation Plan

## Overview
Create a report that simulates your **real-world trading environment** where each stock has its own individual settings for RTH and AH sessions, running from 04:00 to 20:00 ET exactly as it would in production.

## Key Requirements (Based on Your Description)

### 1. Individual Stock Configuration
Each stock needs its own settings:
- **Symbol** (e.g., BTDR, RIOT, MARA, etc.)
- **Method** (EQUAL_MEAN, VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN)
- **RTH Buy %** (e.g., 0.5%)
- **RTH Sell %** (e.g., 0.5%)
- **AH Buy %** (e.g., 0.5%)
- **AH Sell %** (e.g., 0.5%)
- **Enabled/Disabled** toggle

### 2. Global Settings
- **Date Range** (start date, end date)
- **Slippage %** (applies to all stocks)
- **Conservative Rounding** (applies to all stocks)
- **Initial Capital** (default $10,000)

### 3. Dynamic Stock Management
- **"Add Stock" button** - Add new stock configurations
- **"Remove" button** - Remove individual stocks
- **"Load Preset" button** - Load your current live settings
- **"Save Preset" button** - Save current configuration

### 4. Simulation Logic
- **Time Range**: 04:00 - 20:00 ET (full trading day)
- **Session Handling**:
  - RTH: 09:30 - 16:00 (uses RTH thresholds)
  - AH: 04:00 - 09:30 and 16:00 - 20:00 (uses AH thresholds)
- **Multi-Stock Portfolio**:
  - Each stock trades independently with its own settings
  - Shared cash pool (starts at $10,000)
  - When one stock buys, it uses available cash
  - When one stock sells, cash returns to pool
  - Portfolio value = sum of all stock positions + cash

### 5. Results & Visualization
- **Combined Equity Curve**: Shows total portfolio value over time
- **Individual Stock Performance**: Separate lines for each stock
- **Trade Log**: All trades from all stocks chronologically
- **Summary Statistics**:
  - Total portfolio return %
  - Per-stock returns
  - Total trades per stock
  - Win rates per stock
  - Best/worst performing stock

## UI Design

### Input Section
```
┌─────────────────────────────────────────────────────────────┐
│ Live Trading Simulator                                       │
├─────────────────────────────────────────────────────────────┤
│ Global Settings:                                             │
│ [Start Date] [End Date] [Slippage: 0.1%] [✓ Conservative]  │
│                                                              │
│ Stock Configurations:                                        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Stock 1: [BTDR ▼] [WEIGHTED_MEDIAN ▼] [✓ Enabled]   │   │
│ │   RTH: Buy [0.5%] Sell [0.5%]                        │   │
│ │   AH:  Buy [0.5%] Sell [0.5%]                        │   │
│ │   [Remove]                                            │   │
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Stock 2: [RIOT ▼] [EQUAL_MEAN ▼] [✓ Enabled]        │   │
│ │   RTH: Buy [0.6%] Sell [0.4%]                        │   │
│ │   AH:  Buy [0.7%] Sell [0.3%]                        │   │
│ │   [Remove]                                            │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [+ Add Stock] [Load Preset] [Save Preset]                  │
│                                                              │
│ [Run Simulation]                                             │
└─────────────────────────────────────────────────────────────┘
```

### Results Section
```
┌─────────────────────────────────────────────────────────────┐
│ Portfolio Performance                                        │
├─────────────────────────────────────────────────────────────┤
│ Total Return: +144.37% | Final Value: $24,436.96           │
│ Total Trades: 158 | Win Rate: 68.4%                        │
│                                                              │
│ [Equity Curve Chart - Combined Portfolio]                   │
│                                                              │
│ Individual Stock Performance:                                │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Symbol | Method | Return % | Trades | Win Rate | Value │ │
│ │ BTDR   | W_MED  | +144.37% | 158    | 68.4%    | $24K  │ │
│ │ RIOT   | E_MEAN | +89.23%  | 142    | 71.2%    | $18K  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Trade Log - All Stocks Combined]                           │
│ [Export CSV]                                                 │
└─────────────────────────────────────────────────────────────┘
```

## Backend Implementation

### New Endpoint: `/api/live-trading-simulator`

**Request Parameters:**
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
      enabled: boolean;
    }
  ]
}
```

**Processing Logic:**
1. Fetch minute data for all enabled stocks (04:00 - 20:00)
2. Fetch baselines for each stock/method/session combination
3. Initialize portfolio:
   - Cash: $10,000
   - Positions: {} (empty)
4. Process minute-by-minute chronologically:
   - For each minute:
     - For each enabled stock:
       - Determine session (RTH or AH)
       - Get appropriate baseline and thresholds
       - Check for signals
       - Execute trades if conditions met
       - Update portfolio
5. Track equity curve at each minute
6. Generate summary statistics

**Response:**
```typescript
{
  success: boolean;
  portfolio: {
    initialCapital: number;
    finalValue: number;
    totalReturn: number;
    totalReturnPct: number;
  };
  equityCurve: [
    { timestamp: string; equity: number; cash: number; positions: {} }
  ];
  stockPerformance: [
    {
      symbol: string;
      method: string;
      totalReturn: number;
      totalTrades: number;
      winRate: number;
      avgTrade: number;
      bestTrade: number;
      worstTrade: number;
    }
  ];
  trades: [
    {
      timestamp: string;
      symbol: string;
      type: 'BUY' | 'SELL';
      price: number;
      shares: number;
      value: number;
      portfolioValue: number;
    }
  ];
}
```

## Technical Challenges & Solutions

### Challenge 1: Shared Cash Pool
**Problem**: Multiple stocks competing for same cash
**Solution**: 
- Process trades in chronological order
- Check available cash before each buy
- If insufficient cash, skip trade (log warning)
- Prioritize by signal strength or round-robin

### Challenge 2: Minute-by-Minute Processing
**Problem**: 11 stocks × 960 minutes/day × 30 days = 316,800 data points
**Solution**:
- Use efficient SQL queries with proper indexing
- Process in batches by day
- Cache baseline lookups
- Use database connection pooling

### Challenge 3: Session-Specific Baselines
**Problem**: Each stock needs different baseline for RTH vs AH
**Solution**:
- Pre-fetch all baselines at start
- Store in memory map: `baselines[symbol][method][session][date]`
- Quick lookup during processing

### Challenge 4: Real-Time Equity Tracking
**Problem**: Need portfolio value at every minute
**Solution**:
- Track positions and cash continuously
- Calculate equity = cash + sum(position_value)
- Store snapshots at key points (trades, end of day)

## File Structure

### Backend
- `api-server/live-trading-simulator-endpoint.js` (~500 lines)
  - Main simulation engine
  - Portfolio management
  - Trade execution logic
  - Statistics calculation

### Frontend
- `frontend-dashboard/app/reports/live-trading-simulator/page.tsx` (~800 lines)
  - Stock configuration UI
  - Dynamic add/remove stocks
  - Preset management
  - Results visualization
  - Trade log table

### Types
- `frontend-dashboard/lib/api.ts`
  - Add LiveTradingSimulatorRequest interface
  - Add LiveTradingSimulatorResponse interface

## Development Phases

### Phase 1: Backend Core (3-4 hours)
- [ ] Create endpoint structure
- [ ] Implement minute data fetching
- [ ] Build portfolio management system
- [ ] Implement trade execution logic
- [ ] Add session-specific threshold handling

### Phase 2: Backend Statistics (1-2 hours)
- [ ] Calculate equity curve
- [ ] Generate per-stock statistics
- [ ] Create trade log
- [ ] Add summary metrics

### Phase 3: Frontend UI (3-4 hours)
- [ ] Build stock configuration form
- [ ] Add/remove stock functionality
- [ ] Global settings inputs
- [ ] Preset save/load (localStorage)
- [ ] Form validation

### Phase 4: Frontend Results (2-3 hours)
- [ ] Equity curve chart (Recharts)
- [ ] Summary statistics cards
- [ ] Per-stock performance table
- [ ] Trade log table with sorting
- [ ] CSV export

### Phase 5: Testing & Polish (1-2 hours)
- [ ] Test with single stock
- [ ] Test with multiple stocks
- [ ] Test cash constraints
- [ ] Test edge cases
- [ ] Performance optimization

**Total Estimated Time: 10-15 hours**

## Example Use Cases

### Use Case 1: Current Live Settings
```javascript
stocks: [
  { symbol: 'BTDR', method: 'WEIGHTED_MEDIAN', rthBuy: 0.5, rthSell: 0.5, ahBuy: 0.5, ahSell: 0.5 },
  { symbol: 'RIOT', method: 'EQUAL_MEAN', rthBuy: 0.6, rthSell: 0.4, ahBuy: 0.7, ahSell: 0.3 },
  // ... 9 more stocks
]
```

### Use Case 2: Testing New Strategy
```javascript
stocks: [
  { symbol: 'MARA', method: 'VWAP_RATIO', rthBuy: 1.0, rthSell: 1.0, ahBuy: 0.5, ahSell: 0.5 },
]
```

### Use Case 3: Comparing Methods
```javascript
stocks: [
  { symbol: 'HIVE', method: 'EQUAL_MEAN', rthBuy: 0.5, rthSell: 0.5, ahBuy: 0.5, ahSell: 0.5 },
  { symbol: 'HIVE', method: 'VWAP_RATIO', rthBuy: 0.5, rthSell: 0.5, ahBuy: 0.5, ahSell: 0.5 },
]
```

## Next Steps

1. **Confirm Requirements**: Review this plan and confirm it matches your vision
2. **Clarify Details**: 
   - How should cash allocation work when multiple stocks signal at same time?
   - Should we support fractional shares or whole shares only?
   - What happens if a stock tries to buy but insufficient cash?
3. **Begin Implementation**: Start with Phase 1 (Backend Core)

---

**This report will give you a true simulation of your live trading environment, allowing you to:**
- Test different stock combinations
- Optimize individual stock settings
- Understand portfolio-level performance
- Validate strategies before going live
- Compare historical performance to actual results