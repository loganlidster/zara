#!/usr/bin/env python3

with open('api-server/fast-daily-endpoint.js', 'r') as f:
    lines = f.readlines()

# Find the return statement and fix it
for i in range(len(lines)):
    if i > 220 and 'return {' in lines[i] and 'symbol,' in lines[i+1]:
        # Found the return statement, replace the next 20 lines
        new_code = '''     const result = {
       symbol,
       method,
       buyThreshold,
       sellThreshold,
       totalReturn,
       avgReturn,
       tradeCount: trades.length,
       winRate,
       trades
     };
     
     // Only include decisionLog if requested
     if (includeDecisionLog && decisionLog) {
       result.decisionLog = decisionLog;
     }
     
     return result;
   }
'''
        # Remove old lines and insert new
        del lines[i:i+18]
        lines.insert(i, new_code)
        break

with open('api-server/fast-daily-endpoint.js', 'w') as f:
    f.writelines(lines)

print("Fixed return statement!")