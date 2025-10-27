with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# The processor needs to get baselines for ALL symbols, not just one
# We need a different approach - get the most recent baseline before the date for each symbol/method/session
lines[389] = '      // Load baselines for the PREVIOUS trading day (lagging baseline strategy)\n'
lines[390] = '      // For each symbol/method/session, get the most recent baseline before this date\n'
lines[391] = '      const baselineResult = await client.query(`\n'
lines[392] = '        SELECT DISTINCT ON (symbol, method, session) \n'
lines[393] = '          symbol, method, session, baseline\n'
lines[394] = '        FROM baseline_daily\n'
lines[395] = '        WHERE trading_day < $1\n'
lines[396] = '        ORDER BY symbol, method, session, trading_day DESC\n'
lines[397] = '      `, [date]);\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed processor baseline query to get all symbols")
