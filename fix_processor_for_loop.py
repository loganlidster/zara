with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# Line 400 needs the for loop
lines[400] = '      for (const row of baselineResult.rows) {\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed for loop")
