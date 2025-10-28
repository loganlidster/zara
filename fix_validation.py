import re

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

# Find and replace the validation section
old_section = '''        console.log('Raw API response:', data);
        console.log('First item:', data[0]);
        
        // Filter out any invalid data
        const validData = data.filter(p => {
          const isValid = p && 
            typeof p.roiPct === 'number' && 
            !isNaN(p.roiPct) &&
            p.symbol && 
            p.method && 
            p.session;
          
          if (!isValid) {
            console.log('Invalid performer data:', p);
          }
          
          return isValid;
        });
        
        console.log('Valid data count:', validData.length, 'out of', data.length);'''

new_section = '''        console.log('Raw API response:', data);
        if (data && data.length > 0) {
          console.log('First item:', data[0]);
          console.log('First item keys:', Object.keys(data[0]));
          console.log('roiPct value:', data[0].roiPct);
          console.log('roiPct type:', typeof data[0].roiPct);
        }
        
        // Filter out any invalid data
        const validData = data.filter(p => {
          if (!p) {
            console.log('Null/undefined item');
            return false;
          }
          
          const hasRoiPct = p.roiPct !== undefined && p.roiPct !== null;
          const isNumber = typeof p.roiPct === 'number';
          const notNaN = !isNaN(p.roiPct);
          const hasSymbol = !!p.symbol;
          const hasMethod = !!p.method;
          const hasSession = !!p.session;
          
          const isValid = hasRoiPct && isNumber && notNaN && hasSymbol && hasMethod && hasSession;
          
          if (!isValid) {
            console.log('Invalid performer data:', {
              item: p,
              hasRoiPct,
              isNumber,
              notNaN,
              hasSymbol,
              hasMethod,
              hasSession
            });
          }
          
          return isValid;
        });
        
        console.log('Valid data count:', validData.length, 'out of', data.length);'''

if old_section in content:
    content = content.replace(old_section, new_section)
    with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
        f.write(content)
    print("Successfully updated validation logic")
else:
    print("Could not find exact match. Let me try a different approach...")
    # Try with regex to handle whitespace differences
    pattern = r"console\.log\('Raw API response:', data\);.*?console\.log\('Valid data count:', validData\.length, 'out of', data\.length\);"
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, new_section, content, flags=re.DOTALL)
        with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
            f.write(content)
        print("Successfully updated validation logic with regex")
    else:
        print("Pattern not found")