# Two Table Design: RTH + AH

## Architecture

### Two Separate Tables
1. **precomputed_trades_grid_rth** - Regular Trading Hours (09:30-16:00)
2. **precomputed_trades_grid_ah** - After Hours (04:00-09:30, 16:00-20:00)

### Why Two Tables?

**Advantages:**
- ✅ Each session has independent baselines (RTH baseline ≠ AH baseline)
- ✅ Can precompute 900 combinations for each session
- ✅ Simple queries for single-session strategies
- ✅ Flexible mixing of different strategies per session

**Use Cases:**
1. **Single Session**: Query one table directly
2. **Mixed Strategy**: Query both tables and merge chronologically
3. **Continuous Wallet**: Replay merged trades with running balance

## Usage Patterns

### Pattern 1: Single Session Query (Simple)

```sql
-- Get all RTH trades for HIVE EQUAL_MEAN 0.5%/1.0%
SELECT * FROM precomputed_trades_grid_rth
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND buy_pct = 0.5
  AND sell_pct = 1.0
  AND entry_date BETWEEN '2025-09-01' AND '2025-09-30'
ORDER BY entry_date, entry_time;
```

### Pattern 2: Mixed Strategy (Advanced)

**Scenario:** Use different strategies for RTH vs AH
- RTH: EQUAL_MEAN 0.5% buy / 1.0% sell
- AH: WINSORIZED 1.2% buy / 0.8% sell

```sql
-- Step 1: Get RTH trades
SELECT 
  'RTH' as session,
  entry_date,
  entry_time,
  entry_price,
  exit_date,
  exit_time,
  exit_price,
  shares,
  trade_return_dollars
FROM precomputed_trades_grid_rth
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND buy_pct = 0.5
  AND sell_pct = 1.0

UNION ALL

-- Step 2: Get AH trades
SELECT 
  'AH' as session,
  entry_date,
  entry_time,
  entry_price,
  exit_date,
  exit_time,
  exit_price,
  shares,
  trade_return_dollars
FROM precomputed_trades_grid_ah
WHERE symbol = 'HIVE'
  AND method = 'WINSORIZED'
  AND buy_pct = 1.2
  AND sell_pct = 0.8

-- Step 3: Order chronologically
ORDER BY entry_date, entry_time;
```

### Pattern 3: Continuous Wallet Simulation

For a truly continuous wallet across sessions, we need to:
1. Query both tables
2. Merge chronologically
3. Replay with running cash/shares balance

**This requires application logic** (can't do in pure SQL):

```javascript
// Pseudo-code for continuous wallet
async function simulateContinuousWallet(symbol, rthConfig, ahConfig, startDate, endDate) {
  // Get all trades from both tables
  const rthTrades = await queryRTHTrades(symbol, rthConfig);
  const ahTrades = await queryAHTrades(symbol, ahConfig);
  
  // Merge and sort chronologically
  const allTrades = [...rthTrades, ...ahTrades].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date - b.entry_date;
    return a.entry_time - b.entry_time;
  });
  
  // Replay with continuous wallet
  let cash = 10000;
  let shares = 0;
  const results = [];
  
  for (const trade of allTrades) {
    // Check if we can execute this trade
    if (trade.action === 'BUY' && cash >= trade.entry_price * trade.shares) {
      cash -= trade.entry_price * trade.shares;
      shares += trade.shares;
      results.push({...trade, executed: true, cash, shares});
    } else if (trade.action === 'SELL' && shares >= trade.shares) {
      cash += trade.exit_price * trade.shares;
      shares -= trade.shares;
      results.push({...trade, executed: true, cash, shares});
    } else {
      results.push({...trade, executed: false, reason: 'Insufficient funds/shares'});
    }
  }
  
  return results;
}
```

## Data Structure

### Each Table Contains:
```
symbol, method, buy_pct, sell_pct,
entry_date, entry_time, entry_price, entry_baseline, entry_ratio, entry_btc_price,
exit_date, exit_time, exit_price, exit_baseline, exit_ratio, exit_btc_price,
shares, trade_return_pct, trade_return_dollars, stock_delta_pct, btc_delta_pct
```

### Key Points:
- Each trade is **independent** (assumes starting with cash)
- Each table has **900 combinations** per symbol/method
- Trades are **session-specific** (RTH baseline for RTH trades, AH baseline for AH trades)

## Processing Strategy

### Grid Processor Flow:
1. For each symbol (HIVE, RIOT, etc.)
2. For each method (EQUAL_MEAN, etc.)
3. For each session (RTH, AH)
4. For each buy% (0.1 to 3.0)
5. For each sell% (0.1 to 3.0)
6. Calculate all trades and insert into appropriate table

**Total:** 11 symbols × 5 methods × 2 sessions × 900 combos = **99,000 combinations**

## API Endpoints

### Simple Single-Session Query
```
GET /api/grid-trades?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buy=0.5&sell=1.0
```

### Mixed Strategy Query
```
POST /api/grid-trades-mixed
{
  "symbol": "HIVE",
  "rth": { "method": "EQUAL_MEAN", "buy": 0.5, "sell": 1.0 },
  "ah": { "method": "WINSORIZED", "buy": 1.2, "sell": 0.8 },
  "startDate": "2025-09-01",
  "endDate": "2025-09-30"
}
```

### Continuous Wallet Simulation
```
POST /api/simulate-continuous
{
  "symbol": "HIVE",
  "rth": { "method": "EQUAL_MEAN", "buy": 0.5, "sell": 1.0 },
  "ah": { "method": "WINSORIZED", "buy": 1.2, "sell": 0.8 },
  "startDate": "2025-09-01",
  "endDate": "2025-09-30",
  "startingCash": 10000
}
```

## Benefits

1. **Flexibility**: Mix and match RTH/AH strategies
2. **Performance**: Fast queries for single-session strategies
3. **Accuracy**: Each session uses its own baseline
4. **Scalability**: Can add more sessions later (pre-market, extended hours)
5. **Simplicity**: Each table is independent and easy to understand

## Migration Path

1. ✅ Create two tables (RTH, AH)
2. ✅ Run grid processor to populate both
3. ⏳ Build simple API endpoints (single session)
4. ⏳ Build mixed strategy API endpoints
5. ⏳ Build continuous wallet simulation
6. ⏳ Wire up UI to new endpoints

## Next Steps

1. Run `create_grid_tables_v2.sql` in Cloud SQL
2. Test processor with small date range
3. Verify results match hand calculations
4. Process full historical data
5. Build API endpoints for querying