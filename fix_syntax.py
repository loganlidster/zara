#!/usr/bin/env python3

# Read the file
with open('api-server/server.js', 'r') as f:
    lines = f.readlines()

# Fix line 129 (index 128)
if '} = bar;, session: barSession } = bar;' in lines[128]:
    lines[128] = lines[128].replace('} = bar;, session: barSession } = bar;', ', session: barSession } = bar;')
    print("Fixed syntax error on line 129")

# Write back
with open('api-server/server.js', 'w') as f:
    f.writelines(lines)

print("Done!")