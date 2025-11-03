#!/bin/bash
# Check event counts after generation completes

PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
SELECT 
  'EQUAL_MEAN' as method,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols,
  MIN(event_timestamp::date) as earliest_date,
  MAX(event_timestamp::date) as latest_date
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 
  'WINSORIZED' as method,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols,
  MIN(event_timestamp::date) as earliest_date,
  MAX(event_timestamp::date) as latest_date
FROM trade_events_crypto_winsorized
ORDER BY method;
EOF