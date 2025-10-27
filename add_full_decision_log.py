#!/usr/bin/env python3
import re

with open('api-server/fast-daily-endpoint.js', 'r') as f:
    lines = f.readlines()

# Find the line with "const btcPrice = parseFloat(bar.btc_price);"
for i, line in enumerate(lines):
    if 'const btcPrice = parseFloat(bar.btc_price);' in line:
        # Add ratio calculation after btcPrice
        lines.insert(i + 1, '       const ratio = stockPrice / btcPrice;\n')
        break

# Find the line with "const sellThr = baseline * (1 - sellThreshold / 100);"
for i, line in enumerate(lines):
    if 'const sellThr = baseline * (1 - sellThreshold / 100);' in line:
        # Add decision tracking variables after sellThr
        lines.insert(i + 1, '       \n')
        lines.insert(i + 2, '       let decision = \'HOLD\';\n')
        lines.insert(i + 3, '       let positionStatus = position ? position.type : \'FLAT\';\n')
        break

# Find where position is set (BUY)
for i, line in enumerate(lines):
    if 'shares: Math.floor(10000 / entryPrice)' in line:
        # Add decision = 'BUY' after the closing brace
        if i + 1 < len(lines) and '};' in lines[i + 1]:
            lines.insert(i + 2, '           decision = \'BUY\';\n')
            break

# Find where position is set to null (SELL)
for i, line in enumerate(lines):
    if 'position = null;' in line and 'decision = ' not in lines[i-1]:
        # Add decision = 'SELL' before position = null
        lines.insert(i, '           decision = \'SELL\';\n')
        break

# Find the end of the for loop (before "// Calculate summary")
for i, line in enumerate(lines):
    if '// Calculate summary' in line:
        # Add decision log entry before this
        log_code = '''       
       // Log this minute's decision
       decisionLog.push({
         time: barTime,
         session: barSession,
         btc_price: btcPrice,
         stock_price: stockPrice,
         ratio: ratio,
         baseline: baseline,
         buy_threshold: buyThr,
         sell_threshold: sellThr,
         decision: decision,
         position: positionStatus
       });
     }
     
'''
        lines.insert(i - 2, log_code)  # Insert before the closing brace and blank line
        break

# Find the return statement and add decisionLog
for i, line in enumerate(lines):
    if 'winRate' in line and i + 1 < len(lines) and '};' in lines[i + 1]:
        lines[i] = line.rstrip() + ',\n'
        lines.insert(i + 1, '       decisionLog  // Include minute-by-minute decisions\n')
        break

with open('api-server/fast-daily-endpoint.js', 'w') as f:
    f.writelines(lines)

print("Added full decision logging!")