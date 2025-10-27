with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# Line 401 needs the key assignment
lines[401] = '        const key = `${row.symbol}_${row.method}_${row.session}`;\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed key assignment")
