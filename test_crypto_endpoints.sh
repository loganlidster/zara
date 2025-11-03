#!/bin/bash
# Test the 3 new crypto endpoints

API_URL="https://api-server-neon-five.vercel.app"

echo "=== Testing Crypto Endpoints ==="
echo ""

echo "1. Grid Search (ADA, EQUAL_MEAN, Oct 2024):"
curl -s "${API_URL}/api/crypto/grid-search-simple?symbol=ADA&method=EQUAL_MEAN&start_date=2024-10-01&end_date=2024-10-31" | jq '.success, .combinations, .best_combination | {buy_pct, sell_pct, total_return, completed_trades}'
echo ""

echo "2. Fast Daily (ADA, EQUAL_MEAN, top 10):"
curl -s "${API_URL}/api/crypto/fast-daily-simple?symbol=ADA&method=EQUAL_MEAN&start_date=2024-10-01&end_date=2024-10-31&limit=10" | jq '.success, .total_combinations, .results[0] | {symbol, buy_pct, sell_pct, total_return, num_trades}'
echo ""

echo "3. Daily Curve (ADA, EQUAL_MEAN, 1.0/2.0):"
curl -s "${API_URL}/api/crypto/daily-curve-simple?symbol=ADA&method=EQUAL_MEAN&buy_pct=1.0&sell_pct=2.0&start_date=2024-10-01&end_date=2024-10-31" | jq '.success, .summary'
echo ""

echo "=== Test Complete ==="