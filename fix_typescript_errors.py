with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

# Fix the data variable name and type
content = content.replace('const data = await getTopPerformers(params);', 'const response = await getTopPerformers(params);')
content = content.replace('console.log(\'Raw API response:\', data);', 'console.log(\'Raw API response:\', response);')
content = content.replace('if (data.timing) {', 'if (response.timing) {')
content = content.replace('setTiming(data.timing);', 'setTiming(response.timing);')
content = content.replace('console.log(\'Timing:\', data.timing);', 'console.log(\'Timing:\', response.timing);')
content = content.replace('const performersData = Array.isArray(data) ? data : (data.topPerformers || data);', 'const performersData = response.topPerformers || [];')

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
    f.write(content)

print("Fixed TypeScript errors")