import os
import re

reports = [
    'frontend-dashboard/app/reports/best-performers/page.tsx',
    'frontend-dashboard/app/reports/daily-curve/page.tsx',
    'frontend-dashboard/app/reports/fast-daily/page.tsx',
    'frontend-dashboard/app/reports/overreaction-analysis/page.tsx',
    'frontend-dashboard/app/reports/pattern-deep-dive/page.tsx',
    'frontend-dashboard/app/reports/pattern-overview/page.tsx'
]

back_button = '''              <a
                href="/"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Back to Home
              </a>'''

for report_path in reports:
    if not os.path.exists(report_path):
        print(f"Skipping {report_path} - not found")
        continue
    
    with open(report_path, 'r') as f:
        content = f.read()
    
    # Find h1 tags and add back button
    # Pattern: <h1 className="text-3xl font-bold...">Title</h1>
    pattern = r'(<h1 className="text-3xl font-bold[^>]*>)([^<]+)(</h1>)'
    
    def replace_header(match):
        opening = match.group(1)
        title = match.group(2)
        closing = match.group(3)
        
        # Check if back button already exists
        if '← Back to Home' in content[max(0, match.start()-500):match.end()+500]:
            return match.group(0)  # Already has button
        
        return f'''<div className="flex items-center justify-between mb-4">
              {opening}{title}{closing}
{back_button}
            </div>'''
    
    new_content = re.sub(pattern, replace_header, content, count=1)
    
    if new_content != content:
        with open(report_path, 'w') as f:
            f.write(new_content)
        print(f"✓ Added back button to {report_path}")
    else:
        print(f"- No changes needed for {report_path}")

print("\nDone!")