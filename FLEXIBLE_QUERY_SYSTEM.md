# Flexible Query System - The Power of Event-Based State Changes

## Core Concept

By storing only BUY/SELL events (state changes), we can reconstruct portfolio state at ANY point in time and analyze ANY time window, regardless of:
- Start time (9:30am, 11am, 2pm, etc.)
- End time (4pm, 8pm, next day, etc.)
- Baseline method (can switch mid-day)
- Session (can switch RTH → AH)
- Date ranges (continuous or gaps)

## How It Works

### State Reconstruction Algorithm

```javascript
function reconstructPortfolio(events, startTime, endTime) {
  // Filter events in time window
  const relevantEvents = events.filter(e => 
    e.timestamp >= startTime && e.timestamp <= endTime
  );
  
  // Start with initial state
  let state = {
    cash: 10000,
    shares: 0,
    position: 'CASH' // or 'SHARES'
  };
  
  // Apply each event sequentially
  for (const event of relevantEvents) {
    if (event.type === 'BUY' && state.position === 'CASH') {
      state.cash -= event.transaction_value;
      state.shares = event.shares;
      state.position = 'SHARES';
    }
    else if (event.type === 'SELL' && state.position === 'SHARES') {
      state.cash += event.transaction_value;
      state.shares = 0;
      state.position = 'CASH';
    }
  }
  
  return state;
}
```

### Key Insight: Position-Based Event Matching

```
Current State: CASH
  → Look for: Next BUY event
  → After BUY: State = SHARES

Current State: SHARES
  → Look for: Next SELL event
  → After SELL: State = CASH
```

## Powerful Use Cases

### 1. Custom Time Windows
```sql
-- Analyze only 11am-2pm trading
SELECT * FROM get_trade_events(
  'HIVE', 'EQUAL_MEAN', 'RTH', 0.5, 0.5,
  '2024-01-01', '2024-12-31'
)
WHERE event_timestamp::time BETWEEN '11:00:00' AND '14:00:00';
```

### 2. Session Transitions
```sql
-- Analyze RTH → AH transition (3:30pm - 4:30pm)
SELECT * FROM get_trade_events(
  'HIVE', 'EQUAL_MEAN', 'ALL', 0.5, 0.5,
  '2024-01-01', '2024-12-31'
)
WHERE event_timestamp::time BETWEEN '15:30:00' AND '16:30:00';
```

### 3. BTC Price Impact Analysis
```sql
-- Find all BUY events when BTC > $50k
SELECT 
  event_timestamp,
  btc_price,
  stock_price,
  ratio,
  shares,
  transaction_value
FROM trade_events
WHERE event_type = 'BUY'
  AND btc_price > 50000
ORDER BY btc_price DESC;

-- Compare ROI when BTC is high vs low
WITH high_btc_events AS (
  SELECT * FROM trade_events WHERE btc_price > 50000
),
low_btc_events AS (
  SELECT * FROM trade_events WHERE btc_price < 40000
)
SELECT 
  'High BTC' as condition,
  AVG(total_value - 10000) as avg_profit
FROM high_btc_events
UNION ALL
SELECT 
  'Low BTC' as condition,
  AVG(total_value - 10000) as avg_profit
FROM low_btc_events;
```

### 4. Intraday Pattern Analysis
```sql
-- Find best performing hour of day
SELECT 
  EXTRACT(HOUR FROM event_timestamp) as hour,
  COUNT(*) as event_count,
  AVG(CASE WHEN event_type = 'SELL' 
    THEN total_value - LAG(total_value) OVER (ORDER BY event_timestamp)
    ELSE 0 END) as avg_profit_per_sell
FROM trade_events
WHERE symbol = 'HIVE'
GROUP BY hour
ORDER BY avg_profit_per_sell DESC;
```

### 5. Gap Analysis
```sql
-- Analyze overnight gaps (last event of day vs first event next day)
WITH daily_closes AS (
  SELECT 
    DATE(event_timestamp) as trading_day,
    LAST_VALUE(total_value) OVER (
      PARTITION BY DATE(event_timestamp)
      ORDER BY event_timestamp
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as close_value
  FROM trade_events
  WHERE symbol = 'HIVE'
),
daily_opens AS (
  SELECT 
    DATE(event_timestamp) as trading_day,
    FIRST_VALUE(total_value) OVER (
      PARTITION BY DATE(event_timestamp)
      ORDER BY event_timestamp
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as open_value
  FROM trade_events
  WHERE symbol = 'HIVE'
)
SELECT 
  c.trading_day,
  c.close_value,
  o.open_value,
  o.open_value - c.close_value as overnight_gap
FROM daily_closes c
JOIN daily_opens o ON o.trading_day = c.trading_day + INTERVAL '1 day';
```

### 6. Dynamic Baseline Switching
```sql
-- Simulate switching from EQUAL_MEAN to VWAP_RATIO at 2pm
WITH rth_events AS (
  SELECT * FROM trade_events
  WHERE method = 'EQUAL_MEAN'
    AND session = 'RTH'
    AND event_timestamp::time < '14:00:00'
),
ah_events AS (
  SELECT * FROM trade_events
  WHERE method = 'VWAP_RATIO'
    AND session = 'AH'
    AND event_timestamp::time >= '14:00:00'
)
SELECT * FROM rth_events
UNION ALL
SELECT * FROM ah_events
ORDER BY event_timestamp;
```

## Advanced Query Patterns

### Portfolio State at Any Moment
```sql
-- What was portfolio state at exactly 2:30pm on Jan 15?
SELECT 
  event_timestamp,
  event_type,
  cash_balance,
  shares_held,
  total_value
FROM trade_events
WHERE symbol = 'HIVE'
  AND method = 'EQUAL_MEAN'
  AND session = 'RTH'
  AND buy_pct = 0.5
  AND sell_pct = 0.5
  AND event_timestamp <= '2024-01-15 14:30:00'
ORDER BY event_timestamp DESC
LIMIT 1;
```

### Event Frequency Analysis
```sql
-- How often do we trade in different time windows?
SELECT 
  CASE 
    WHEN EXTRACT(HOUR FROM event_timestamp) BETWEEN 9 AND 11 THEN 'Morning (9-11am)'
    WHEN EXTRACT(HOUR FROM event_timestamp) BETWEEN 11 AND 13 THEN 'Midday (11am-1pm)'
    WHEN EXTRACT(HOUR FROM event_timestamp) BETWEEN 13 AND 15 THEN 'Afternoon (1-3pm)'
    ELSE 'Late (3-4pm)'
  END as time_window,
  COUNT(*) as event_count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM trade_events
WHERE symbol = 'HIVE'
GROUP BY time_window
ORDER BY event_count DESC;
```

### Holding Period Analysis
```sql
-- How long do we typically hold positions?
WITH buy_sell_pairs AS (
  SELECT 
    b.event_timestamp as buy_time,
    s.event_timestamp as sell_time,
    EXTRACT(EPOCH FROM (s.event_timestamp - b.event_timestamp))/3600 as hours_held,
    s.total_value - b.total_value as profit
  FROM trade_events b
  JOIN trade_events s ON 
    s.symbol = b.symbol AND
    s.method = b.method AND
    s.session = b.session AND
    s.buy_pct = b.buy_pct AND
    s.sell_pct = b.sell_pct AND
    s.event_timestamp > b.event_timestamp AND
    s.event_type = 'SELL'
  WHERE b.event_type = 'BUY'
    AND b.symbol = 'HIVE'
)
SELECT 
  AVG(hours_held) as avg_hours_held,
  MIN(hours_held) as min_hours_held,
  MAX(hours_held) as max_hours_held,
  AVG(profit) as avg_profit_per_trade
FROM buy_sell_pairs;
```

## API Enhancements for Flexible Queries

### New Endpoint: Custom Time Window Query
```javascript
// GET /api/events/custom-window
// Query events within specific time window across multiple days

router.get('/custom-window', async (req, res) => {
  const { 
    symbol, method, session, buyPct, sellPct,
    startDate, endDate,
    startTime, endTime  // NEW: Time filters
  } = req.query;
  
  const query = `
    SELECT * FROM trade_events
    WHERE symbol = $1
      AND method = $2
      AND session = $3
      AND buy_pct = $4
      AND sell_pct = $5
      AND event_timestamp::date BETWEEN $6 AND $7
      AND event_timestamp::time BETWEEN $8 AND $9
    ORDER BY event_timestamp
  `;
  
  const result = await req.db.query(query, [
    symbol, method, session, 
    parseFloat(buyPct), parseFloat(sellPct),
    startDate, endDate,
    startTime, endTime
  ]);
  
  res.json({ events: result.rows });
});
```

### New Endpoint: BTC Price Impact Analysis
```javascript
// GET /api/events/btc-impact
// Analyze how BTC price affects trading decisions

router.get('/btc-impact', async (req, res) => {
  const { symbol, method, session, buyPct, sellPct, startDate, endDate } = req.query;
  
  const query = `
    WITH price_buckets AS (
      SELECT 
        CASE 
          WHEN btc_price < 40000 THEN 'Low (<40k)'
          WHEN btc_price < 50000 THEN 'Medium (40-50k)'
          ELSE 'High (>50k)'
        END as btc_range,
        event_type,
        COUNT(*) as event_count,
        AVG(ratio) as avg_ratio
      FROM trade_events
      WHERE symbol = $1
        AND method = $2
        AND session = $3
        AND buy_pct = $4
        AND sell_pct = $5
        AND event_timestamp::date BETWEEN $6 AND $7
      GROUP BY btc_range, event_type
    )
    SELECT * FROM price_buckets
    ORDER BY btc_range, event_type
  `;
  
  const result = await req.db.query(query, [
    symbol, method, session,
    parseFloat(buyPct), parseFloat(sellPct),
    startDate, endDate
  ]);
  
  res.json({ analysis: result.rows });
});
```

## Benefits of This Approach

### 1. Ultimate Flexibility
- Start/stop analysis at ANY time
- Mix different strategies mid-stream
- Analyze custom time windows
- Study specific market conditions

### 2. Deep Insights
- BTC price impact on decisions
- Intraday trading patterns
- Holding period analysis
- Session transition effects
- Overnight gap analysis

### 3. Fast Queries
- Events are indexed by timestamp
- Only scan relevant events
- No need to process entire days
- Sub-second query times

### 4. Scalability
- Add new analysis types without reprocessing
- Query patterns are composable
- Can build complex analyses from simple queries
- Easy to add new metrics

## Example: Complete Custom Analysis

```sql
-- Find best performing strategy for morning trading (9:30-11am)
-- when BTC is above $45k

WITH morning_events AS (
  SELECT 
    symbol,
    method,
    session,
    buy_pct,
    sell_pct,
    event_timestamp,
    event_type,
    btc_price,
    total_value
  FROM trade_events
  WHERE event_timestamp::time BETWEEN '09:30:00' AND '11:00:00'
    AND btc_price > 45000
    AND event_timestamp::date BETWEEN '2024-01-01' AND '2024-12-31'
),
strategy_performance AS (
  SELECT 
    symbol,
    method,
    session,
    buy_pct,
    sell_pct,
    COUNT(*) as trade_count,
    MAX(total_value) - MIN(total_value) as profit
  FROM morning_events
  GROUP BY symbol, method, session, buy_pct, sell_pct
)
SELECT *
FROM strategy_performance
WHERE trade_count > 10  -- At least 10 trades
ORDER BY profit DESC
LIMIT 10;
```

## Conclusion

Your insight is **exactly right** - by storing state changes (events), we can:
- ✅ Query any time window
- ✅ Switch strategies mid-stream
- ✅ Analyze BTC price impact
- ✅ Study intraday patterns
- ✅ Reconstruct state at any moment
- ✅ Build unlimited custom analyses

This is the **most flexible and powerful** approach possible! 🚀