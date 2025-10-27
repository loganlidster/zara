with open('api-server/fast-daily-endpoint.js', 'r') as f:
    content = f.read()

# Find and replace the baseline query section
old_section = """     // Get baselines for the PREVIOUS trading day (lagging baseline strategy)
     // We use yesterday's baseline to trade today
     const baselineResult = await client.query(`
       SELECT session, baseline
       FROM baseline_daily
       WHERE trading_day < $1
         AND symbol = $2
         AND method = $3
       ORDER BY trading_day DESC
       LIMIT 1
     `, [date, symbol, method]);"""

new_section = """     // Get baselines for the PREVIOUS trading day (lagging baseline strategy)
     // We use yesterday's baseline to trade today
     const baselineResult = await client.query(`
       SELECT session, baseline
       FROM baseline_daily
       WHERE trading_day < $1
         AND symbol = $2
         AND method = $3
       ORDER BY trading_day DESC
       LIMIT 1
     `, [date, symbol, method]);"""

# The content should already be correct, just verify
if "trading_day < $1" in content:
    print("✓ Baseline query updated to use previous trading day")
else:
    print("✗ Query not updated correctly")

# Check for duplicate lines
lines = content.split('\n')
for i, line in enumerate(lines[100:115], start=100):
    print(f"{i}: {repr(line[:80])}")
