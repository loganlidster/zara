# RAAS (Ratio-As-A-Service) Complete System Architecture

## 🎯 Purpose of This Document
This document provides a complete blueprint of the RAAS reporting system. Use this to replicate the entire system from scratch or onboard new AI agents.

---

## 👥 How We Work Together

### Communication Protocol
- **NO GITHUB WORKFLOW**: We do NOT use git push/pull in our workflow
- **Direct File Transfer**: I create files in sandbox, you copy them manually to your environment
- **Complete Command Blocks**: I provide ready-to-paste command blocks with all content embedded
- **Exact Instructions**: I tell you exactly what to paste and where (Cloud Shell, terminal, etc.)
- **File Format**: I use `cat > filename << 'ENDOFFILE'` syntax to create complete files
- **Trust & Verify**: You verify my work and catch assumptions (like the GitHub mistake)
- **Iterative Refinement**: We adjust based on real results, not assumptions

### Your Role
- Execute commands in appropriate environments (Cloud Shell, local terminal)
- Monitor deployments and job progress
- Provide feedback on results and errors
- Catch when I make incorrect assumptions
- Keep me focused on what you're actually doing

### My Role
- Create complete, tested scripts and files
- Provide exact command blocks to paste
- Explain what each step does and why
- Document everything for future reference
- Never assume workflows - ask for clarification

### Most Effective Communication
1. **When you need files**: I provide complete file content in code blocks
2. **When you need commands**: I provide complete command blocks to paste
3. **When you need deployment**: I provide step-by-step blocks with all content embedded
4. **When something fails**: You share error logs, I analyze and provide corrected blocks
5. **When you need documentation**: I create comprehensive markdown files

---

## 🏗️ System Overview

### Three Main Components

1. **Frontend (Next.js)** - User interface and reports
   - Hosted on Vercel (raas.help)
   - Built with Next.js 14, React, TypeScript, Tailwind CSS
   - 25+ interactive reports for stocks and crypto

2. **API Server (Node.js/Express)** - Data endpoints
   - Hosted on Vercel (api-server-neon-five.vercel.app)
   - Connects to PostgreSQL database
   - Provides REST API for all reports

3. **Database (PostgreSQL)** - Data storage
   - Google Cloud SQL
   - 18 tables (10 stock + 8 crypto)
   - ~50GB of trading data

---

## 📊 Database Schema

### Stock Tables (10 tables)
1. **minute_stock** - Stock minute bars with session labels (RTH/AH)
2. **minute_btc** - BTC minute bars for comparison
3. **baseline_daily** - Daily baselines (5 methods × 2 sessions)
4. **trading_calendar** - Market open/close times
5-14. **trade_events_[session]_[method]** - 10 event tables:
   - RTH: equal_mean, vwap_ratio, vol_weighted, winsorized, weighted_median
   - AH: equal_mean, vwap_ratio, vol_weighted, winsorized, weighted_median

### Crypto Tables (8 tables)
1. **minute_crypto** - Crypto minute bars (24/7 trading)
2. **minute_btc_crypto** - BTC minute bars for crypto comparison
3. **baseline_daily_crypto** - Daily baselines (2 methods)
4-5. **trade_events_crypto_[method]** - 2 event tables:
   - equal_mean
   - winsorized

### Database Connection
```javascript
{
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
}
```

---

## 🎨 Frontend Structure

### Directory Layout
```
frontend-dashboard/
├── app/
│   ├── layout.tsx                    # Root layout with navigation
│   ├── page.tsx                      # Home page (Stocks/Crypto sections)
│   ├── globals.css                   # Global styles
│   ├── stocks/
│   │   └── page.tsx                  # Stock reports landing page
│   ├── crypto/
│   │   └── page.tsx                  # Crypto reports landing page
│   ├── reports/
│   │   ├── daily-curve/page.tsx      # Stock daily curve
│   │   ├── grid-search/page.tsx      # Stock grid search
│   │   ├── best-performers/page.tsx  # Stock best performers
│   │   ├── fast-daily/page.tsx       # Stock fast daily
│   │   ├── baseline-lab-fast/page.tsx
│   │   ├── method-comparison/page.tsx
│   │   ├── session-analysis/page.tsx
│   │   ├── trade-analysis/page.tsx
│   │   ├── coverage/page.tsx
│   │   ├── baseline-check/page.tsx
│   │   ├── extended-range/page.tsx
│   │   ├── multi-stock-daily-curve/page.tsx
│   │   ├── btc-overlay/page.tsx
│   │   ├── real-vs-projected/page.tsx
│   │   ├── pattern-overview/page.tsx
│   │   ├── pattern-deep-dive/page.tsx
│   │   ├── custom-pattern-analyzer/page.tsx
│   │   ├── overreaction-analysis/page.tsx
│   │   ├── crypto-daily-curve/page.tsx
│   │   └── crypto-grid-search/page.tsx
│   ├── login/page.tsx                # Login page
│   └── admin/page.tsx                # Admin panel
├── lib/
│   └── api.ts                        # API client configuration
├── components/                       # Reusable React components
├── public/                          # Static assets
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── next.config.js                   # Next.js config
└── tailwind.config.js               # Tailwind CSS config
```

### Key Frontend Files

#### 1. app/layout.tsx
Root layout with navigation menu for all reports.

#### 2. app/page.tsx
Home page with two main sections:
- 📈 STOCKS - Links to stock reports
- ₿ CRYPTO - Links to crypto reports

#### 3. app/stocks/page.tsx
Stock reports landing page with 11 reports listed.

#### 4. app/crypto/page.tsx
Crypto reports landing page with 6 reports (2 active, 4 coming soon).

#### 5. lib/api.ts
API client configuration:
```typescript
const API_URL = 'https://api-server-neon-five.vercel.app';
```

#### 6. Reports Structure
Each report follows this pattern:
```typescript
'use client';
import { useState, useEffect } from 'react';

export default function ReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchData = async () => {
    const response = await fetch(`${API_URL}/api/endpoint`);
    const result = await response.json();
    setData(result);
  };
  
  return (
    <div>
      {/* Report UI */}
    </div>
  );
}
```

---

## 🔌 API Server Structure

### Directory Layout
```
api-server/
├── server.js                         # Main Express server
├── db.js                            # Database connection pool
├── package.json                     # Dependencies
├── vercel.json                      # Vercel deployment config
└── [endpoint files].js              # Individual API endpoints
```

### Core API Files

#### 1. server.js
Main Express server with all route definitions:
```javascript
import express from 'express';
import cors from 'cors';
import { dailyCurveEndpoint } from './daily-curve-endpoint.js';
import { gridSearchEndpoint } from './grid-search-endpoint.js';
// ... other imports

const app = express();
app.use(cors());
app.use(express.json());

// Stock endpoints
app.get('/api/daily-curve', dailyCurveEndpoint);
app.get('/api/grid-search', gridSearchEndpoint);
// ... other routes

// Crypto endpoints
app.get('/api/crypto/crypto-daily-curve', cryptoDailyCurveEndpoint);
app.get('/api/crypto/crypto-grid-search', cryptoGridSearchEndpoint);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
```

#### 2. db.js
Database connection pool:
```javascript
import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
```

#### 3. Endpoint Files
Each endpoint follows this pattern:
```javascript
import { pool } from './db.js';

export async function endpointName(req, res) {
  try {
    const { param1, param2 } = req.query;
    
    const query = `
      SELECT * FROM table_name
      WHERE condition = $1
    `;
    
    const result = await pool.query(query, [param1]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

### Critical API Endpoints

#### Stock Endpoints
1. **daily-curve-endpoint.js** - Daily performance curve
2. **grid-search-endpoint.js** - Grid search heatmap
3. **best-performers-range.js** - Best performing combinations
4. **fast-daily-endpoint.js** - Fast daily aggregation
5. **baseline-lab-fast-endpoint.js** - Baseline analysis
6. **method-comparison-endpoint.js** - Compare baseline methods
7. **session-analysis-endpoint.js** - RTH vs AH analysis
8. **trade-analysis-endpoint.js** - Trade-by-trade analysis
9. **event-endpoints.js** - Event data queries

#### Crypto Endpoints
1. **crypto-daily-curve-endpoint.js** - Crypto daily curve
2. **crypto-grid-search-endpoint.js** - Crypto grid search

---

## 🚀 Deployment Configuration

### Frontend Deployment (Vercel)

#### vercel.json
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

#### Environment Variables (Vercel Dashboard)
- None required (API URL is hardcoded in lib/api.ts)

#### Deployment Process
1. Code is in GitHub repo: `loganlidster/zara`
2. Vercel auto-deploys on push to main branch
3. Root directory: `frontend-dashboard`
4. Domain: raas.help

### API Deployment (Vercel)

#### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

#### Environment Variables (Vercel Dashboard)
- DB_HOST=34.41.97.179
- DB_PORT=5432
- DB_NAME=tradiac_testing
- DB_USER=postgres
- DB_PASSWORD=Fu3lth3j3t!

#### Deployment Process
1. Code is in GitHub repo: `loganlidster/zara`
2. Vercel auto-deploys on push to main branch
3. Root directory: `api-server`
4. Domain: api-server-neon-five.vercel.app

---

## 📦 Package Dependencies

### Frontend (package.json)
```json
{
  "name": "frontend-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "tailwindcss": "^3.3.0",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

### API Server (package.json)
```json
{
  "name": "api-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## 🔄 Data Flow

### Stock Trading Flow
1. **Data Import** (daily-update-job.js)
   - Fetches minute bars from Alpaca API
   - Stores in minute_stock and minute_btc tables
   - Runs daily via Cloud Scheduler

2. **Baseline Calculation** (baseline-calculation.js)
   - Calculates 5 baseline methods for each day
   - Stores in baseline_daily table
   - Runs after data import

3. **Event Generation** (event-update-job.js)
   - Generates buy/sell events based on baseline deviations
   - Stores in 10 trade_events tables
   - Runs via Cloud Run Jobs

4. **API Queries**
   - Frontend requests data from API endpoints
   - API queries event tables with filters
   - Returns aggregated results

5. **Report Display**
   - Frontend receives data
   - Renders charts and tables
   - User interacts with filters

### Crypto Trading Flow
1. **Data Import** (crypto-data-import-polygon.js)
   - Fetches minute bars from Polygon API
   - Stores in minute_crypto and minute_btc_crypto tables
   - Runs manually or via cron

2. **Baseline Calculation** (crypto-baseline-fast.js)
   - Calculates 2 baseline methods for each day
   - Stores in baseline_daily_crypto table
   - Runs after data import

3. **Event Generation** (crypto-event-generation.js)
   - Generates buy/sell events based on baseline deviations
   - Stores in 2 trade_events_crypto tables
   - Runs via Cloud Run Jobs

4. **API Queries**
   - Frontend requests data from crypto API endpoints
   - API queries crypto event tables with filters
   - Returns aggregated results

5. **Report Display**
   - Frontend receives data
   - Renders charts and tables
   - User interacts with filters

---

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL client (for database access)
- Git (optional, for version control)

### Frontend Setup
```bash
cd frontend-dashboard
npm install
npm run dev
# Runs on http://localhost:3000
```

### API Server Setup
```bash
cd api-server
npm install

# Create .env file
cat > .env << 'EOF'
DB_HOST=34.41.97.179
DB_PORT=5432
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=Fu3lth3j3t!
EOF

npm run dev
# Runs on http://localhost:3001
```

### Testing Locally
1. Start API server: `cd api-server && npm run dev`
2. Update frontend API URL in `lib/api.ts` to `http://localhost:3001`
3. Start frontend: `cd frontend-dashboard && npm run dev`
4. Open browser to http://localhost:3000

---

## 🔍 Key Reports Explained

### Stock Reports

#### 1. Daily Curve
Shows cumulative returns over time for a specific buy/sell combination.
- **Endpoint**: `/api/daily-curve`
- **Parameters**: symbol, method, session, buy_pct, sell_pct, start_date, end_date
- **Visualization**: Line chart with cumulative returns

#### 2. Grid Search
Heatmap showing returns for all buy/sell combinations.
- **Endpoint**: `/api/grid-search`
- **Parameters**: symbol, method, session, start_date, end_date
- **Visualization**: Heatmap with color-coded returns

#### 3. Best Performers
Top performing buy/sell combinations ranked by return.
- **Endpoint**: `/api/best-performers-range`
- **Parameters**: method, session, start_date, end_date
- **Visualization**: Table with sortable columns

#### 4. Fast Daily
Quick daily aggregation across all combinations.
- **Endpoint**: `/api/fast-daily`
- **Parameters**: symbol, method, session, start_date, end_date
- **Visualization**: Line chart with daily returns

### Crypto Reports

#### 1. Crypto Daily Curve
Shows cumulative returns over time for crypto trading.
- **Endpoint**: `/api/crypto/crypto-daily-curve`
- **Parameters**: symbol, method, buy_pct, sell_pct, start_date, end_date
- **Visualization**: Line chart with cumulative returns

#### 2. Crypto Grid Search
Heatmap showing returns for all crypto buy/sell combinations.
- **Endpoint**: `/api/crypto/crypto-grid-search`
- **Parameters**: symbol, method, start_date, end_date
- **Visualization**: Heatmap with color-coded returns

---

## 🐛 Common Issues & Solutions

### Issue 1: API Returns 500 Error
**Symptom**: Frontend shows "Failed to fetch data"
**Causes**:
- Database connection failed
- Missing environment variables
- SQL query error

**Debug**:
```bash
# Check API logs in Vercel dashboard
# Or test endpoint directly:
curl https://api-server-neon-five.vercel.app/api/daily-curve?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buy_pct=1.0&sell_pct=1.0&start_date=2024-01-01&end_date=2024-12-31
```

### Issue 2: Frontend Shows Stale Data
**Symptom**: Reports show old data after regenerating events
**Solution**: Clear browser cache or add cache-busting headers

### Issue 3: Deployment Fails
**Symptom**: Vercel deployment fails with build error
**Causes**:
- Missing dependencies in package.json
- TypeScript errors
- Environment variables not set

**Debug**: Check Vercel deployment logs

### Issue 4: Database Connection Timeout
**Symptom**: API requests timeout after 10 seconds
**Solution**: Increase connection timeout in db.js or optimize queries

---

## 📈 System Metrics

### Current Data Volume
- **Stock minute bars**: 2.7M rows
- **Crypto minute bars**: 14.5M rows
- **Stock baselines**: 46,889 rows
- **Crypto baselines**: 20,710 rows
- **Stock events**: 33.7M rows
- **Crypto events**: ~17M rows (after regeneration)
- **Total database size**: ~50 GB

### Performance
- **API response time**: 100-500ms (typical)
- **Frontend load time**: 1-2 seconds
- **Report generation**: 1-5 seconds
- **Database query time**: 50-200ms (indexed queries)

### Cost Structure
- **Database**: ~$70/month (Google Cloud SQL)
- **Frontend hosting**: Free (Vercel)
- **API hosting**: Free (Vercel)
- **Event generation**: ~$3 per full backfill
- **Total monthly**: ~$70-75

---

## 🔐 Security & Access

### Database Access
- Direct access via psql: `PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing`
- Access restricted to specific IPs (configure in Google Cloud)
- SSL required for connections

### API Security
- CORS enabled for raas.help domain
- No authentication required (internal tool)
- Rate limiting via Vercel (automatic)

### Frontend Security
- Login page exists but not enforced
- Admin panel created but not functional (database connection issue)
- No sensitive data exposed to client

---

## 🎓 Understanding the Trading Strategy

### Core Concept
Trade stocks/crypto based on their ratio to BTC, comparing current ratio to historical baseline.

### Why This Works
1. **Correlation**: Most crypto/mining stocks correlate with BTC
2. **Mean Reversion**: Ratios tend to return to baseline
3. **Relative Strength**: Captures temporary imbalances
4. **Risk Management**: Trading the ratio is more stable than absolute prices

### Baseline Methods

#### Stock Methods (5)
1. **EQUAL_MEAN**: Simple average of all ratios in previous trading day
2. **VWAP_RATIO**: Volume-weighted average price ratio
3. **VOL_WEIGHTED**: Weighted by trading volume
4. **WINSORIZED**: Average with outliers capped (robust to spikes)
5. **WEIGHTED_MEDIAN**: Median with volume weighting

#### Crypto Methods (2)
1. **EQUAL_MEAN**: Simple average of all ratios in previous 24 hours
2. **WINSORIZED**: Average with outliers capped

### Trading Logic
1. **Calculate Ratio**: BTC_price / Stock_price (or Crypto_price)
2. **Calculate Deviation**: (Current_ratio - Baseline) / Baseline × 100%
3. **BUY Signal**: When deviation >= buy_threshold (e.g., 1.0%)
4. **SELL Signal**: When deviation <= sell_threshold (e.g., 1.0%)
5. **State Machine**: BUY → SELL → BUY → SELL (no position stacking)

### Example Trade
- **Baseline**: 68,000 (BTC/ETH ratio)
- **Current ratio**: 68,680 (1% above baseline)
- **Signal**: BUY ETH (it's relatively cheap)
- **Later ratio**: 68,000 (back to baseline)
- **Signal**: SELL ETH (ratio normalized)
- **Result**: Profit from ETH's relative recovery

---

## 🔮 Future Enhancements

### Planned Features
1. Real-time data updates (WebSocket integration)
2. User authentication and authorization
3. Custom alert system (email/SMS notifications)
4. Portfolio tracking and management
5. Backtesting with custom parameters
6. Machine learning predictions
7. Mobile app (React Native)

### Technical Improvements
1. Database query optimization (materialized views)
2. Caching layer (Redis)
3. API rate limiting per user
4. Automated testing (Jest, Cypress)
5. CI/CD pipeline (GitHub Actions)
6. Monitoring and alerting (Datadog, Sentry)

---

## 📚 Additional Resources

### Documentation
- Next.js: https://nextjs.org/docs
- Express: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/docs/
- Vercel: https://vercel.com/docs
- Recharts: https://recharts.org/

### Tools
- Vercel CLI: `npm i -g vercel`
- PostgreSQL Client: `brew install postgresql` (Mac) or `apt-get install postgresql-client` (Linux)
- Node Version Manager: https://github.com/nvm-sh/nvm

---

## ✅ Replication Checklist

To replicate this system from scratch:

### Database Setup
- [ ] Create Google Cloud SQL PostgreSQL instance
- [ ] Create 18 tables (10 stock + 8 crypto)
- [ ] Import historical data
- [ ] Create indexes for performance
- [ ] Configure firewall rules

### API Server Setup
- [ ] Clone api-server directory
- [ ] Install dependencies: `npm install`
- [ ] Create .env file with database credentials
- [ ] Test locally: `npm run dev`
- [ ] Deploy to Vercel
- [ ] Set environment variables in Vercel dashboard
- [ ] Test production endpoints

### Frontend Setup
- [ ] Clone frontend-dashboard directory
- [ ] Install dependencies: `npm install`
- [ ] Update API URL in lib/api.ts
- [ ] Test locally: `npm run dev`
- [ ] Deploy to Vercel
- [ ] Configure custom domain (raas.help)
- [ ] Test production site

### Data Pipeline Setup
- [ ] Set up data import scripts (daily-update-job.js, crypto-data-import-polygon.js)
- [ ] Set up baseline calculation scripts
- [ ] Set up event generation scripts (Cloud Run Jobs)
- [ ] Configure Cloud Scheduler for daily imports
- [ ] Test full pipeline end-to-end

### Verification
- [ ] All reports load without errors
- [ ] Data is accurate and up-to-date
- [ ] Performance is acceptable (<2s load time)
- [ ] No console errors in browser
- [ ] API endpoints return correct data
- [ ] Database queries are optimized

---

**Document Version**: 1.0  
**Last Updated**: November 2, 2025  
**Author**: SuperNinja AI Agent  
**For**: Logan @ TRADIAC Project