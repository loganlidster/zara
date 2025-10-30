with open('api-server/daily-curve-endpoint.js', 'r') as f:
    content = f.read()

# Find and replace the simulation function call
old_call = "const result = simulateDailyCurve(allEvents, initialCapital);"
new_call = "const result = simulateDailyCurve(allEvents, initialCapital, slippagePct, conservativeRounding);"

if old_call in content:
    content = content.replace(old_call, new_call)
    print("✓ Updated function call")
else:
    print("✗ Function call not found")

# Add slippage and conservativeRounding to request body destructuring
old_destructure = """      const {
        symbols,
        method,
        session,
        buyPct,
        sellPct,
        startDate,
        endDate,
        alignmentMode = 'union',
        includeBtc = true
      } = req.body;"""

new_destructure = """      const {
        symbols,
        method,
        session,
        buyPct,
        sellPct,
        startDate,
        endDate,
        alignmentMode = 'union',
        includeBtc = true,
        slippagePct = 0,
        conservativeRounding = false
      } = req.body;"""

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure)
    print("✓ Updated request body destructuring")
else:
    print("✗ Destructuring not found")

# Update the for loop to apply slippage and rounding
old_loop = """       for (const event of dayEvents) {
         const price = parseFloat(event.stock_price);
         
         if (event.event_type === 'BUY' && shares === 0) {"""

new_loop = """       for (const event of dayEvents) {
         let price = parseFloat(event.stock_price);
         const isBuy = event.event_type === 'BUY';
         
         // Apply slippage if enabled
         if (slippagePct > 0) {
           price = applySlippage(price, slippagePct, isBuy);
         }
         
         // Apply conservative rounding if enabled
         if (conservativeRounding) {
           price = applyConservativeRounding(price, isBuy);
         }
         
         if (event.event_type === 'BUY' && shares === 0) {"""

if old_loop in content:
    content = content.replace(old_loop, new_loop)
    print("✓ Updated trading loop")
else:
    print("✗ Trading loop not found")

with open('api-server/daily-curve-endpoint.js', 'w') as f:
    f.write(content)

print("\nDone! File updated.")
