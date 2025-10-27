#!/usr/bin/env python3

with open('api-server/fast-daily-endpoint.js', 'r') as f:
    content = f.read()

# Add decisionLog array after trades array
content = content.replace(
    '     const trades = [];',
    '     const trades = [];\n     const decisionLog = []; // Track every minute\'s decision'
)

# Add ratio calculation and decision tracking
old_code = '''       const stockPrice = parseFloat(bar.stock_price);
       const btcPrice = parseFloat(bar.btc_price);
       
       const buyThr = baseline * (1 + buyThreshold / 100);
       const sellThr = baseline * (1 - sellThreshold / 100);
       
       if (!position) {'''

new_code = '''       const stockPrice = parseFloat(bar.stock_price);
       const btcPrice = parseFloat(bar.btc_price);
       const ratio = stockPrice / btcPrice;
       
       const buyThr = baseline * (1 + buyThreshold / 100);
       const sellThr = baseline * (1 - sellThreshold / 100);
       
       let decision = 'HOLD';
       let positionStatus = position ? position.type : 'FLAT';
       
       if (!position) {'''

content = content.replace(old_code, new_code)

# Add decision logging for BUY
old_buy = '''           position = {
             type: 'LONG',
             entryTime: barTime,
             entryPrice: entryPrice,
             entryBaseline: baseline,
             entryBtcPrice: btcPrice,
             shares: Math.floor(10000 / entryPrice)
           };'''

new_buy = '''           position = {
             type: 'LONG',
             entryTime: barTime,
             entryPrice: entryPrice,
             entryBaseline: baseline,
             entryBtcPrice: btcPrice,
             shares: Math.floor(10000 / entryPrice)
           };
           decision = 'BUY';'''

content = content.replace(old_buy, new_buy)

# Add decision logging for SELL
old_sell = '''           trades.push({
             entryTime: position.entryTime,
             entryPrice: position.entryPrice,
             exitTime: barTime,
             exitPrice: exitPrice,
             return: tradeReturn,
             stockDelta: stockDelta,
             btcDelta: btcDelta
           });
           
           position = null;'''

new_sell = '''           trades.push({
             entryTime: position.entryTime,
             entryPrice: position.entryPrice,
             exitTime: barTime,
             exitPrice: exitPrice,
             return: tradeReturn,
             stockDelta: stockDelta,
             btcDelta: btcDelta
           });
           
           decision = 'SELL';
           position = null;'''

content = content.replace(old_sell, new_sell)

# Add decision log entry at end of loop
old_loop_end = '''       }
     }
     
     // Calculate summary'''

new_loop_end = '''       }
       
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
     
     // Calculate summary'''

content = content.replace(old_loop_end, new_loop_end)

# Add decisionLog to return value
old_return = '''     return {
       symbol,
       method,
       buyThreshold,
       sellThreshold,
       trades,
       totalReturn,
       avgReturn,
       winningTrades,
       losingTrades,
       winRate
     };'''

new_return = '''     return {
       symbol,
       method,
       buyThreshold,
       sellThreshold,
       trades,
       totalReturn,
       avgReturn,
       winningTrades,
       losingTrades,
       winRate,
       decisionLog  // Include minute-by-minute decisions
     };'''

content = content.replace(old_return, new_return)

with open('api-server/fast-daily-endpoint.js', 'w') as f:
    f.write(content)

print("Added decision logging!")