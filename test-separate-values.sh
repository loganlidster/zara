#!/bin/bash

echo "=== Testing Separate RTH/AH Values API ==="
echo ""

echo "1. Testing RTH only (old format - should still work)..."
curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-09-01&endDate=2024-09-30" | jq '.success, .session, .eventCount'

echo ""
echo "2. Testing AH only (old format - should still work)..."
curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=AH&buyPct=1.0&sellPct=1.0&startDate=2024-09-01&endDate=2024-09-30" | jq '.success, .session, .eventCount'

echo ""
echo "3. Testing ALL session with separate values (NEW FEATURE)..."
curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=ALL&rthBuyPct=0.5&rthSellPct=0.5&ahBuyPct=1.0&ahSellPct=1.0&startDate=2024-09-01&endDate=2024-09-30" | jq '.success, .session, .rthEventCount, .ahEventCount, .eventCount, .tablesQueried'

echo ""
echo "4. Testing summary with ALL session..."
curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/summary?symbol=HIVE&method=EQUAL_MEAN&session=ALL&rthBuyPct=0.5&rthSellPct=0.5&ahBuyPct=1.0&ahSellPct=1.0&startDate=2024-09-01&endDate=2024-09-30" | jq '.success, .summary.roiPct, .summary.totalEvents'

echo ""
echo "=== Test Complete ==="