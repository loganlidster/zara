# Fast Daily BTC Overlay Report - Implementation Plan

## Overview
Build a Next.js/React version of the Streamlit "Fast Daily BTC Overlay" report that visualizes stock prices with BTC overlay and shows trading signals based on ratio-based strategies.

## Current System Analysis

### Database Tables (PostgreSQL)
- ✅ `minute_stock` - Stock minute bars (symbol, et_date, et_time, open, high, low, close, volume, vwap, trades, session, source)
- ✅ `minute_btc` - BTC minute bars (et_date, et_time, open, high, low, close, volume, vwap, trades, session, source)
- ✅ `baseline_daily` - Pre-calculated baselines (symbol, session, trading_day, method, baseline, sample_count, min_ratio, max_ratio, std_dev)
- ✅ `trading_calendar` - Trading days with prev_open_date for lagging baseline strategy

### Existing Backend (api-server/fast-daily-endpoint.js)
**Current Capabilities:**
- Grid search across buy/sell threshold combinations
- Session filtering (RTH/AH/ALL/CUSTOM)
- Session-specific thresholds for ALL mode
- Conservative pricing (round up for buys, down for sells)
- Slippage support
- Trade simulation with entry/exit tracking
- Returns best per stock and overall best

**What It Does:**
1. Fetches minute data for a single date
2. Gets baseline from PREVIOUS trading day (lagging strategy)
3. Simulates trades for all threshold combinations
4. Returns aggregated results (best per stock, overall best)

**What It Doesn't Do:**
- Return minute-by-minute data for charting
- Return individual trade markers with timestamps
- Support multi-day date ranges
- Return baseline values for visualization

## Implementation Plan

### Phase 1: Backend API Enhancements

#### 1.1 Create `/api/btc-overlay-data` Endpoint
**Purpose:** Fetch minute-by-minute data for charting

**Request:**
```json
{
  "symbol": "RIOT",
  "startDate": "2024-10-24",
  "endDate": "2024-10-29",
  "sessionType": "RTH|AH|ALL",
  "customStart": "09:30:00",  // optional
  "customEnd": "16:00:00"     // optional
}
```

**Response:**
```json
{
  "success": true,
  "symbol": "RIOT",
  "data": [
    {
      "timestamp": "2024-10-24T09:30:00",
      "et_date": "2024-10-24",
      "et_time": "09:30:00",
      "stock_price": 12.50,
      "btc_price": 67500.00,
      "ratio": 5400.00,
      "session": "RTH"
    },
    // ... more minutes
  ]
}
```

**SQL Query:**
```sql
SELECT 
  s.et_date,
  s.et_time,
  s.close as stock_price,
  b.close as btc_price,
  (b.close / s.close) as ratio,
  s.session
FROM minute_stock s
JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
WHERE s.symbol = $1
  AND s.et_date BETWEEN $2 AND $3
  AND [session filter]
ORDER BY s.et_date, s.et_time
```

#### 1.2 Create `/api/baseline-values` Endpoint
**Purpose:** Get baseline values for visualization

**Request:**
```json
{
  "symbol": "RIOT",
  "startDate": "2024-10-24",
  "endDate": "2024-10-29",
  "method": "VWAP_RATIO",
  "sessionType": "RTH|AH|ALL"
}
```

**Response:**
```json
{
  "success": true,
  "baselines": [
    {
      "date": "2024-10-24",
      "session": "RTH",
      "baseline": 5400.00,
      "sample_count": 390
    },
    // ... more days
  ]
}
```

**SQL Query:**
```sql
SELECT 
  b.trading_day as date,
  b.session,
  b.baseline,
  b.sample_count
FROM baseline_daily b
WHERE b.symbol = $1
  AND b.trading_day BETWEEN $2 AND $3
  AND b.method = $4
  AND [session filter]
ORDER BY b.trading_day, b.session
```

#### 1.3 Create `/api/simulate-trades-detailed` Endpoint
**Purpose:** Run simulation and return trade markers for chart

**Request:**
```json
{
  "symbol": "RIOT",
  "startDate": "2024-10-24",
  "endDate": "2024-10-29",
  "method": "VWAP_RATIO",
  "buyThreshold": 0.5,
  "sellThreshold": 1.0,
  "sessionType": "RTH",
  "conservativePricing": true,
  "slippage": 0.0,
  "rthBuyPct": 0.5,    // for ALL session
  "rthSellPct": 1.0,   // for ALL session
  "ahBuyPct": 0.8,     // for ALL session
  "ahSellPct": 1.5     // for ALL session
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalReturn": 15.5,
    "tradeCount": 8,
    "winRate": 62.5,
    "avgReturn": 1.94
  },
  "trades": [
    {
      "entryDate": "2024-10-24",
      "entryTime": "10:15:00",
      "entryPrice": 12.50,
      "entryBaseline": 5400.00,
      "entryBtcPrice": 67500.00,
      "exitDate": "2024-10-24",
      "exitTime": "14:30:00",
      "exitPrice": 12.75,
      "exitBaseline": 5400.00,
      "exitBtcPrice": 67200.00,
      "return": 2.0,
      "stockDelta": 2.0,
      "btcDelta": -0.44,
      "session": "RTH"
    },
    // ... more trades
  ],
  "equity": [
    {
      "date": "2024-10-24",
      "startEquity": 10000,
      "endEquity": 10200,
      "dayReturn": 2.0
    },
    // ... more days
  ]
}
```

**Implementation:**
- Extend existing simulateSingleCombination function
- Track equity curve day-by-day
- Return detailed trade information
- Support multi-day simulation

### Phase 2: Frontend Components

#### 2.1 Main Report Page (`/reports/fast-daily-btc-overlay`)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Fast Daily BTC Overlay Report                     │
├─────────────────────────────────────────────────────┤
│  Controls Panel                                     │
│  ┌──────────┬──────────┬──────────┬──────────┐    │
│  │ Symbol   │ Method   │ Session  │ Dates    │    │
│  └──────────┴──────────┴──────────┴──────────┘    │
│  ┌──────────┬──────────┬──────────┬──────────┐    │
│  │ Buy %    │ Sell %   │ Pricing  │ Slippage │    │
│  └──────────┴──────────┴──────────┴──────────┘    │
│  [Run Simulation] [Export CSV]                     │
├─────────────────────────────────────────────────────┤
│  Main Chart (Dual Axis)                            │
│  ┌───────────────────────────────────────────────┐ │
│  │  Stock Price (Left Axis)                      │ │
│  │  BTC Price (Right Axis)                       │ │
│  │  Baseline Lines                               │ │
│  │  Buy/Sell Markers                             │ │
│  └───────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Summary Statistics                                 │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┐      │
│  │Total │Trades│Win   │Avg   │Best  │Worst │      │
│  │Return│      │Rate  │Return│Trade │Trade │      │
│  └──────┴──────┴──────┴──────┴──────┴──────┘      │
├─────────────────────────────────────────────────────┤
│  Equity Curve Chart                                 │
│  ┌───────────────────────────────────────────────┐ │
│  │  Equity over time                             │ │
│  └───────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Trade List (Expandable)                           │
│  ┌───────────────────────────────────────────────┐ │
│  │  Entry | Exit | Return | Stock Δ | BTC Δ     │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 2.2 Component Structure

**File: `frontend-dashboard/app/reports/fast-daily-btc-overlay/page.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DualAxisChart from '@/components/charts/DualAxisChart';
import EquityCurveChart from '@/components/charts/EquityCurveChart';
import TradeList from '@/components/TradeList';
import SummaryStats from '@/components/SummaryStats';

export default function FastDailyBtcOverlay() {
  // State management
  const [symbol, setSymbol] = useState('RIOT');
  const [method, setMethod] = useState('VWAP_RATIO');
  const [sessionType, setSessionType] = useState('RTH');
  const [startDate, setStartDate] = useState('2024-10-24');
  const [endDate, setEndDate] = useState('2024-10-29');
  const [buyThreshold, setBuyThreshold] = useState(0.5);
  const [sellThreshold, setSellThreshold] = useState(1.0);
  
  // Data state
  const [minuteData, setMinuteData] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Fetch and render logic
  // ...
}
```

#### 2.3 Chart Components

**DualAxisChart Component:**
- Use Recharts or Chart.js
- Left Y-axis: Stock price
- Right Y-axis: BTC price
- Overlay baseline lines
- Add markers for buy/sell signals
- Tooltip showing all values at hover point

**EquityCurveChart Component:**
- Line chart showing equity over time
- Start at $10,000
- Show daily returns
- Highlight winning/losing days

#### 2.4 Control Components

**Controls Panel:**
- Symbol selector (dropdown with available symbols)
- Method selector (VWAP_RATIO, VOL_WEIGHTED, etc.)
- Session selector (RTH, AH, ALL, CUSTOM)
- Date range picker (start/end dates)
- Threshold inputs (buy %, sell %)
- Advanced options (conservative pricing, slippage)
- Session-specific thresholds (for ALL mode)

### Phase 3: Data Flow

```
User Input
    ↓
Frontend State Update
    ↓
API Call to /api/btc-overlay-data
    ↓
Fetch minute data + BTC prices
    ↓
Display on chart
    ↓
User clicks "Run Simulation"
    ↓
API Call to /api/baseline-values
    ↓
Get baseline for date range
    ↓
API Call to /api/simulate-trades-detailed
    ↓
Run simulation, get trades
    ↓
Update chart with markers
    ↓
Display summary stats
    ↓
Show trade list
```

### Phase 4: Key Features

#### 4.1 Interactive Chart
- Zoom/pan functionality
- Crosshair with values
- Toggle layers (stock, BTC, baseline, trades)
- Export chart as image

#### 4.2 Real-time Simulation
- Run simulation on button click
- Show loading state
- Display results immediately
- Update all visualizations

#### 4.3 Export Functionality
- Export trade list as CSV
- Export chart data as CSV
- Export summary statistics

#### 4.4 Session-Specific Thresholds
- When session = ALL, show additional inputs
- RTH Buy %, RTH Sell %
- AH Buy %, AH Sell %
- Use appropriate threshold based on bar's session

### Phase 5: Implementation Steps

1. **Backend APIs** (2-3 hours)
   - Create btc-overlay-data endpoint
   - Create baseline-values endpoint
   - Enhance simulate-trades-detailed endpoint
   - Test with Postman/curl

2. **Frontend Structure** (1 hour)
   - Create page component
   - Set up state management
   - Create layout structure

3. **Chart Components** (3-4 hours)
   - Build DualAxisChart with Recharts
   - Build EquityCurveChart
   - Add interactivity
   - Style and polish

4. **Controls** (2 hours)
   - Build all input controls
   - Add validation
   - Connect to state

5. **Data Integration** (2 hours)
   - Connect APIs to frontend
   - Handle loading states
   - Error handling
   - Data transformation

6. **Summary & Trade List** (1-2 hours)
   - Build summary stats component
   - Build trade list table
   - Add sorting/filtering

7. **Polish & Testing** (2-3 hours)
   - Responsive design
   - Loading states
   - Error messages
   - Edge cases
   - Cross-browser testing

**Total Estimated Time: 13-17 hours**

### Phase 6: Technical Decisions

#### Chart Library
**Recommendation: Recharts**
- React-native
- Good TypeScript support
- Dual-axis support
- Customizable
- Active maintenance

**Alternative: Chart.js with react-chartjs-2**
- More features
- Better performance for large datasets
- More complex API

#### State Management
**Recommendation: React useState + useEffect**
- Simple for this use case
- No need for Redux/Zustand
- Easy to understand

#### Styling
**Recommendation: Tailwind CSS + shadcn/ui**
- Already in use
- Consistent with existing dashboard
- Fast development

### Phase 7: Testing Strategy

1. **Unit Tests**
   - API endpoint tests
   - Component rendering tests
   - Calculation tests

2. **Integration Tests**
   - Full flow tests
   - API integration tests

3. **Manual Testing**
   - Test with real data
   - Test edge cases
   - Test different date ranges
   - Test all session types

### Phase 8: Deployment

1. **Backend**
   - Add new endpoints to server.js
   - Deploy to Cloud Run
   - Test in production

2. **Frontend**
   - Build Next.js app
   - Deploy to Vercel
   - Test in production

3. **Documentation**
   - User guide
   - API documentation
   - Code comments

## Next Steps

1. ✅ Complete analysis (DONE)
2. Create backend API endpoints
3. Build frontend components
4. Integrate and test
5. Deploy to production

## Questions to Resolve

1. Should we support multiple symbols on one chart?
2. Should we add comparison mode (compare different methods)?
3. Should we add alerts/notifications for signals?
4. Should we add backtesting over longer periods?
5. Should we add optimization features (find best thresholds)?

## Success Criteria

- ✅ User can select symbol, date range, method, thresholds
- ✅ Chart displays stock price, BTC price, and baseline
- ✅ Simulation runs and shows trade markers
- ✅ Summary statistics are accurate
- ✅ Trade list is complete and exportable
- ✅ Performance is acceptable (< 3 seconds for simulation)
- ✅ UI is intuitive and responsive