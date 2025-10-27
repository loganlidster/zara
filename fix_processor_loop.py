with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# Line 401 (0-indexed: 400) needs the key assignment
lines[400] = '        const key = `${row.symbol}_${row.method}_${row.session}`;\n'
lines[401] = '        baselineData.set(key, parseFloat(row.baseline));\n'
lines[402] = '      }\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed processor loop")
