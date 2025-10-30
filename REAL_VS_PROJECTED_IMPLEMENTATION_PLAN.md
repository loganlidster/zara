# Real vs Projected Trading Report - Implementation Plan

## Overview
Create a powerful new report that compares **simulated (projected) results** against **actual live trading results** from Alpaca. This will help you:
1. Validate your trading strategy
2. Measure actual slippage
3. Identify execution differences
4. Optimize settings based on real performance

## Data Sources

### 1. Live Trading Database (tradiac-live)
**Connection Details**:
- Host: `35.199.155.114`
- Port: `5432`
- Database: `tradiac`
- Username: `appuser`
- Password: `Fu3lth3j3t!`
- Connection String: `tradiac-live:us-west1:tradiac-sql`

**Tables**:

**A. `public.wallets`** - Wallet configurations
```sql
Columns:
- wallet_id (UUID, primary key)
- user_id (text)
- env (text: "paper" or "live")
- name (text: "Paper V8", "Aaron Live", etc.)
- enabled (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

**B. `public.wallet_symbols`** - Stock settings per wallet
```sql
Columns:
- wallet_id (UUID, foreign key)
- symbol (text: "HIVE", "RIOT", etc.)
- buy_budget_usd (numeric)
- buy_pct_rth (numeric: 0.2 = 0.2%)
- sell_pct_rth (numeric: 0.2 = 0.2%)
- buy_pct_ah (numeric: 0.2 = 0.2%)
- sell_pct_ah (numeric: 0.2 = 0.2%)
- method_rth (text: "EQUAL_MEAN", "VWAP_RATIO", "MEDIAN", etc.)
- method_ah (text: "EQUAL_MEAN", "VOL_WEIGHTED", etc.)
- updated_at (timestamp)
- budget_mode (text: "fixed" or "percent")
- percent_budget (numeric)
- enabled (boolean)
```

**C. `public.execution_orders`** - Orders sent to Alpaca
```sql
Columns (assumed):
- order_id (UUID, primary key)
- wallet_id (UUID)
- symbol (text)
- alpaca_order_id (text) - KEY for matching
- order_type (text: "BUY" or "SELL")
- limit_price (numeric)
- quantity (numeric)
- submitted_at (timestamp)
- status (text)
```

### 2. Alpaca API (Paper Trading)
**API Credentials**:
- API Key: `PKM9CGRKTW3SVUT19YQB`
- Secret Key: `XVGrnhMlsnE83QO1UYLgteUeOsoQ830Ha93xliE7`
- Base URL: `https://paper-api.alpaca.markets`

**Available Endpoints**:
- `GET /v2/orders` - Get all orders (filled, canceled, expired)
- `GET /v2/orders/{order_id}` - Get specific order details
- `GET /v2/positions` - Get current positions
- `GET /v2/account/portfolio/history` - Get portfolio history

**Order Data Structure**:
```json
{
  "id": "b3efa9ea-b714-4340-9d4c-7419f52d8155",
  "client_order_id": "48711402-ecbd-4b3c-9ea1-63b3d4957e65",
  "symbol": "HIVE",
  "qty": "1788",
  "filled_qty": "0",
  "filled_avg_price": null,
  "order_type": "limit",
  "side": "sell",
  "limit_price": "5.57",
  "status": "expired",
  "submitted_at": "2025-10-29T23:59:05.299381Z",
  "filled_at": null,
  "expired_at": "2025-10-30T00:00:02.689739Z"
}
```

### 3. Testing Database (tradiac_testing)
**Current Connection** - Already configured
- Host: `34.41.97.179`
- Database: `tradiac_testing`
- Contains: `minute_stock`, `minute_btc`, `baseline_daily`, `trade_events_*`

## Implementation Phases

### Phase 1: Database Connections (1-2 hours)

**A. Create Live DB Connection Pool**
```javascript
// api-server/live-db.js
import pg from 'pg';

const livePool = new pg.Pool({
  host: '35.199.155.114',
  port: 5432,
  database: 'tradiac',
  user: 'appuser',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

export default livePool;
```

**B. Create Alpaca API Client**
```javascript
// api-server/alpaca-client.js
const ALPACA_API_KEY = 'PKM9CGRKTW3SVUT19YQB';
const ALPACA_SECRET = 'XVGrnhMlsnE83QO1UYLgteUeOsoQ830Ha93xliE7';
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets';

async function getOrders(params) {
  // Fetch orders from Alpaca
}

async function getOrderById(orderId) {
  // Fetch specific order
}
```

### Phase 2: Wallet Loading Endpoint (2-3 hours)

**Endpoint**: `GET /api/wallets`

**Purpose**: Get list of all wallets with their settings

**Response**:
```json
{
  "success": true,
  "wallets": [
    {
      "wallet_id": "05324aa9-e9b7-4f1b-8248-0d544190293e",
      "name": "Paper V8",
      "env": "paper",
      "enabled": true,
      "stocks": [
        {
          "symbol": "BTDR",
          "method_rth": "MEDIAN",
          "method_ah": "EQUAL_MEAN",
          "buy_pct_rth": 0.1,
          "sell_pct_rth": 1.0,
          "buy_pct_ah": 0.1,
          "sell_pct_ah": 1.0,
          "enabled": true
        }
        // ... more stocks
      ]
    }
    // ... more wallets
  ]
}
```

**Implementation**:
1. Query `public.wallets` for all wallets
2. For each wallet, query `public.wallet_symbols` for stock settings
3. Map method names (MEDIAN → WEIGHTED_MEDIAN)
4. Return structured data

### Phase 3: Real vs Projected Comparison Endpoint (4-5 hours)

**Endpoint**: `POST /api/real-vs-projected`

**Request**:
```json
{
  "wallet_id": "05324aa9-e9b7-4f1b-8248-0d544190293e",
  "startDate": "2024-10-01",
  "endDate": "2024-10-31",
  "slippagePct": 0.1,
  "conservativeRounding": true
}
```

**Processing Logic**:

**Step 1: Load Wallet Settings**
```sql
SELECT ws.symbol, ws.method_rth, ws.method_ah, 
       ws.buy_pct_rth, ws.sell_pct_rth,
       ws.buy_pct_ah, ws.sell_pct_ah
FROM public.wallet_symbols ws
WHERE ws.wallet_id = $1 AND ws.enabled = true
```

**Step 2: Run Simulations (Projected)**
- For each stock in wallet:
  - Run Daily Curve simulation with stock's settings
  - Track all projected trades
  - Calculate projected equity curve

**Step 3: Fetch Actual Orders from Alpaca**
```javascript
// Get all orders for date range
const orders = await alpacaClient.getOrders({
  after: startDate,
  until: endDate,
  status: 'all', // filled, canceled, expired
  limit: 500
});

// Filter by wallet's symbols
const relevantOrders = orders.filter(o => 
  walletStocks.includes(o.symbol)
);
```

**Step 4: Match Orders to Execution Table**
```sql
SELECT eo.*, ao.filled_avg_price, ao.filled_qty, ao.status
FROM public.execution_orders eo
LEFT JOIN alpaca_orders ao ON eo.alpaca_order_id = ao.id
WHERE eo.wallet_id = $1
  AND eo.submitted_at >= $2
  AND eo.submitted_at <= $3
```

**Step 5: Calculate Actual Performance**
- Reconstruct actual wallet from filled orders
- Calculate actual equity curve
- Track actual trades with fill prices

**Step 6: Compare & Calculate Slippage**
```javascript
for each projected trade:
  find matching actual trade (by symbol, timestamp, type)
  if found:
    slippage = actual_price - projected_price
    slippage_pct = (slippage / projected_price) * 100
```

**Response**:
```json
{
  "success": true,
  "wallet": {
    "wallet_id": "...",
    "name": "Paper V8",
    "stocks": [...]
  },
  "projected": {
    "dates": ["2024-10-01", ...],
    "equityCurve": [10000, 10050, ...],
    "totalReturn": 4436.96,
    "totalReturnPct": 44.37,
    "totalTrades": 158
  },
  "actual": {
    "dates": ["2024-10-01", ...],
    "equityCurve": [10000, 10030, ...],
    "totalReturn": 4200.00,
    "totalReturnPct": 42.00,
    "totalTrades": 145
  },
  "comparison": {
    "returnDifference": -236.96,
    "returnDifferencePct": -2.37,
    "tradesDifference": -13,
    "avgSlippage": 0.15,
    "avgSlippagePct": 0.12
  },
  "trades": [
    {
      "date": "2024-10-01",
      "time": "14:00:00",
      "symbol": "BTDR",
      "type": "BUY",
      "projected_price": 5.79,
      "actual_price": 5.80,
      "slippage": 0.01,
      "slippage_pct": 0.17,
      "projected_shares": 1727,
      "actual_shares": 1724,
      "status": "filled"
    }
    // ... more trades
  ]
}
```

### Phase 4: Frontend Report (4-5 hours)

**Page**: `/reports/real-vs-projected`

**UI Components**:

**1. Wallet Selection**
```
┌─────────────────────────────────────────┐
│ Select Wallet:                          │
│ [Paper V8 ▼]                           │
│                                         │
│ Date Range:                             │
│ [2024-10-01] to [2024-10-31]           │
│                                         │
│ [Load & Compare]                        │
└─────────────────────────────────────────┘
```

**2. Summary Cards**
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Projected Return │ │ Actual Return    │ │ Difference       │
│ +44.37%          │ │ +42.00%          │ │ -2.37%           │
│ $14,436.96       │ │ $14,200.00       │ │ -$236.96         │
└──────────────────┘ └──────────────────┘ └──────────────────┘

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Projected Trades │ │ Actual Trades    │ │ Avg Slippage     │
│ 158              │ │ 145              │ │ 0.12%            │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

**3. Dual Equity Curve Chart**
```
[Line chart with two lines:]
- Blue line: Projected equity
- Green line: Actual equity
- Shaded area between lines showing difference
```

**4. Trade-by-Trade Comparison Table**
```
┌────────┬────────┬──────┬──────────────┬─────────────┬──────────┬────────┐
│ Date   │ Symbol │ Type │ Projected $  │ Actual $    │ Slippage │ Status │
├────────┼────────┼──────┼──────────────┼─────────────┼──────────┼────────┤
│ 10/01  │ BTDR   │ BUY  │ $5.79        │ $5.80       │ +0.17%   │ Filled │
│ 10/01  │ RIOT   │ SELL │ $12.50       │ $12.48      │ -0.16%   │ Filled │
│ 10/02  │ MARA   │ BUY  │ $18.60       │ Not Filled  │ N/A      │ Expired│
└────────┴────────┴──────┴──────────────┴─────────────┴──────────┴────────┘
```

**5. Slippage Analysis**
```
┌─────────────────────────────────────────┐
│ Slippage Distribution                   │
│ [Histogram showing slippage frequency]  │
│                                         │
│ Average: 0.12%                          │
│ Median: 0.10%                           │
│ Max: 0.45%                              │
│ Min: -0.05%                             │
└─────────────────────────────────────────┘
```

**6. Missed Trades Analysis**
```
┌─────────────────────────────────────────┐
│ Trades Not Executed                     │
│ - 8 expired orders (limit not reached)  │
│ - 3 canceled orders (manual cancel)     │
│ - 2 rejected orders (insufficient funds)│
└─────────────────────────────────────────┘
```

### Phase 5: Slippage Data Collection (2-3 hours)

**New Table**: `public.slippage_analysis` (in tradiac database)

```sql
CREATE TABLE public.slippage_analysis (
  id SERIAL PRIMARY KEY,
  wallet_id UUID NOT NULL,
  trade_date DATE NOT NULL,
  trade_time TIME NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  trade_type VARCHAR(4) NOT NULL, -- BUY or SELL
  projected_price NUMERIC(10, 4),
  actual_price NUMERIC(10, 4),
  slippage NUMERIC(10, 4),
  slippage_pct NUMERIC(10, 4),
  projected_shares INTEGER,
  actual_shares INTEGER,
  alpaca_order_id TEXT,
  execution_order_id UUID,
  status VARCHAR(20), -- filled, expired, canceled
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_slippage_wallet ON public.slippage_analysis(wallet_id);
CREATE INDEX idx_slippage_date ON public.slippage_analysis(trade_date);
CREATE INDEX idx_slippage_symbol ON public.slippage_analysis(symbol);
```

**Auto-Population**:
- Run comparison endpoint daily
- Store all trade comparisons
- Build historical slippage database
- Use for future slippage predictions

## Method Name Mapping

Your live database uses different method names than testing database:

**Mapping**:
```javascript
const METHOD_MAP = {
  'MEDIAN': 'WEIGHTED_MEDIAN',
  'EQUAL_MEAN': 'EQUAL_MEAN',
  'VWAP_RATIO': 'VWAP_RATIO',
  'VOL_WEIGHTED': 'VOL_WEIGHTED',
  'WINSORIZED': 'WINSORIZED'
};
```

## Development Timeline

**Total Estimated Time: 13-18 hours**

- Phase 1: Database Connections (1-2 hours)
- Phase 2: Wallet Loading (2-3 hours)
- Phase 3: Comparison Endpoint (4-5 hours)
- Phase 4: Frontend Report (4-5 hours)
- Phase 5: Slippage Collection (2-3 hours)

## Key Features

✅ **Load Live Settings**: Pull actual wallet configurations  
✅ **Dual Simulation**: Run projected vs actual side-by-side  
✅ **Slippage Measurement**: Calculate actual execution costs  
✅ **Trade Matching**: Link projected trades to actual fills  
✅ **Visual Comparison**: See differences in equity curves  
✅ **Missed Trades**: Identify orders that didn't fill  
✅ **Historical Analysis**: Build slippage database over time  

## Benefits

1. **Validate Strategy**: See if simulations match reality
2. **Optimize Settings**: Adjust thresholds based on actual performance
3. **Measure Costs**: Understand true slippage and execution costs
4. **Improve Accuracy**: Use historical slippage for better projections
5. **Debug Issues**: Identify why actual differs from projected
6. **Build Confidence**: Prove strategy works in real trading

## Next Steps

1. **Confirm Approach**: Review this plan and confirm it matches your vision
2. **Verify Table Structures**: Confirm `execution_orders` table structure
3. **Test Connections**: Verify access to live database
4. **Begin Implementation**: Start with Phase 1 (connections)

---

**This will be a game-changing report for validating and optimizing your trading strategy!**