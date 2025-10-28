import re

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'r') as f:
    content = f.read()

# Fix all toFixed calls to use parseFloat first
replacements = [
    (r'event\.stock_price\.toFixed\(4\)', 'parseFloat(event.stock_price).toFixed(4)'),
    (r'event\.btc_price\.toFixed\(2\)', 'parseFloat(event.btc_price).toFixed(2)'),
    (r'event\.ratio\.toFixed\(2\)', 'parseFloat(event.ratio).toFixed(2)'),
    (r'event\.baseline\.toFixed\(2\)', 'parseFloat(event.baseline).toFixed(2)'),
    (r'event\.trade_roi_pct\.toFixed\(2\)', 'parseFloat(event.trade_roi_pct).toFixed(2)'),
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'w') as f:
    f.write(content)

print("Fixed Fast Daily page")