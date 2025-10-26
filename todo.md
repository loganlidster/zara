# TRADIAC Platform - Focused TODO List

## ✅ COMPLETED
- [x] Data pipeline built and all data loaded
- [x] Trading calendar imported
- [x] Web UI with single simulation working
- [x] Web UI with batch grid search working
- [x] Delta columns (stock and BTC) added
- [x] CSV export functionality
- [x] Grant's baseline CSV received for comparison

## 🎯 CURRENT PRIORITY: Baseline Recalculation

### Step 1: Recalculate Baselines with Sessions ⏳
- [ ] Grant runs: `data-pipeline\run-recalculate.bat`
- [ ] Verify baselines match Grant's CSV
- [ ] Confirm RTH and AH baselines calculated correctly

### Step 2: Create Dual Pre-Computed Tables
- [ ] Grant runs SQL to create tables (PASTE_INTO_CLOUD_SQL.sql)
- [ ] Verify 5 tables created successfully

### Step 3: Test Dual Processor
- [ ] Run processor on single day (2024-01-02)
- [ ] Verify trades created in both RTH and ALL tables
- [ ] Compare results with Python tool

### Step 4: Full Backfill
- [ ] Run processor on full date range (2024-01-01 to 2025-10-26)
- [ ] Monitor progress and performance
- [ ] Verify total trade counts

## 📋 NEXT FEATURES (After Pre-Computation Works)

### Phase 1: Get Current Tools Working Online
- [ ] Update web UI to query pre-computed tables
- [ ] Test query speed (should be < 1 second)
- [ ] Verify results match on-demand simulator

### Phase 2: Build Missing Tools from Python App
- [ ] Baseline calculator (sanity check tool)
- [ ] Coverage viewer (data quality dashboard)
- [ ] Raw data viewer
- [ ] Correlation analysis
- [ ] Regime detection

### Phase 3: Advanced Features
- [ ] Surge feature (tiered position sizing)
- [ ] Context tracking (BTC momentum, volatility, etc.)
- [ ] Pattern analysis
- [ ] ML models for prediction

## 🚫 NOT DOING RIGHT NOW
- Dual-session with different settings (use on-demand simulator)
- Custom entry/exit rules (use on-demand simulator)
- Deployment to production (after testing complete)
- Additional data providers
- Real-time velocity triggers

## 📝 NOTES
- Focus on one step at a time
- Verify each step before moving to next
- Use Grant's CSV for comparison only (not importing it)
- Keep on-demand simulator for flexible testing
- Pre-computed tables for fast historical queries