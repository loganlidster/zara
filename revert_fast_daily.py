import re

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'r') as f:
    content = f.read()

# Revert parseFloat calls since we're fixing it in the API client
replacements = [
    (r'parseFloat\(event\.stock_price\)\.toFixed\(4\)', 'event.stock_price.toFixed(4)'),
    (r'parseFloat\(event\.btc_price\)\.toFixed\(2\)', 'event.btc_price.toFixed(2)'),
    (r'parseFloat\(event\.ratio\)\.toFixed\(2\)', 'event.ratio.toFixed(2)'),
    (r'parseFloat\(event\.baseline\)\.toFixed\(2\)', 'event.baseline.toFixed(2)'),
    (r'parseFloat\(event\.trade_roi_pct\)\.toFixed\(2\)', 'event.trade_roi_pct.toFixed(2)'),
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'w') as f:
    f.write(content)

print("Reverted Fast Daily page")