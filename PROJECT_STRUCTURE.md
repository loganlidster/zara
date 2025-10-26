# 🏗️ PROJECT STRUCTURE - TRADING ANALYSIS PLATFORM

## Project Name: `tradiac-testing-platform`

```
tradiac-testing-platform/
├── README.md
├── .gitignore
├── package.json
│
├── database/
│   ├── schema/
│   │   ├── 01_create_tables.sql          # PostgreSQL tables
│   │   ├── 02_create_indexes.sql         # Performance indexes
│   │   ├── 03_create_functions.sql       # Database functions
│   │   └── 04_bigquery_schema.sql        # BigQuery tables (future)
│   └── migrations/
│       └── (future migration scripts)
│
├── data-pipeline/
│   ├── package.json
│   ├── src/
│   │   ├── fetchers/
│   │   │   ├── polygon-fetcher.js        # Fetch from Polygon.io
│   │   │   └── tradiac-fetcher.js        # Fetch from TRADIAC (future)
│   │   ├── processors/
│   │   │   ├── baseline-calculator.js    # 5 baseline methods
│   │   │   └── data-cleaner.js           # Data validation
│   │   ├── storage/
│   │   │   ├── postgres-writer.js        # Write to PostgreSQL
│   │   │   └── bigquery-writer.js        # Write to BigQuery (future)
│   │   └── index.js                      # Main orchestrator
│   └── config/
│       └── config.js                     # API keys, DB connections
│
├── simulation-engine/
│   ├── package.json
│   ├── src/
│   │   ├── core/
│   │   │   ├── simulator.js              # Main simulation logic
│   │   │   ├── trade-executor.js         # Trade execution (assume fills)
│   │   │   └── position-manager.js       # Track positions overnight
│   │   ├── metrics/
│   │   │   ├── performance-calculator.js # Returns, Sharpe, drawdown
│   │   │   └── trade-analyzer.js         # Win rate, trade stats
│   │   ├── optimizers/
│   │   │   ├── grid-search.js            # Test all combinations
│   │   │   └── best-finder.js            # Find optimal settings
│   │   └── index.js
│   └── config/
│       └── config.js
│
├── cloud-functions/
│   ├── package.json
│   ├── functions/
│   │   ├── runSimulation/
│   │   │   └── index.js                  # Single simulation API
│   │   ├── runGridSearch/
│   │   │   └── index.js                  # Grid search API
│   │   ├── getOptimalSettings/
│   │   │   └── index.js                  # Get best settings API
│   │   ├── getHistoricalData/
│   │   │   └── index.js                  # Fetch data API
│   │   └── getLiveMetrics/
│   │       └── index.js                  # TRADIAC live data API (future)
│   └── shared/
│       ├── db.js                         # Database connections
│       └── utils.js                      # Shared utilities
│
├── frontend/
│   ├── package.json
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── SimulationForm.jsx        # Input form
│   │   │   ├── EquityCurve.jsx           # Chart component
│   │   │   ├── PerformanceMetrics.jsx    # Metrics display
│   │   │   ├── TradeList.jsx             # Trade table
│   │   │   ├── Heatmap.jsx               # Buy/Sell heatmap
│   │   │   ├── GridSearchResults.jsx     # Grid search results
│   │   │   └── ComparisonView.jsx        # Compare strategies
│   │   ├── pages/
│   │   │   ├── SingleSimulation.jsx      # Main simulation page
│   │   │   ├── GridSearch.jsx            # Grid search page
│   │   │   ├── Optimization.jsx          # Optimization dashboard
│   │   │   └── LiveMetrics.jsx           # Live TRADIAC metrics (future)
│   │   ├── services/
│   │   │   └── api.js                    # API calls to Cloud Functions
│   │   ├── utils/
│   │   │   └── formatters.js             # Data formatting
│   │   ├── App.jsx
│   │   └── index.js
│   ├── firebase.json
│   └── .firebaserc
│
├── scripts/
│   ├── setup-gcloud.sh                   # Google Cloud setup
│   ├── deploy-database.sh                # Deploy database schema
│   ├── deploy-functions.sh               # Deploy Cloud Functions
│   ├── deploy-frontend.sh                # Deploy React app
│   ├── backfill-data.sh                  # Initial data load
│   └── run-local.sh                      # Local development
│
├── docs/
│   ├── API.md                            # API documentation
│   ├── DATABASE.md                       # Database schema docs
│   ├── DEPLOYMENT.md                     # Deployment guide
│   └── DEVELOPMENT.md                    # Development guide
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Key Technologies

### Backend
- **Node.js 20.x** - Runtime
- **Google Cloud Functions** - Serverless compute
- **PostgreSQL 15** - Primary database (Google Cloud SQL)
- **BigQuery** - Analytics database (future)
- **Polygon.io API** - Market data source

### Frontend
- **React 18** - UI framework
- **Material-UI (MUI)** - Component library
- **Recharts** - Charting library
- **Firebase Hosting** - Static hosting

### DevOps
- **GitHub** - Version control
- **Google Cloud Build** - CI/CD (optional)
- **Cloud Shell** - Development environment

## Environment Variables

```bash
# .env file structure
POLYGON_API_KEY=your_polygon_key
POSTGRES_HOST=your-cloud-sql-instance
POSTGRES_DB=tradiac_testing
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
GOOGLE_CLOUD_PROJECT=your-project-id
```

## Next Steps

1. Create Google Cloud project
2. Set up PostgreSQL instance
3. Clone repository structure
4. Install dependencies
5. Configure environment variables
6. Deploy database schema
7. Run data backfill
8. Deploy Cloud Functions
9. Deploy frontend
10. Test end-to-end

Ready to start building! 🚀