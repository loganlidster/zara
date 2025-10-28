with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

# Find the old handleSubmit and replace it
old_code = '''    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
  
      try {
        const params: any = {
          startDate,
          endDate,
          limit
        };
  
        if (symbolFilter !== 'All') params.symbol = symbolFilter;
        if (methodFilter !== 'All') params.method = methodFilter;
        if (sessionFilter !== 'All') params.session = sessionFilter;

        const response = await getTopPerformers(params);'''

new_code = '''    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
  
      try {
        let response: TopPerformersResponse;
        
        if (mode === 'range') {
          // Range testing mode - requires single symbol
          if (symbolFilter === 'All') {
            setError('Range testing requires a specific symbol. Please select a symbol.');
            setLoading(false);
            return;
          }
          
          if (methodFilter === 'All') {
            setError('Range testing requires a specific method. Please select a method.');
            setLoading(false);
            return;
          }
          
          if (sessionFilter === 'All') {
            setError('Range testing requires a specific session. Please select RTH or AH.');
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
          // All mode - query existing data
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
    print("Successfully updated handleSubmit")
else:
    print("Could not find old code - checking variations...")
    # Try with different spacing
    if 'const response = await getTopPerformers(params);' in content:
        print("Found getTopPerformers call, but spacing is different")
    else:
        print("getTopPerformers call not found at all")