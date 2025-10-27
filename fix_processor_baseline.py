with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# Fix lines 390-395 (0-indexed: 389-394)
lines[389] = '      // Load baselines for the PREVIOUS trading day (lagging baseline strategy)\n'
lines[390] = '      const baselineResult = await client.query(`\n'
lines[391] = '        SELECT symbol, method, session, baseline\n'
lines[392] = '        FROM baseline_daily\n'
lines[393] = '        WHERE trading_day < $1\n'
lines[394] = '        ORDER BY trading_day DESC\n'
lines[395] = '        LIMIT 1\n'
lines[396] = '      `, [date]);\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed processor baseline query")
