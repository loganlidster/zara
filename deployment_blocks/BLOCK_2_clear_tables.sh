#!/bin/bash
# BLOCK 2: Clear Old Event Tables
# This removes all existing events to start fresh

PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
SELECT 'Tables cleared successfully' as status;
EOF