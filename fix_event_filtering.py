import re

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'r') as f:
    content = f.read()

# Replace with proper escaping for &amp;
content = content.replace('&amp;&amp;', '&amp;&amp;')

# Find and replace the wallet simulation logic
old_section = '''// Sort events by date and time chronologically
      const sortedEvents = eventsData.sort((a, b) => {
        const dateCompare = a.event_date.localeCompare(b.event_date);
        if (dateCompare !== 0) return dateCompare;
        return a.event_time.localeCompare(b.event_time);
      });

      // Calculate wallet simulation
      let cash = 10000;
      let shares = 0;
      const eventsWithWallet = sortedEvents.map((event) => {
        if (event.event_type === 'BUY') {
          const sharesToBuy = Math.floor(cash / event.stock_price);
          const cost = sharesToBuy * event.stock_price;
          cash -= cost;
          shares += sharesToBuy;
        } else if (event.event_type === 'SELL' &amp;&amp; shares > 0) {
          const proceeds = shares * event.stock_price;
          cash += proceeds;
          shares = 0;
        }
        
        const portfolioValue = cash + (shares * event.stock_price);
        const roi = ((portfolioValue - 10000) / 10000) * 100;
        
        return {
          ...event,
          shares_held: shares,
          cash_balance: cash,
          portfolio_value: portfolioValue,
          roi_pct: roi
        };
      });

      setEvents(eventsWithWallet);'''

new_section = '''// Sort events by date and time chronologically
      const sortedEvents = eventsData.sort((a, b) => {
        const dateCompare = a.event_date.localeCompare(b.event_date);
        if (dateCompare !== 0) return dateCompare;
        return a.event_time.localeCompare(b.event_time);
      });

      // Filter to only show executed trades (alternating BUY/SELL)
      const executedTrades = [];
      let expectingBuy = true;
      
      for (const event of sortedEvents) {
        if (expectingBuy &amp;&amp; event.event_type === 'BUY') {
          executedTrades.push(event);
          expectingBuy = false;
        } else if (!expectingBuy &amp;&amp; event.event_type === 'SELL') {
          executedTrades.push(event);
          expectingBuy = true;
        }
      }

      // Calculate wallet simulation
      let cash = 10000;
      let shares = 0;
      const eventsWithWallet = executedTrades.map((event) => {
        if (event.event_type === 'BUY') {
          const sharesToBuy = Math.floor(cash / event.stock_price);
          const cost = sharesToBuy * event.stock_price;
          cash -= cost;
          shares += sharesToBuy;
        } else if (event.event_type === 'SELL' &amp;&amp; shares > 0) {
          const proceeds = shares * event.stock_price;
          cash += proceeds;
          shares = 0;
        }
        
        const portfolioValue = cash + (shares * event.stock_price);
        const roi = ((portfolioValue - 10000) / 10000) * 100;
        
        return {
          ...event,
          shares_held: shares,
          cash_balance: cash,
          portfolio_value: portfolioValue,
          roi_pct: roi
        };
      });

      setEvents(eventsWithWallet);'''

if old_section in content:
    content = content.replace(old_section, new_section)
    print("Fixed event filtering logic")
else:
    print("Pattern not found - checking alternatives")

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'w') as f:
    f.write(content)