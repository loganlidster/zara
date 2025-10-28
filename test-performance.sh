#!/bin/bash

echo "=== Performance Test: Specialized Tables vs Old System ==="
echo ""
echo "Testing query for HIVE, EQUAL_MEAN, RTH, 0.5/0.5, Sept 2024"
echo ""

# Test the optimized endpoint (using specialized table)
echo "1. Testing OPTIMIZED endpoint (specialized table)..."
time curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-09-01&endDate=2024-09-30" > /dev/null

echo ""
echo "2. Testing OPTIMIZED endpoint again (to verify consistency)..."
time curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-09-01&endDate=2024-09-30" > /dev/null

echo ""
echo "3. Testing OPTIMIZED endpoint third time..."
time curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-09-01&endDate=2024-09-30" > /dev/null

echo ""
echo "=== Summary endpoint test ==="
echo ""
echo "Testing summary calculation..."
time curl -s "https://tradiac-api-941257247637.us-central1.run.app/api/events/summary?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-09-01&endDate=2024-09-30" > /dev/null

echo ""
echo "=== Test Complete ==="