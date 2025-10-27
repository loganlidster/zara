#!/usr/bin/env python3

with open('api-server/batch-daily-endpoint.js', 'r') as f:
    content = f.read()

# Fix the threshold calculations
content = content.replace(
    '    const buyThreshold = baseline * (1 - buyPct / 100);',
    '    const buyThreshold = baseline * (1 + buyPct / 100);  // CORRECT: Buy when ratio is HIGH'
)

content = content.replace(
    '    const sellThreshold = baseline * (1 + sellPct / 100);',
    '    const sellThreshold = baseline * (1 - sellPct / 100);  // CORRECT: Sell when ratio is LOW'
)

# Fix to use ratio instead of price
old_loop = '''    for (const bar of minuteData) {
      const price = parseFloat(bar.stock_c);
      
      // Buy signal
      if (shares === 0 && price <= buyThreshold) {
        shares = Math.floor(cash / price);
        cash -= shares * price;
        trades++;
      }
      // Sell signal
      else if (shares > 0 && price >= sellThreshold) {
        cash += shares * price;
        shares = 0;
        trades++;
      }
    }'''

new_loop = '''    for (const bar of minuteData) {
      const stockPrice = parseFloat(bar.stock_c);
      const btcPrice = parseFloat(bar.btc_c);
      const ratio = btcPrice / stockPrice;  // BTC / Stock
      
      // Buy signal - ratio is HIGH (BTC expensive relative to stock)
      if (shares === 0 && ratio >= buyThreshold) {
        shares = Math.floor(cash / stockPrice);
        cash -= shares * stockPrice;
        trades++;
      }
      // Sell signal - ratio is LOW (BTC cheap relative to stock)
      else if (shares > 0 && ratio <= sellThreshold) {
        cash += shares * stockPrice;
        shares = 0;
        trades++;
      }
    }'''

content = content.replace(old_loop, new_loop)

with open('api-server/batch-daily-endpoint.js', 'w') as f:
    f.write(content)

print("Fixed batch-daily-endpoint.js!")