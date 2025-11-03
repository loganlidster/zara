#!/bin/bash
# Monitor crypto event generation progress

echo "=== CRYPTO EVENT GENERATION MONITOR ==="
echo ""

while true; do
  clear
  echo "=== CRYPTO EVENT GENERATION PROGRESS ==="
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
SELECT 
  'EQUAL_MEAN' as method,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols_processed,
  MIN(event_timestamp::date) as earliest_date,
  MAX(event_timestamp::date) as latest_date,
  ROUND(COUNT(*)::numeric / 8500000 * 100, 1) as pct_complete
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 
  'WINSORIZED' as method,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols_processed,
  MIN(event_timestamp::date) as earliest_date,
  MAX(event_timestamp::date) as latest_date,
  ROUND(COUNT(*)::numeric / 8500000 * 100, 1) as pct_complete
FROM trade_events_crypto_winsorized
ORDER BY method;
EOF
  
  echo ""
  echo "Target: ~8.5M events per method (17M total)"
  echo "Press Ctrl+C to stop monitoring"
  echo ""
  
  sleep 30
done