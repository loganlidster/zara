# Running the Grid Processor - Step by Step

## 🚀 Quick Start (PowerShell)

### Step 1: Download the Code
```powershell
# Open PowerShell
cd C:\Users\YourUsername\Documents

# Clone or update the repo
git clone https://github.com/loganlidster/zara.git
# OR if you already have it:
cd zara
git pull origin main

# Go to processor folder
cd processor
```

### Step 2: Run the Processor
```powershell
# Test with 2 days first
.\run-grid-processor.ps1 2025-09-24 2025-09-25

# Then run full month
.\run-grid-processor.ps1 2025-09-01 2025-09-30
```

That's it! The script handles everything automatically.

## ⚡ What Makes It Fast

### 1. Parallel Processing
- Processes **10 combinations at once** instead of one at a time
- Uses database connection pooling (20 connections)
- **10x faster** than the original version

### 2. Progress Tracking
- Saves progress to `grid-progress.json` every batch
- If it crashes or you stop it, just run again - it resumes where it left off
- No need to start over!

### 3. Optimized Database Queries
- Reuses connections from pool
- Batch inserts where possible
- Efficient indexing

## 📊 Expected Performance

### Test Run (2 days)
- **11 symbols** × 5 methods × 2 sessions × 900 combos = 99,000 combinations
- But only 2 days of data, so very few trades
- **Time: 5-10 minutes**

### Full Month (30 days)
- Same 99,000 combinations
- More trades per combination
- **Time: 2-4 hours** (depending on your machine and internet speed)

### Full Year (365 days)
- **Time: 1-2 days**

## 🔍 Monitoring Progress

The processor shows real-time progress:

```
🚀 Starting Parallel Grid Processing
Date Range: 2025-09-01 to 2025-09-30
Batch Size: 10 combinations at once
Database Pool: 20 connections

Total Combinations: 99,000

Processing batch 1/9900...
  ✓ Batch complete: 10/99,000 (0.0%) - 45 total trades

Processing batch 2/9900...
  ✓ Batch complete: 20/99,000 (0.0%) - 92 total trades

...

Processing batch 9900/9900...
  ✓ Batch complete: 99,000/99,000 (100.0%) - 45,678 total trades

✅ Grid Processing Complete!
Total Combinations: 99,000
Total Trades: 45,678

🎉 Done!
```

## 🛑 Stopping and Resuming

### To Stop
- Press `Ctrl+C` in PowerShell
- Progress is automatically saved

### To Resume
- Just run the same command again:
```powershell
.\run-grid-processor.ps1 2025-09-01 2025-09-30
```

It will say:
```
Resuming: 95,000 combinations remaining
```

## 🐛 Troubleshooting

### "Cannot connect to database"
- Check that your IP is whitelisted in Cloud SQL
- Verify database credentials in the script

### "Out of memory"
- The parallel processor uses more memory
- Reduce BATCH_SIZE in `grid-processor-parallel.js` from 10 to 5

### "Too slow"
- Increase BATCH_SIZE from 10 to 20 (if you have good internet)
- Check your internet connection speed

### "Progress file corrupted"
- Delete `grid-progress.json` and start over
- Or manually edit it to remove the corrupted entry

## 📁 Output Files

### grid-progress.json
- Tracks which combinations are complete
- Automatically deleted when processing finishes
- Keep this file if you need to resume!

### Database Tables
- `precomputed_trades_grid_rth` - RTH trades
- `precomputed_trades_grid_ah` - AH trades

## 🔄 Running Daily (Automated)

After testing locally, we'll set up a Cloud Run job to run this automatically every morning.

The job will:
1. Check for new trading days
2. Process only the new day's data
3. Add to existing tables
4. Send you a notification when done

## 💡 Tips

1. **Test first**: Always test with 2 days before running a full month
2. **Check results**: Query the database to verify trades look correct
3. **Monitor resources**: Watch your CPU and memory usage
4. **Keep PowerShell open**: Don't close the window while it's running
5. **Good internet**: Faster internet = faster processing

## 🎯 Next Steps

After local testing:
1. Verify results in database
2. Set up Cloud Run job for daily automation
3. Wire up API endpoints to query the tables
4. Update UI to use precomputed data

---

**Ready to run?** Just execute:
```powershell
.\run-grid-processor.ps1 2025-09-24 2025-09-25
```