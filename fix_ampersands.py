with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'r') as f:
    content = f.read()

# Replace all &amp;&amp; with &&
content = content.replace('&amp;&amp;', '&&')

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'w') as f:
    f.write(content)

print("Fixed ampersands")