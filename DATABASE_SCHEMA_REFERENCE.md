# 🗄️ TRADIAC DATABASE SCHEMA REFERENCE

**Source:** tradiac_testing_DB-names.json
**Database:** tradiac_testing
**Instance:** tradiac-testing-db (34.41.97.179)

---

## 📋 TABLE: baseline_daily

**Purpose:** Pre-calculated baseline values for each stock/method/session

| Column | Type | Description |
|--------|------|-------------|
| trading_date | DATE | The trading date |
| symbol | VARCHAR | Stock symbol (RIOT, MARA, etc.) |
| baseline_method | VARCHAR | Calculation method (EQUAL_MEAN, VWAP_RATIO, etc.) |
| session | VARCHAR | Trading session (RTH or AH) |
| baseline_value | NUMERIC | Calculated baseline value |

**Key Points:**
- Use `trading_date` NOT `date`
- 5 methods: EQUAL_MEAN, VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN
- 2 sessions: RTH (Regular Trading Hours), AH (After Hours)

---

## 📋 TABLE: minute_btc

**Purpose:** Bitcoin minute-level price data

| Column | Type | Description |
|--------|------|-------------|
| trading_date | DATE | The trading date |
| time | TIME | Minute timestamp |
| open | NUMERIC | Opening price |
| high | NUMERIC | High price |
| low | NUMERIC | Low price |
| close | NUMERIC | Closing price |
| volume | NUMERIC | Trading volume |

**Key Points:**
- Use `trading_date` NOT `date`
- OHLCV data structure

---

## 📋 TABLE: minute_stock

**Purpose:** Stock minute-level price data

| Column | Type | Description |
|--------|------|-------------|
| trading_date | DATE | The trading date |
| time | TIME | Minute timestamp |
| symbol | VARCHAR | Stock symbol |
| session | VARCHAR | Trading session (RTH or AH) |
| open | NUMERIC | Opening price |
| high | NUMERIC | High price |
| low | NUMERIC | Low price |
| close | NUMERIC | Closing price |
| volume | NUMERIC | Trading volume |

**Key Points:**
- Use `trading_date` NOT `date`
- Includes session field (RTH/AH)
- 10 stocks: RIOT, MARA, CLSK, HUT, BTDR, CORZ, CIFR, CAN, HIVE, WULF

---

## 📋 TABLE: trading_calendar

**Purpose:** Trading day calendar with previous/next day links

| Column | Type | Description |
|--------|------|-------------|
| trading_date | DATE | The trading date |
| prev_open_date | DATE | Previous trading day |
| next_open_date | DATE | Next trading day |
| is_trading_day | BOOLEAN | Whether this is a trading day |

**Key Points:**
- Use `trading_date` NOT `date`
- Use `prev_open_date` for baseline lookups (avoid look-ahead bias)
- Handles weekends and holidays

---

## 🎯 CRITICAL REMINDERS

1. **ALWAYS use `trading_date`** - Never use `date`
2. **Baseline lookups use `prev_open_date`** - This prevents look-ahead bias
3. **Session field exists** - RTH vs AH matters
4. **10 stocks total** - Including WULF
5. **5 baseline methods** - All must be calculated

---

## 📝 COMMON QUERIES

### Get baseline for previous trading day
```sql
SELECT tc.prev_open_date, bd.baseline_value
FROM trading_calendar tc
JOIN baseline_daily bd ON bd.trading_date = tc.prev_open_date
WHERE tc.trading_date = $1
AND bd.symbol = $2
AND bd.baseline_method = $3
AND bd.session = 'RTH'
```

### Get minute bars for a day
```sql
SELECT trading_date, time, session, open, high, low, close
FROM minute_stock
WHERE symbol = $1 AND trading_date = $2
ORDER BY trading_date, time
```

### Get BTC price at specific time
```sql
SELECT close FROM minute_btc 
WHERE trading_date = $1 AND time = $2
```

---

**ALWAYS REFERENCE THIS FILE WHEN WRITING QUERIES!**