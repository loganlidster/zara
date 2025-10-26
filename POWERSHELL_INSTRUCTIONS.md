# 🎯 POWERSHELL STEP-BY-STEP GUIDE

## OPTION 1: EASIEST - DOUBLE-CLICK THE BATCH FILE

1. Open Windows Explorer
2. Navigate to your workspace folder (where you have TRADIAC files)
3. Go into the `processor` folder
4. Double-click `run-test.bat`
5. A window will open, run the test, and show results

---

## OPTION 2: USE POWERSHELL

### Step 1: Open PowerShell
- Press Windows key
- Type "PowerShell"
- Click "Windows PowerShell"

### Step 2: Navigate to workspace
```powershell
cd C:\Users\YourUsername\path\to\workspace
```
(Replace with your actual path)

### Step 3: Set environment variables
```powershell
$env:DB_HOST="34.172.6.192"
$env:DB_PORT="5432"
$env:DB_NAME="tradiac_db"
$env:DB_USER="postgres"
$env:DB_PASSWORD="tradiac2024!"
$env:DB_SSL="true"
```

### Step 4: Run test
```powershell
cd processor
node test-processor.js
```

---

## OPTION 3: ONE-LINE POWERSHELL

Navigate to your workspace folder, then run:
```powershell
.\processor\run-test.bat
```

---

## WHAT YOU'LL SEE

If successful:
```
🔍 Testing Database Setup...
✅ All 3 tables exist
✅ Indexes created
✅ Trading calendar data
✅ Stock data available
✅ Baseline data available
✅ ALL TESTS PASSED - READY TO PROCESS!
```

If error:
- Copy the error message
- Tell me what it says
- I'll help fix it

---

## NEXT STEP AFTER TEST PASSES

I'll guide you to run the processor on 1 week of data to verify it works correctly.