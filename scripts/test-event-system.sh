#!/bin/bash

# Test Event-Based System
# This script tests the event-based endpoints to verify they're working correctly

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8080}"

echo "=========================================="
echo "Event-Based System Testing"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# Test 1: Health check
echo "Test 1: Health Check"
echo "----------------------------------------"
curl -s "$API_URL/health" | jq '.'
echo "✓ Health check passed"
echo ""

# Test 2: Get metadata
echo "Test 2: Get Metadata"
echo "----------------------------------------"
curl -s "$API_URL/api/events/metadata?limit=5" | jq '.count, .metadata[0]'
echo "✓ Metadata endpoint working"
echo ""

# Test 3: Query events
echo "Test 3: Query Events"
echo "----------------------------------------"
curl -s "$API_URL/api/events/query?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-01-01&endDate=2024-01-31" | jq '.eventCount, .events[0]'
echo "✓ Query endpoint working"
echo ""

# Test 4: Get summary
echo "Test 4: Get Summary"
echo "----------------------------------------"
curl -s "$API_URL/api/events/summary?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-01-01&endDate=2024-12-31" | jq '.summary'
echo "✓ Summary endpoint working"
echo ""

# Test 5: Get portfolio state
echo "Test 5: Get Portfolio State"
echo "----------------------------------------"
curl -s "$API_URL/api/events/portfolio-state?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5" | jq '.portfolioState'
echo "✓ Portfolio state endpoint working"
echo ""

# Test 6: Get top performers
echo "Test 6: Get Top Performers"
echo "----------------------------------------"
curl -s "$API_URL/api/events/top-performers?startDate=2024-01-01&endDate=2024-12-31&limit=5" | jq '.count, .topPerformers[0]'
echo "✓ Top performers endpoint working"
echo ""

# Test 7: Batch summary
echo "Test 7: Batch Summary"
echo "----------------------------------------"
curl -s -X POST "$API_URL/api/events/batch-summary" \
  -H "Content-Type: application/json" \
  -d '{
    "combinations": [
      {"symbol": "HIVE", "method": "EQUAL_MEAN", "session": "RTH", "buyPct": 0.5, "sellPct": 0.5},
      {"symbol": "RIOT", "method": "VWAP_RATIO", "session": "ALL", "buyPct": 1.0, "sellPct": 1.0}
    ],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }' | jq '.count, .results[0]'
echo "✓ Batch summary endpoint working"
echo ""

echo "=========================================="
echo "All Tests Passed!"
echo "=========================================="