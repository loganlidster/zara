#!/bin/bash
# Check baseline coverage for date range

PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
SELECT 
  COUNT(*) as total_baselines,
  COUNT(DISTINCT trading_day) as days_with_baselines,
  COUNT(DISTINCT symbol) as symbols,
  MIN(trading_day) as earliest_baseline,
  MAX(trading_day) as latest_baseline
FROM baseline_daily_crypto
WHERE trading_day >= '2024-10-01' 
  AND trading_day <= '2025-11-02';
EOF