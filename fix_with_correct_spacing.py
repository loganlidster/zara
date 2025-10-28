with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

old_code = '''      try {
        const params: any = {
          startDate,
          endDate,
          limit
        };
  
        if (symbolFilter !== 'All') params.symbol = symbolFilter;
        if (methodFilter !== 'All') params.method = methodFilter;
        if (sessionFilter !== 'All') params.session = sessionFilter;
  
        const response = await getTopPerformers(params);'''

new_code = '''      try {
        let response: TopPerformersResponse;
        
        if (mode === 'range') {
          // Range testing mode
          if (symbolFilter === 'All') {
            setError('Range testing requires a specific symbol.');
            setLoading(false);
            return;
          }
          if (methodFilter === 'All') {
            setError('Range testing requires a specific method.');
            setLoading(false);
            return;
          }
          if (sessionFilter === 'All') {
            setError('Range testing requires a specific session.');
            setLoading(false);
            return;
          }
          
          response = await getTopPerformersRange({
            symbol: symbolFilter,
            method: methodFilter,
            session: sessionFilter,
            buyMin,
            buyMax,
            sellMin,
            sellMax,
            startDate,
            endDate,
            limit
          });
        } else {
          // All mode
          const params: any = {
            startDate,
            endDate,
            limit
          };
    
          if (symbolFilter !== 'All') params.symbol = symbolFilter;
          if (methodFilter !== 'All') params.method = methodFilter;
          if (sessionFilter !== 'All') params.session = sessionFilter;

          response = await getTopPerformers(params);
        }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
        f.write(content)
    print("✅ Successfully updated handleSubmit with range testing logic")
else:
    print("❌ Could not find exact match")