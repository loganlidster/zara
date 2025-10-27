#!/usr/bin/env python3

with open('api-server/fast-daily-endpoint.js', 'r') as f:
    content = f.read()

# Fix 1: Change ratio calculation from Stock/BTC to BTC/Stock
content = content.replace(
    '       const ratio = stockPrice / btcPrice;',
    '       const ratio = btcPrice / stockPrice;  // CORRECT: BTC / Stock'
)

# Fix 2: Change buy condition from stockPrice to ratio
content = content.replace(
    '         if (stockPrice >= buyThr) {',
    '         if (ratio >= buyThr) {  // Compare RATIO to threshold'
)

# Fix 3: Change sell condition from stockPrice to ratio
content = content.replace(
    '           shouldExit = stockPrice <= sellThr;',
    '           shouldExit = ratio <= sellThr;  // Compare RATIO to threshold'
)

with open('api-server/fast-daily-endpoint.js', 'w') as f:
    f.write(content)

print("Fixed ratio logic!")