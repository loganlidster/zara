#!/usr/bin/env python3

# Read the file
with open('api-server/fast-daily-endpoint.js', 'r') as f:
    lines = f.readlines()

# Find and modify the lines
for i in range(len(lines)):
    # Add logging after "if (dataResult.rows.length === 0)"
    if i < len(lines) - 1 and 'if (dataResult.rows.length === 0)' in lines[i]:
        # Insert after the return null line
        if 'return null;' in lines[i+1]:
            lines[i+1] = lines[i+1].replace('return null;', 
                'console.log(`  ❌ No minute data found for ${symbol} on ${date}`);\n       return null;')
    
    # Add logging after data is found
    if '// Get baselines for the PREVIOUS trading day' in lines[i]:
        lines.insert(i, '     console.log(`  ✅ Found ${dataResult.rows.length} minute bars for ${symbol} on ${date}`);\n     \n')
        break

# Find and add baseline logging
for i in range(len(lines)):
    if 'if (Object.keys(baselines).length === 0)' in lines[i]:
        # Insert before this line
        lines.insert(i, '     console.log(`  Baselines for ${symbol} ${method} on ${date}:`, baselines);\n     \n')
        # Modify the return null inside
        if i+1 < len(lines) and 'return null;' in lines[i+1]:
            lines[i+1] = lines[i+1].replace('return null;',
                'console.log(`  ❌ No baselines found for ${symbol} ${method} on ${date}`);\n       return null;')
        break

# Write back
with open('api-server/fast-daily-endpoint.js', 'w') as f:
    f.writelines(lines)

print("Added debug logging!")