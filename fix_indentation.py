with open('api-server/fast-daily-endpoint.js', 'r') as f:
    lines = f.readlines()

# Fix lines 102-112 (0-indexed: 101-111)
lines[101] = '     // Get baselines for the PREVIOUS trading day (lagging baseline strategy)\n'
lines[102] = '     // We use yesterday\'s baseline to trade today\n'
lines[103] = '     const baselineResult = await client.query(`\n'
lines[104] = '       SELECT session, baseline\n'
lines[105] = '       FROM baseline_daily\n'
lines[106] = '       WHERE trading_day < $1\n'
lines[107] = '         AND symbol = $2\n'
lines[108] = '         AND method = $3\n'
lines[109] = '       ORDER BY trading_day DESC\n'
lines[110] = '       LIMIT 1\n'
lines[111] = '     `, [date, symbol, method]);\n'

with open('api-server/fast-daily-endpoint.js', 'w') as f:
    f.writelines(lines)

print("Fixed indentation")
