import re

with open('frontend-dashboard/app/reports/daily-curve/page.tsx', 'r') as f:
    content = f.read()

# 1. Update state variables to include separate RTH/AH settings
old_state = '''  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['HIVE', 'RIOT', 'MARA']);
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [session, setSession] = useState('RTH');
  const [buyPct, setBuyPct] = useState(2.9);
  const [sellPct, setSellPct] = useState(0.7);'''

new_state = '''  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['HIVE', 'RIOT', 'MARA']);
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [session, setSession] = useState('RTH');
  const [buyPct, setBuyPct] = useState(2.9);
  const [sellPct, setSellPct] = useState(0.7);
  const [rthBuyPct, setRthBuyPct] = useState(2.9);
  const [rthSellPct, setRthSellPct] = useState(0.7);
  const [ahBuyPct, setAhBuyPct] = useState(2.9);
  const [ahSellPct, setAhSellPct] = useState(0.7);
  const [useSameValues, setUseSameValues] = useState(true);'''

content = content.replace(old_state, new_state)

# 2. Update handleSubmit to include separate RTH/AH parameters
old_submit_params = '''      const params = {
        symbols: selectedSymbols,
        method,
        session,
        buyPct,
        sellPct,'''

new_submit_params = '''      const params: any = {
        symbols: selectedSymbols,
        method,
        session,
        buyPct,
        sellPct,'''

content = content.replace(old_submit_params, new_submit_params)

# 3. Add RTH/AH parameters when session is ALL
old_api_call = '''        startDate,
        endDate,
        alignmentMode,
        includeBtc
      };

      const result = await getDailyCurve(params);'''

new_api_call = '''        startDate,
        endDate,
        alignmentMode,
        includeBtc
      };

      // Add separate RTH/AH parameters if session is ALL
      if (session === 'ALL') {
        params.rthBuyPct = useSameValues ? buyPct : rthBuyPct;
        params.rthSellPct = useSameValues ? sellPct : rthSellPct;
        params.ahBuyPct = useSameValues ? buyPct : ahBuyPct;
        params.ahSellPct = useSameValues ? sellPct : ahSellPct;
      }

      const result = await getDailyCurve(params);'''

content = content.replace(old_api_call, new_api_call)

with open('frontend-dashboard/app/reports/daily-curve/page.tsx', 'w') as f:
    f.write(content)

print("✓ Updated Daily Curve state and API call")