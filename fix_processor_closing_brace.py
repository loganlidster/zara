with open('processor/nightly-processor-dual.js', 'r') as f:
    lines = f.readlines()

# Line 403 needs the closing brace
lines[403] = '      }\n'

with open('processor/nightly-processor-dual.js', 'w') as f:
    f.writelines(lines)

print("Fixed closing brace")
