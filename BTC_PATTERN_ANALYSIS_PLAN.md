# BTC Pattern Analysis System

## Concept

Identify specific BTC market conditions (patterns) and determine which trading strategies perform best/worst during those conditions.

## Use Cases

### 1. BTC Price Movement Patterns
- **Down 3% in 72 hours** - What strategies work when BTC crashes?
- **Up 5% in 24 hours** - What strategies work during BTC pumps?
- **Flat (±1%) for 7 days** - What works during consolidation?
- **Volatile (>2% daily swings)** - What works in choppy markets?

### 2. Day-of-Week Patterns
- **Monday after BTC up weekend** - Best strategies for Monday gaps up
- **Monday after BTC down weekend** - Best strategies for Monday gaps down
- **Friday before volatile weekend** - Should we hold or flatten?

### 3. Trend Patterns
- **BTC in uptrend (>20% over 30 days)** - Bull market strategies
- **BTC in downtrend (<-20% over 30 days)** - Bear market strategies
- **BTC breaking ATH** - Momentum strategies

### 4. Correlation Patterns
- **BTC and stocks moving together** - High correlation periods
- **BTC and stocks diverging** - Low correlation periods

## Architecture

### Phase 1: BTC Aggregated Data Table

**Table: `btc_aggregated`**
```sql
CREATE TABLE btc_aggregated (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  et_date DATE NOT NULL,
  et_time TIME NOT NULL,
  open NUMERIC(12,2),
  high NUMERIC(12,2),
  low NUMERIC(12,2),
  close NUMERIC(12,2),
  volume NUMERIC(20,2),
  interval_minutes INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_btc_agg_date ON btc_aggregated(et_date);
CREATE INDEX idx_btc_agg_timestamp ON btc_aggregated(timestamp);
```

**Data Population:**
- Aggregate existing minute data to 10-minute intervals
- ~140 rows per day (vs 1,440 for minute data)
- Reduces storage by 90% while maintaining pattern visibility

### Phase 2: Pattern Detection System

**Table: `btc_patterns`**
```sql
CREATE TABLE btc_patterns (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(50) NOT NULL,  -- 'price_drop', 'price_surge', 'volatility', etc.
  pattern_name VARCHAR(100) NOT NULL, -- 'Down 3% in 72h', 'Monday Gap Up', etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_price NUMERIC(12,2),
  end_price NUMERIC(12,2),
  price_change_pct NUMERIC(8,4),
  metadata JSONB,  -- Store pattern-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_btc_patterns_type ON btc_patterns(pattern_type);
CREATE INDEX idx_btc_patterns_dates ON btc_patterns(start_date, end_date);
```

**Pattern Detection Scripts:**

1. **Price Movement Detector**
```javascript
// Find all periods where BTC dropped 3% in 72 hours
async function detectPriceDrops(threshold = -3, hours = 72) {
  const patterns = [];
  
  // Query BTC data
  const btcData = await queryBTC();
  
  // Sliding window to find drops
  for (let i = 0; i < btcData.length; i++) {
    const startPrice = btcData[i].close;
    const endIndex = findIndexAfterHours(i, hours);
    
    if (endIndex) {
      const endPrice = btcData[endIndex].close;
      const change = ((endPrice - startPrice) / startPrice) * 100;
      
      if (change <= threshold) {
        patterns.push({
          pattern_type: 'price_drop',
          pattern_name: `Down ${Math.abs(change).toFixed(1)}% in ${hours}h`,
          start_date: btcData[i].et_date,
          end_date: btcData[endIndex].et_date,
          start_price: startPrice,
          end_price: endPrice,
          price_change_pct: change
        });
      }
    }
  }
  
  return patterns;
}
```

2. **Day-of-Week Detector**
```javascript
// Find Mondays after BTC moved significantly over weekend
async function detectWeekendGaps(threshold = 2) {
  const patterns = [];
  
  // Get all Mondays
  const mondays = await getMondays();
  
  for (const monday of mondays) {
    // Get Friday close and Monday open
    const fridayClose = await getBTCClose(getPreviousFriday(monday));
    const mondayOpen = await getBTCOpen(monday);
    
    const change = ((mondayOpen - fridayClose) / fridayClose) * 100;
    
    if (Math.abs(change) >= threshold) {
      patterns.push({
        pattern_type: 'weekend_gap',
        pattern_name: change > 0 ? 'Monday Gap Up' : 'Monday Gap Down',
        start_date: getPreviousFriday(monday),
        end_date: monday,
        start_price: fridayClose,
        end_price: mondayOpen,
        price_change_pct: change,
        metadata: { day_of_week: 'Monday' }
      });
    }
  }
  
  return patterns;
}
```

### Phase 3: Pattern Performance Analysis

**Table: `pattern_performance`**
```sql
CREATE TABLE pattern_performance (
  id SERIAL PRIMARY KEY,
  pattern_id INT REFERENCES btc_patterns(id),
  symbol VARCHAR(10) NOT NULL,
  method VARCHAR(50) NOT NULL,
  session VARCHAR(10) NOT NULL,
  buy_pct NUMERIC(5,2),
  sell_pct NUMERIC(5,2),
  roi_pct NUMERIC(10,4),
  total_trades INT,
  win_rate NUMERIC(5,2),
  max_drawdown NUMERIC(10,4),
  final_equity NUMERIC(12,2),
  rank INT,  -- Rank within this pattern (1 = best)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pattern_perf_pattern ON pattern_performance(pattern_id);
CREATE INDEX idx_pattern_perf_rank ON pattern_performance(pattern_id, rank);
```

**Analysis Process:**

1. **Detect Patterns** - Run pattern detection scripts
2. **For Each Pattern** - Run Best Performers for that date range
3. **Store Results** - Save top 20 best and worst performers
4. **Aggregate** - Calculate average performance across all instances

### Phase 4: UI - BTC Pattern Analysis Report

**Page: `/reports/btc-patterns`**

**Features:**

1. **Pattern Selection**
   - Dropdown: Pattern Type (Price Drop, Price Surge, Weekend Gap, etc.)
   - Slider: Threshold (e.g., -3% to -10% for drops)
   - Slider: Time Window (24h, 48h, 72h, etc.)
   - Button: "Detect Patterns"

2. **Pattern Results Table**
   - Shows all detected pattern instances
   - Columns: Date Range, BTC Change %, Duration
   - Click to see performance for that specific instance

3. **Aggregated Performance**
   - **Best Strategies** - Top 10 across all pattern instances
   - **Worst Strategies** - Bottom 10 across all pattern instances
   - **Consistency Score** - How often a strategy ranks in top 20%

4. **Visualization**
   - Heatmap: Method × Session showing average ROI during pattern
   - Bar chart: Best vs Worst strategies
   - Line chart: Performance over time for top strategies

## API Endpoints

### 1. Detect Patterns
```
POST /api/btc-patterns/detect
Body: {
  patternType: "price_drop",
  threshold: -3,
  timeWindow: 72,
  startDate: "2024-01-01",
  endDate: "2025-10-31"
}
Response: {
  patterns: [
    {
      id: 1,
      start_date: "2024-03-15",
      end_date: "2024-03-18",
      price_change_pct: -3.2
    },
    ...
  ],
  count: 42
}
```

### 2. Analyze Pattern Performance
```
POST /api/btc-patterns/analyze
Body: {
  patternIds: [1, 2, 3, ...],  // Or "all"
  symbols: ["HIVE", "RIOT"],
  methods: ["EQUAL_MEAN", "VWAP_RATIO"],
  sessions: ["RTH", "AH"]
}
Response: {
  bestStrategies: [
    {
      symbol: "HIVE",
      method: "EQUAL_MEAN",
      session: "RTH",
      buy_pct: 2.5,
      sell_pct: 0.8,
      avg_roi: 8.5,
      consistency: 0.85,  // 85% of time in top 20%
      instances: 38       // Appeared in 38 of 42 patterns
    },
    ...
  ],
  worstStrategies: [...],
  patternCount: 42
}
```

### 3. Get Pattern Details
```
GET /api/btc-patterns/:id/performance
Response: {
  pattern: {
    start_date: "2024-03-15",
    end_date: "2024-03-18",
    price_change_pct: -3.2
  },
  topPerformers: [...],
  bottomPerformers: [...]
}
```

## Implementation Phases

### Phase 1: Data Foundation (Week 1)
- [ ] Create `btc_aggregated` table
- [ ] Populate with 10-minute aggregated data
- [ ] Create indexes
- [ ] Test query performance

### Phase 2: Pattern Detection (Week 2)
- [ ] Create `btc_patterns` table
- [ ] Implement price movement detector
- [ ] Implement day-of-week detector
- [ ] Implement trend detector
- [ ] Test pattern detection accuracy

### Phase 3: Performance Analysis (Week 3)
- [ ] Create `pattern_performance` table
- [ ] Implement pattern analysis engine
- [ ] Run analysis for all detected patterns
- [ ] Calculate aggregated metrics

### Phase 4: UI Development (Week 4)
- [ ] Create pattern detection UI
- [ ] Create pattern results table
- [ ] Create aggregated performance view
- [ ] Add visualizations (heatmap, charts)
- [ ] Add export functionality

## Example Queries

### Find all BTC drops >3% in 72 hours
```sql
SELECT * FROM btc_patterns
WHERE pattern_type = 'price_drop'
  AND price_change_pct <= -3
  AND (end_date - start_date) <= 3
ORDER BY price_change_pct ASC;
```

### Get best strategies during BTC drops
```sql
SELECT 
  symbol,
  method,
  session,
  buy_pct,
  sell_pct,
  AVG(roi_pct) as avg_roi,
  COUNT(*) as instances,
  AVG(rank) as avg_rank
FROM pattern_performance pp
JOIN btc_patterns bp ON pp.pattern_id = bp.id
WHERE bp.pattern_type = 'price_drop'
  AND bp.price_change_pct <= -3
GROUP BY symbol, method, session, buy_pct, sell_pct
HAVING COUNT(*) >= 10  -- At least 10 instances
ORDER BY avg_roi DESC
LIMIT 20;
```

## Benefits

1. **Data-Driven Strategy Selection** - Know which strategies work in specific conditions
2. **Risk Management** - Avoid strategies that fail during certain patterns
3. **Market Adaptation** - Adjust strategy based on current BTC conditions
4. **Backtesting** - Validate strategies across historical patterns
5. **Discovery** - Find unexpected correlations between BTC and stock performance

## Next Steps

1. Review and approve plan
2. Create BTC aggregated table
3. Implement pattern detection
4. Build analysis engine
5. Create UI

Ready to start building? 🚀