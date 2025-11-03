# USE THIS - Working Patterns & Solutions

**Purpose:** Stop recreating the same solutions. This file contains PROVEN, WORKING code patterns that we use repeatedly.

---

## 1. DATABASE CONNECTION (PostgreSQL)

### ✅ WORKING Pattern - Node.js
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
});

async function query() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM table_name');
    console.log(result.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
```

### ✅ WORKING Pattern - ES Modules
```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
});
```

---

## 2. FAST BASELINE CALCULATION

### ✅ WORKING Pattern - Vectorized In-Memory Processing
**Speed:** 340x faster than loop-based (50 seconds vs 2.5 hours)

**Key Principles:**
1. Load ALL data for a symbol at once
2. Build in-memory lookup map (timestamp → value)
3. Process all dates using the map
4. Batch insert (1000 rows at a time)

**Stock Baselines (WORKING):**
```bash
cd processor
node generate_baselines_from_existing_data.js
# Generates 46,889 baselines in ~16 seconds
```

**Crypto Baselines (✅ COMPLETE):**
- File: `processor/crypto-baseline-fast.js`
- Speed: 152 seconds for 20,710 baselines
- Symbols: 19 (SHIB removed due to numeric overflow)
- Date range: May 1, 2024 - Nov 2, 2025 (551 days)
- Methods: EQUAL_MEAN, WINSORIZED
- Status: ✅ READY FOR EVENT GENERATION

---

## 3. EVENT GENERATION

### ✅ WORKING Pattern - Cloud Run Deployment

**Key Principles:**
1. Batch inserts (1500 events per INSERT) = 80x faster
2. Use Cloud Run for parallel processing
3. 8 CPU, 32GB RAM, 3-hour timeout
4. Process all dates as continuous stream (not day-by-day)

**Stock Events (WORKING):**
```bash
# In Cloud Shell:
cd ~/cloudshell_files_v2
./redeploy_standard.sh
```

**Files:**
- `cloudshell_files_v2/event-update-job-standard.js` - 900 combos
- `cloudshell_files_v2/event-update-job-extended.js` - 2000 combos

**Crypto Events (READY):**
- Files in: `cloudshell_crypto/`
- Deploy script: `cloudshell_crypto/deploy.sh`
- TODO: Run after baselines complete

---

## 4. VERCEL DEPLOYMENT

### ✅ WORKING Pattern - Auto-Deploy from GitHub

**Frontend:**
```bash
cd frontend-dashboard
git add -A
git commit -m "message"
git push origin main
# Auto-deploys to raas.help
```

**API:**
```bash
cd api-server
git add -A
git commit -m "message"
git push origin main
# Auto-deploys to api-server-neon-five.vercel.app
```

**Environment Variables:**
- Must be set in Vercel dashboard
- Settings → Environment Variables
- Required for both frontend AND api-server:
  - DB_HOST
  - DB_PORT
  - DB_NAME
  - DB_USER
  - DB_PASSWORD

---

## 5. DATA IMPORT

### ✅ WORKING Pattern - Polygon API (Crypto)

**File:** `processor/crypto-data-import-polygon.js`

**Usage:**
```bash
cd processor
# Import specific date range
node crypto-data-import-polygon.js --backfill 2024-05-01

# Import latest hour
node crypto-data-import-polygon.js
```

**Key Features:**
- 30-day chunks (Polygon limit: 50k bars)
- Batch inserts (1500 bars per INSERT)
- Handles rate limits automatically
- Supports 27 crypto symbols

---

## 6. COMMON MISTAKES TO AVOID

### ❌ DON'T DO THIS:
1. **Loop-based baseline calculation** - Takes 2.5 hours instead of 50 seconds
2. **Individual INSERT statements** - 80x slower than batch inserts
3. **Day-by-day Cloud Run jobs** - Use continuous processing instead
4. **Hardcoded users in frontend** - Use database instead
5. **Absolute paths** - Always use relative paths in /workspace
6. **Forgetting environment variables** - Check Vercel dashboard first

### ✅ DO THIS INSTEAD:
1. **Vectorized in-memory processing** - Load all data once, process in memory
2. **Batch inserts (1000-1500 rows)** - Massive speedup
3. **Continuous stream processing** - Process all dates in one job
4. **Database-backed auth** - Store users in PostgreSQL
5. **Relative paths** - `src/main.py` not `/workspace/src/main.py`
6. **Check env vars first** - Before debugging connection issues

---

## 7. DEBUGGING CHECKLIST

### Database Connection Issues:
1. ✅ Check credentials: `34.41.97.179:5432/tradiac_testing`
2. ✅ Test connection: `node -e "const {Pool}=require('pg'); ..."`
3. ✅ Check Vercel env vars (if frontend/API issue)
4. ✅ Check firewall (if from Vercel serverless)

### Deployment Issues:
1. ✅ Check build logs in Vercel
2. ✅ Verify package.json has all dependencies
3. ✅ Check for TypeScript errors (@types/pg, etc.)
4. ✅ Verify environment variables are set

### Performance Issues:
1. ✅ Use batch inserts (1000-1500 rows)
2. ✅ Use in-memory processing (not loop-based)
3. ✅ Use Cloud Run for heavy processing
4. ✅ Monitor with: `tail -f logfile.log`

---

## 8. CURRENT SYSTEM STATUS

### Stock System: ✅ 100% OPERATIONAL
- 9 symbols
- 10 event tables (5 methods × 2 sessions)
- 33.7M events
- API: api-server-neon-five.vercel.app
- Frontend: raas.help

### Crypto System: 🔄 EVENT GENERATION IN PROGRESS
- 19 symbols imported (SHIB removed)
- Baselines: ✅ COMPLETE (20,710 baselines)
- Events: 🔄 GENERATING (15.5M so far, 1/19 symbols complete)
- Estimated total: ~293M events (146M per table)
- Status: Running on Cloud Run (8 CPU, 32GB RAM)
- ETA: ~10-15 hours for completion

---

## 9. TODO LIST

### Immediate:
- [x] Fix crypto-baseline-fast.js column name issue
- [x] Run crypto baseline calculation (152 seconds)
- [x] Remove SHIB (numeric overflow)
- [ ] Deploy crypto events to Cloud Shell
- [ ] Fix admin panel login (move to API server)

### Future:
- [ ] Add crypto API endpoints
- [ ] Create crypto reports in frontend
- [ ] Add missing crypto symbols (BNB, DOT, ATOM, etc.)
- [ ] Implement password hashing for users

---

## 10. QUICK REFERENCE

### Check Data Status:
```bash
# Stock events
node -e "const {Pool}=require('pg'); const pool=new Pool({host:'34.41.97.179',port:5432,database:'tradiac_testing',user:'postgres',password:'Fu3lth3j3t!'}); async function check(){const client=await pool.connect(); const result=await client.query('SELECT COUNT(*) FROM trade_events_rth_equal_mean'); console.log('Events:',result.rows[0].count); client.release(); await pool.end();} check();"

# Crypto baselines
node -e "const {Pool}=require('pg'); const pool=new Pool({host:'34.41.97.179',port:5432,database:'tradiac_testing',user:'postgres',password:'Fu3lth3j3t!'}); async function check(){const client=await pool.connect(); const result=await client.query('SELECT COUNT(*) FROM baseline_daily_crypto'); console.log('Baselines:',result.rows[0].count); client.release(); await pool.end();} check();"
```

### Monitor Background Jobs:
```bash
tail -f processor/crypto-baseline.log
tail -f processor/crypto-import.log
```

### GitHub Push:
```bash
cd frontend-dashboard
git add -A && git commit -m "message" && git push origin main
```

---

**Last Updated:** Nov 2, 2025
**Maintained By:** Logan & AI Team