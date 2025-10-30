#!/bin/bash

# Test script for BTC Overlay Report endpoints
# Usage: ./test-btc-overlay-endpoints.sh

API_URL="http://localhost:3001"

echo "🧪 Testing BTC Overlay Report Endpoints"
echo "========================================"
echo ""

# Test 1: BTC Overlay Data
echo "1️⃣ Testing /api/btc-overlay-data"
echo "-----------------------------------"
curl -X POST "${API_URL}/api/btc-overlay-data" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "RIOT",
    "startDate": "2024-10-24",
    "endDate": "2024-10-24",
    "sessionType": "RTH"
  }' | jq '.success, .dataPoints, .data[0:3]'

echo ""
echo ""

# Test 2: Baseline Values
echo "2️⃣ Testing /api/baseline-values"
echo "-----------------------------------"
curl -X POST "${API_URL}/api/baseline-values" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "RIOT",
    "startDate": "2024-10-24",
    "endDate": "2024-10-29",
    "method": "VWAP_RATIO",
    "sessionType": "RTH"
  }' | jq '.success, .baselines[0:3]'

echo ""
echo ""

# Test 3: Simulate Trades Detailed
echo "3️⃣ Testing /api/simulate-trades-detailed"
echo "-----------------------------------"
curl -X POST "${API_URL}/api/simulate-trades-detailed" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "RIOT",
    "startDate": "2024-10-24",
    "endDate": "2024-10-29",
    "method": "VWAP_RATIO",
    "buyThreshold": 0.5,
    "sellThreshold": 1.0,
    "sessionType": "RTH",
    "conservativePricing": true,
    "slippage": 0.0,
    "initialCapital": 10000
  }' | jq '.success, .summary, .trades[0:2]'

echo ""
echo ""
echo "✅ All tests completed!"