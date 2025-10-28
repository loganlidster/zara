import re

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

# Find the entire handleSubmit function using regex
pattern = r'(const handleSubmit = async \(e: React\.FormEvent\) => \{.*?^\s{2}\};)'

new_handlesubmit = '''const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
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
      }
        
      console.log('Raw API response:', response);
      
      // Extract timing info if available
      if (response.timing) {
        setTiming(response.timing);
        console.log('Timing:', response.timing);
      }
      
      // Get the actual performers array
      const performersData = response.topPerformers || [];
      
      if (performersData && performersData.length > 0) {
        console.log('First item:', performersData[0]);
        console.log('First item keys:', Object.keys(performersData[0]));
        console.log('roiPct value:', performersData[0].roiPct);
        console.log('roiPct type:', typeof performersData[0].roiPct);
      }
      
      // Filter out any invalid data
      const validData = performersData.filter(p => {
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
      
      console.log('Valid data count:', validData.length, 'out of', performersData.length);
      
      setPerformers(validData);
      
      if (validData.length === 0 && performersData.length > 0) {
        setError('No valid data returned. The query may have timed out or returned incomplete results.');
      }
    } catch (err: any) {
      console.error('Error fetching performers:', err);
      setError(err.message || 'Failed to fetch data');
      setPerformers([]);
    } finally {
      setLoading(false);
    }
  };'''

# Find where handleSubmit starts
start_idx = content.find('const handleSubmit = async (e: React.FormEvent) => {')
if start_idx == -1:
    print("Could not find handleSubmit function")
    exit(1)

# Find the end of the function (matching closing brace at same indentation level)
# Count braces to find the matching closing brace
brace_count = 0
i = start_idx
in_function = False
while i < len(content):
    if content[i] == '{':
        brace_count += 1
        in_function = True
    elif content[i] == '}':
        brace_count -= 1
        if in_function and brace_count == 0:
            # Found the closing brace, include it and the semicolon
            end_idx = i + 2  # +2 to include }; 
            break
    i += 1

if brace_count != 0:
    print(f"Could not find matching closing brace (count: {brace_count})")
    exit(1)

# Replace the function
new_content = content[:start_idx] + new_handlesubmit + content[end_idx:]

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
    f.write(new_content)

print(f"✅ Successfully replaced handleSubmit function (from char {start_idx} to {end_idx})")