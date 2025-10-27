with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# Line 402 needs the set call
lines[402] = '        baselineData.set(key, parseFloat(row.baseline));\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed set call")
