# TRADIAC Crypto System - Setup Guide

## ✅ What's Been Completed

### 1. Database Tables Created ✅
All 8 crypto tables have been created in the `tradiac_testing` database:
- `minute_crypto` - Crypto minute bars (24/7)
- `minute_btc_crypto` - BTC minute bars (24/7)
- `baseline_daily_crypto` - Daily baselines (5 methods)
- `trade_events_crypto_equal_mean` - Events
- `trade_events_crypto_vwap_ratio` - Events
- `trade_events_crypto_vol_weighted` - Events
- `trade_events_crypto_winsorized` - Events
- `trade_events_crypto_weighted_median` - Events

### 2. Data Import Script Created ✅
**File**: `processor/crypto-data-import.js`

**Features**:
- Fetches minute data from Coinbase API (US-based, no restrictions)
- Supports 8 cryptos: ETH, SOL, ADA, AVAX, DOT, ATOM, NEAR, ALGO
- Can import last hour (for cron job) or backfill historical data
- Handles rate limiting automatically

**Usage**:
```bash
# Import last hour (for hourly cron)
node crypto-data-import.js

# Backfill from specific date
node crypto-data-import.js --backfill 2024-01-01
```

### 3. Baseline Calculation Script Created ✅
**File**: `processor/crypto-baseline-calculation.js`

**Features**:
- Calculates 5 baseline methods (same as stocks)
- Uses previous 24 hours of data
- Can calculate for specific date or date range

**Usage**:
```bash
# Calculate for yesterday
node crypto-baseline-calculation.js

# Calculate for specific date
node crypto-baseline-calculation.js --date 2025-01-15

# Calculate for date range
node crypto-baseline-calculation.js --range 2024-01-01 2024-12-31
```

### 4. Test Data Imported ✅
Successfully imported 1 hour of test data:
- 60 BTC bars
- 446 crypto bars across 8 symbols

---

## 🚀 Next Steps (What You Need to Do)

### Step 1: Backfill Historical Data

**Option A: Use Coinbase API (Free, but limited)**
```bash
cd processor

# Backfill last 7 days
node crypto-data-import.js --backfill 2025-10-26

# Or backfill last 30 days
node crypto-data-import.js --backfill 2025-10-02
```

**Note**: Coinbase has rate limits and may not allow very old historical data. If you get 400 errors, you'll need Option B.

**Option B: Use CryptoCompare API (Paid, but comprehensive)**

1. Sign up at https://www.cryptocompare.com/
2. Get API key
3. I'll create a script that uses CryptoCompare instead

**Recommendation**: Start with Option A (Coinbase) for recent data. If you need older data, use Option B.

---

### Step 2: Calculate Baselines

After you have at least 24 hours of data:

```bash
cd processor

# Calculate baselines for all dates with data
node crypto-baseline-calculation.js --range 2025-10-26 2025-11-02
```

---

### Step 3: Generate Events

I'll create the event generation script next (similar to stock events but for crypto).

---

## 📊 System Architecture

### Data Flow:
```
1. DATA COLLECTION (Hourly)
   Coinbase API → minute_crypto + minute_btc_crypto

2. BASELINE CALCULATION (Daily)
   Previous 24 hours → baseline_daily_crypto

3. EVENT GENERATION (Batch)
   minute_crypto + baselines → 5 event tables

4. API QUERIES (On-demand)
   Event tables → Frontend reports
```

### Key Differences from Stock System:
- **No Sessions**: Crypto trades 24/7 (no RTH/AH split)
- **Timestamps**: Use single timestamp field instead of date+time
- **5 Event Tables**: One per method (vs 10 for stocks with sessions)
- **8 Symbols**: ETH, SOL, ADA, AVAX, DOT, ATOM, NEAR, ALGO
- **24-Hour Baselines**: Use previous 24 hours (vs previous trading day)

---

## 🔧 Configuration

### Environment Variables (Already Set)
```
DB_HOST=34.41.97.179
DB_PORT=5432
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=Fu3lth3j3t!
```

### Crypto Symbols
Currently tracking 8 cryptos (available on Coinbase):
- ETH (Ethereum)
- SOL (Solana)
- ADA (Cardano)
- AVAX (Avalanche)
- DOT (Polkadot)
- ATOM (Cosmos)
- NEAR (Near Protocol)
- ALGO (Algorand)

---

## 📈 Expected Data Volumes

### With 6 Months of Historical Data:
- **Minute Crypto**: ~2.1M rows (8 symbols × 1440 min/day × 180 days)
- **Minute BTC**: ~260K rows (1440 min/day × 180 days)
- **Baselines**: ~7.2K rows (8 symbols × 5 methods × 180 days)
- **Events**: ~40-50M events (8 symbols × 900 combos × 5 methods × avg events)

### Database Size Impact:
- Additional storage: ~12-15 GB
- Total system: ~27-30 GB

---

## 💰 Cost Impact

### Additional Monthly Costs:
- Database storage: +$3/month
- Cloud Run (event generation): +$8/month
- API calls: $0 (Coinbase free tier)

**Total new cost: ~$11/month**
**Total system cost: $70 + $11 = $81/month**

---

## ⚠️ Known Limitations

### Coinbase API:
- Rate limits: 10 requests/second (we use 500ms delay)
- Historical data: Limited to recent months
- Some cryptos not available (MATIC, FTM)

### Solutions:
- For older data: Use CryptoCompare API (paid)
- For more cryptos: Add Binance.US or other exchanges
- For higher rate limits: Implement request queuing

---

## 🐛 Troubleshooting

### Issue: "Request failed with status code 400"
**Cause**: Requesting data too far in the past
**Solution**: Reduce backfill date or use CryptoCompare API

### Issue: "Request failed with status code 429"
**Cause**: Rate limit exceeded
**Solution**: Increase delay between requests (currently 500ms)

### Issue: No baselines calculated
**Cause**: Need at least 24 hours of data
**Solution**: Import more historical data first

---

## 📝 Next Steps for Me

I'll create:
1. ✅ Event generation script (crypto version)
2. ✅ API endpoints for crypto data
3. ✅ Frontend crypto reports
4. ✅ Deployment instructions
5. ✅ Push everything to GitHub

---

## 🎯 Timeline

**Today (What I'm doing now)**:
- ✅ Database tables created
- ✅ Data import script created
- ✅ Baseline calculation script created
- 🔄 Creating event generation script
- 🔄 Creating API endpoints
- 🔄 Creating frontend reports

**Tomorrow (What you'll do)**:
- Backfill historical data (6-12 months)
- Calculate baselines for all dates
- Generate events (40-50M events)
- Deploy and test

**Result**: Full crypto trading system parallel to stock system!

---

## 📞 Support

If you encounter issues:
1. Check this document first
2. Review error messages in console
3. Verify database connectivity
4. Check API rate limits

---

**Status**: 🟢 Ready for historical data backfill
**Next Action**: Run `node crypto-data-import.js --backfill 2025-10-26`