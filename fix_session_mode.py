#!/usr/bin/env python3
import re

# Read the file
with open('api-server/server.js', 'r') as f:
    content = f.read()

# Find and replace the section
old_pattern = r'(for \(const bar of result\.rows\) \{\s+const \{ et_date, et_time, stock_close, btc_close, baseline, current_ratio, prev_open_date \} = bar;)\s+const buyThreshold = baseline \* \(1 \+ buyPct / 100\);\s+const sellThreshold = baseline \* \(1 - sellPct / 100\);'

new_code = r'''\1, session: barSession } = bar;
   
         // Determine which thresholds to use based on session mode
         let buyThreshold, sellThreshold;
         
         if (sessionMode === 'ALL') {
           // Use session-specific thresholds
           if (barSession === 'RTH') {
             buyThreshold = baseline * (1 + rthBuyPct / 100);
             sellThreshold = baseline * (1 - rthSellPct / 100);
           } else if (barSession === 'AH') {
             buyThreshold = baseline * (1 + ahBuyPct / 100);
             sellThreshold = baseline * (1 - ahSellPct / 100);
           } else {
             // Fallback to single session values
             buyThreshold = baseline * (1 + buyPct / 100);
             sellThreshold = baseline * (1 - sellPct / 100);
           }
         } else {
           // Single session mode - use single values
           buyThreshold = baseline * (1 + buyPct / 100);
           sellThreshold = baseline * (1 - sellPct / 100);
         }'''

content = re.sub(old_pattern, new_code, content, flags=re.MULTILINE | re.DOTALL)

# Write back
with open('api-server/server.js', 'w') as f:
    f.write(content)

print("Fixed session mode handling!")