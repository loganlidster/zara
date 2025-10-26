# ⚡ QUICK REFERENCE CARD

## 🎯 What You Need to Do Right Now

### 1️⃣ Import Trading Calendar (10 min)
```powershell
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing
npm install pg
node import_calendar.js
```
**Expected:** "✅ Trading calendar import complete!" with 1,828 rows

---

### 2️⃣ Deploy Fixed Simulator (5 min)
```powershell
cd simulation-engine
npm install
```
**Expected:** Dependencies installed successfully

---

### 3️⃣ Run Test Case (1 min)
```powershell
node src/index.js BTDR 2025-09-24 2025-09-24 EQUAL_MEAN 0.5 1.1 RTH 10000
```
**Expected:** 10.53% return, 6 trades

---

## 📁 Files to Download

From this workspace:
- `import_calendar.js`
- `import_calendar.sql`
- `simulation-engine/` (entire folder)
- `STEP_BY_STEP_DEPLOYMENT.md`
- `READY_TO_DEPLOY_PACKAGE.md`
- `SESSION_SUMMARY.md`

---

## 🔍 What Changed

**The Fix:**
```javascript
// BEFORE (WRONG):
AND bl.trading_day = s.et_date

// AFTER (CORRECT):
INNER JOIN trading_calendar tc ON s.et_date = tc.cal_date
AND bl.trading_day = tc.prev_open_date
```

**Why:** Eliminates look-ahead bias by using previous trading day's baseline

---

## ✅ Verification Checklist

- [ ] Calendar imported (1,828 rows)
- [ ] Simulator runs without errors
- [ ] Test returns 10.53% (±0.1%)
- [ ] Test shows 6 trades
- [ ] Trade log shows `prev_baseline_date`

---

## 🚀 After Verification

Tell me: "✅ All tests passed!"

Then I'll build:
1. Batch grid search runner (81,000+ simulations)
2. Advanced analytics (correlation, regime detection)
3. Web UI (React dashboard)

---

## 📞 Need Help?

Check these files:
- **STEP_BY_STEP_DEPLOYMENT.md** - Detailed instructions
- **READY_TO_DEPLOY_PACKAGE.md** - Technical details
- **SESSION_SUMMARY.md** - Complete overview

---

## 💡 Key Points

1. **Trading calendar is required** - Provides prev_open_date
2. **Test case is critical** - Validates accuracy
3. **10.53% return** - Must match exactly
4. **6 trades** - Must match exactly

---

**Total Time: ~25 minutes to full verification** ⏱️

**Let's do this!** 🔥