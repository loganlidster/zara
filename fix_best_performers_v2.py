import re

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

# Fix the data references
content = content.replace('validData.length, \'out of\', data.length', 'validData.length, \'out of\', performersData.length')
content = content.replace('validData.length === 0 && data.length > 0', 'validData.length === 0 && performersData.length > 0')

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
    f.write(content)

print("Fixed Best Performers page to use v2 endpoint")