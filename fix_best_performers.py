import re

# Read the file
with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

# Replace all occurrences of snake_case with camelCase
replacements = [
    ('roi_pct', 'roiPct'),
    ('buy_pct', 'buyPct'),
    ('sell_pct', 'sellPct'),
    ('total_events', 'totalEvents'),
    ('buy_events', 'buyEvents'),
    ('sell_events', 'sellEvents'),
]

for old, new in replacements:
    content = content.replace(old, new)

# Write back
with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
    f.write(content)

print("Fixed all field names in best-performers page")