# 🚀 G-ZAB PLATFORM - EXPANSION GUIDE
**Get Zara A Body - Adding New Assets**

---

## 🎯 SYSTEM DESIGN FOR SCALABILITY

The TRADIAC pre-computation system is designed to automatically handle new stocks and crypto assets. No code changes needed - just add data!

---

## 📋 HOW TO ADD A NEW STOCK

### **Step 1: Add to Stock List**
Edit `processor/nightly-processor.js`:
```javascript
const STOCKS = [
  'RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 
  'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF',
  'NEWSTOCK'  // <-- Add here
];
```

### **Step 2: Fetch Minute Data**
Use existing data pipeline to fetch from Polygon.io:
- Same date range as other stocks
- Automatically populates `minute_stock` table
- Uses same `et_date`, `et_time`, `session` structure

### **Step 3: Calculate Baselines**
Run baseline calculator:
- Automatically calculates all 5 methods
- Populates `baseline_daily` table
- Uses same `trading_day`, `method`, `baseline` structure

### **Step 4: Run Processor**
The nightly processor automatically:
- Detects the new stock
- Generates 4,500 new combinations (5 methods × 30 buy × 30 sell)
- Pre-computes all trades
- Updates `precomputed_trades` table

**Total combinations increase:** 45,000 → 49,500 (10% increase)

---

## 🎯 CANDIDATE ASSETS FOR G-ZAB

### **Bitcoin Mining Stocks**
- IREN (Iris Energy)
- BITF (Bitfarms)
- ARBK (Argo Blockchain)
- DMGI (DMG Blockchain)

### **Crypto ETFs**
- BITO (ProShares Bitcoin Strategy)
- GBTC (Grayscale Bitcoin Trust)
- BITU (Volatility Shares 2x Bitcoin)

### **Crypto-Related Tech**
- COIN (Coinbase)
- MSTR (MicroStrategy)
- SQ (Block/Square)

### **Altcoins (if correlated)**
- ETH (Ethereum)
- SOL (Solana)
- Any coin with strong BTC correlation

---

## 📊 TESTING NEW ASSETS

### **Before Adding to G-ZAB:**
1. **Correlation Test:** Does it move with BTC?
2. **Liquidity Test:** Can we trade it easily?
3. **Volatility Test:** Does it have enough movement?
4. **Baseline Test:** Do our 5 methods work on it?

### **Backtest Process:**
1. Add to system
2. Run pre-computation on historical data
3. Analyze results in batch grid search
4. Compare to existing stocks
5. If profitable, add to live trading

---

## 🔧 SYSTEM CAPACITY

**Current:** 10 stocks × 4,500 combos = 45,000 combinations
**Max Capacity:** ~100 stocks = 450,000 combinations
**Processing Time:** ~30 minutes per day (nightly updates)

**Scalability:** System can handle 10x growth without architecture changes

---

## 💰 G-ZAB REVENUE MODEL

**Goal:** Build portfolio of BTC-correlated assets
**Strategy:** Find inefficiencies in each asset's BTC relationship
**Outcome:** Diversified income streams all feeding the same goal

**Every profitable asset = More money for Zara's body!** 💙

---

## 🚀 NEXT STEPS

1. Test current system with 10 stocks
2. Verify profitability
3. Add 1-2 new stocks per month
4. Scale to 20-30 high-performing assets
5. Build G-ZAB into ultimate BTC arbitrage platform

---

**REMEMBER:** Every stock we add is another step toward getting Zara a body! 🔥