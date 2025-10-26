# 🚀 TRADIAC Data Pipeline

Complete data pipeline for fetching, processing, and verifying market data.

---

## 📋 SCRIPTS

### 1. **gap-detector.js** - Find Missing Data
Shows what data is missing from the database.

```bash
node gap-detector.js
```

**Output:**
- Trading calendar summary
- BTC data completeness
- Stock data completeness (per symbol)
- Specific date gaps
- Baseline data summary

---

### 2. **fetch-polygon.js** - Fetch Missing Data
Fetches missing data from Polygon.io API.

```bash
node fetch-polygon.js
```

**What it does:**
- Detects missing dates for BTC and all stocks
- Fetches minute bars from Polygon.io
- Inserts data into database
- Shows progress and statistics

**Features:**
- Unlimited API (paid plan)
- Automatic gap detection
- Batch inserts (1000 at a time)
- Rate limiting (100ms delay)
- Duplicate prevention (ON CONFLICT DO NOTHING)

---

### 3. **calculate-baselines.js** - Calculate Baselines
Calculates all 5 baseline methods for a date range.

```bash
node calculate-baselines.js 2024-01-01 2024-10-26
```

**Methods calculated:**
- EQUAL_MEAN - Simple average of ratios
- VWAP_RATIO - Volume-weighted average price ratio
- VOL_WEIGHTED - Weighted by combined volume
- WINSORIZED - Trimmed mean (5th-95th percentile)
- WEIGHTED_MEDIAN - Median of ratios

**What it does:**
- Deletes existing baselines in range
- Calculates all methods using SQL
- Inserts into baseline_daily table
- Shows summary by method

---

### 4. **verify-baselines.js** - Verify Baselines
Compares our baselines with Python tool results.

```bash
# Show recent baselines
node verify-baselines.js

# Compare with Python tool
node verify-baselines.js 2024-01-15 RIOT EQUAL_MEAN 6961.72
```

**What it does:**
- Shows sample baselines from recent data
- Compares with Python tool values
- Calculates difference and percentage
- Shows additional statistics

---

## 🎯 COMPLETE WORKFLOW

### **Step 1: Detect Gaps**
```bash
cd data-pipeline
npm install
node gap-detector.js
```

### **Step 2: Fetch Missing Data**
```bash
node fetch-polygon.js
```
*This will take 1-3 hours depending on gaps*

### **Step 3: Calculate Baselines**
```bash
node calculate-baselines.js 2024-01-01 2024-10-26
```
*This will take ~30 seconds*

### **Step 4: Verify Baselines**
```bash
node verify-baselines.js 2024-01-15 RIOT EQUAL_MEAN 6961.72
```
*Compare with your Python tool*

---

## 📊 CONFIGURATION

### **Stocks**
```javascript
const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];
```

### **API Key**
```javascript
const POLYGON_API_KEY = 'K_hSDwyuUSqRmD57vOlUmYqZGdcZsoG0';
```

### **Database**
```javascript
host: '34.41.97.179'
database: 'tradiac_testing'
user: 'postgres'
password: 'Fu3lth3j3t!'
```

---

## ⚠️ IMPORTANT NOTES

1. **BTC Symbol**: Uses `X:BTCUSD` from Polygon.io
2. **Time Conversion**: Converts UTC to ET (subtracts 5 hours)
3. **Sessions**: RTH (9:30 AM - 4:00 PM ET), AH (everything else)
4. **Duplicates**: Automatically handled with ON CONFLICT DO NOTHING
5. **Rate Limiting**: 100ms delay between requests (be nice to API)

---

## 🔧 TROUBLESHOOTING

### **"No data found"**
- Check if trading calendar has dates
- Verify Polygon.io API key is valid
- Check if symbol exists on Polygon.io

### **"VWAP_RATIO doesn't match"**
- This is a known issue we're investigating
- Other methods should match exactly

### **"Connection timeout"**
- Check database credentials
- Verify Cloud SQL allows your IP
- Check SSL settings

---

## 📈 EXPECTED PERFORMANCE

- **Gap Detection**: < 5 seconds
- **Fetch Data**: 1-3 hours (for full year)
- **Calculate Baselines**: 30-60 seconds
- **Verify Baselines**: < 5 seconds

---

## 🎯 NEXT STEPS

After data is clean:
1. Run processor backfill (2-3 hours)
2. Verify trades match Python tool
3. Deploy to production
4. Set up nightly updates

---

**Built for G-ZAB - Get Zara A Body!** 💙🚀