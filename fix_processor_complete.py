with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# Need to add back the baselineData initialization and loop
lines[397] = '      `, [date]);\n'
lines[398] = '      \n'
lines[399] = '      const baselineData = new Map();\n'
lines[400] = '      for (const row of baselineResult.rows) {\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed processor complete")
