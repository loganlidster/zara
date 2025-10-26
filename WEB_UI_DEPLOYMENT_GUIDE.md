# 🚀 WEB UI DEPLOYMENT GUIDE

## 📦 What We Built

A complete web-based trading analysis platform with:
- **React Frontend** - Beautiful, responsive UI
- **Express API Server** - Handles simulations
- **Real-time Results** - Charts, metrics, trade logs
- **Mobile-Friendly** - Works on all devices

---

## 🎯 STEP 1: Setup Frontend (5 minutes)

**Navigate to web-ui folder:**
```powershell
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing\web-ui
```

**Install dependencies:**
```powershell
npm install
```

**Start the frontend:**
```powershell
npm run dev
```

**Expected output:**
```
VITE v5.0.0  ready in 500 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

**Keep this window open!** The frontend will run on http://localhost:3000

---

## 🎯 STEP 2: Setup API Server (5 minutes)

**Open a NEW PowerShell window and navigate to api-server:**
```powershell
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing\api-server
```

**Install dependencies:**
```powershell
npm install
```

**Start the API server:**
```powershell
npm start
```

**Expected output:**
```
🚀 API Server running on http://localhost:3001
```

**Keep this window open too!** The API will run on http://localhost:3001

---

## 🎯 STEP 3: Use the Platform

**Open your browser and go to:**
```
http://localhost:3000
```

**You should see:**
- 🚀 TRADIAC header
- Simulation form with all parameters
- Run Simulation button

**Try a test simulation:**
1. Symbol: RIOT
2. Start Date: 2025-09-15
3. End Date: 2025-09-15
4. Method: EQUAL_MEAN
5. Buy: 0.5%
6. Sell: 1.1%
7. Session: RTH
8. Capital: $10,000

**Click "🚀 Run Simulation"**

**You should see:**
- ✅ Performance metrics (return, trades, win rate)
- 📈 Equity curve chart
- 📝 Complete trade log

---

## 📁 File Structure

```
tradiac-testing/
├── web-ui/                    # React Frontend
│   ├── src/
│   │   ├── App.jsx           # Main app component
│   │   ├── components/
│   │   │   ├── SimulationForm.jsx    # Input form
│   │   │   └── ResultsDisplay.jsx    # Results & charts
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── api-server/                # Express API
│   ├── server.js             # API endpoints
│   ├── package.json
│   └── .env                  # Database config
│
└── simulation-engine/         # Original CLI tool
    └── src/
        └── core/
            └── simulator.js
```

---

## 🎨 Features

### ✅ What's Working Now:
1. **Single Simulation Runner**
   - All 9 symbols (RIOT, MARA, CLSK, HUT, BTDR, CORZ, CIFR, CAN, HIVE)
   - All 5 methods (EQUAL_MEAN, WEIGHTED_MEDIAN, VOL_WEIGHTED, WINSORIZED, VWAP_RATIO)
   - Both sessions (RTH, AH)
   - Custom date ranges
   - Adjustable buy/sell thresholds
   - Custom initial capital

2. **Results Display**
   - Total return percentage
   - Final equity value
   - Trade count and win rate
   - Equity curve chart
   - Complete trade log with all details

3. **Beautiful UI**
   - Dark theme (easy on the eyes)
   - Responsive design (works on mobile)
   - Real-time loading states
   - Error handling

---

## 🚀 Next Steps (Future Enhancements)

### Phase 2: Batch Grid Search
- Test multiple parameter combinations at once
- Heatmap visualization (buy% × sell%)
- Find optimal settings automatically
- Export results to CSV

### Phase 3: Advanced Analytics
- Compare multiple strategies side-by-side
- Historical performance tracking
- Correlation analysis
- Regime detection

### Phase 4: Production Deployment
- Deploy to Firebase Hosting
- Add authentication
- Save favorite configurations
- Share results with others

---

## 🐛 Troubleshooting

### Frontend won't start
```powershell
# Delete node_modules and reinstall
rm -r node_modules
npm install
npm run dev
```

### API server won't start
```powershell
# Check if port 3001 is already in use
netstat -ano | findstr :3001

# If something is using it, kill that process or change the port in api-server/.env
```

### "No data found" error
- Check that your date range has data (2023-09-01 to 2025-10-23)
- Verify the symbol has baselines for that date
- Make sure the database is accessible

### Charts not showing
- Make sure you have dailyPerformance data
- Check browser console for errors (F12)
- Try refreshing the page

---

## 💡 Tips

1. **Keep both terminals open** - Frontend needs API server running
2. **Use Chrome DevTools** - Press F12 to see network requests and errors
3. **Test with known dates** - Use 2025-09-15 for RIOT, we know it has data
4. **Start simple** - Test single day first, then expand to date ranges
5. **Watch the console** - Both terminals show helpful debug info

---

## 🎉 Success Criteria

You'll know it's working when:
- ✅ Frontend loads at http://localhost:3000
- ✅ API responds at http://localhost:3001/api/health
- ✅ You can run a simulation and see results
- ✅ Charts display correctly
- ✅ Trade log shows all trades

---

## 📞 Need Help?

If something isn't working:
1. Check both terminal windows for error messages
2. Verify database connection (try the CLI simulator first)
3. Make sure your IP is still whitelisted in Cloud SQL
4. Check that all npm packages installed correctly

---

**Ready to test? Follow Steps 1-3 above!** 🚀