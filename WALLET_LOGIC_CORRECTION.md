# Wallet Logic Correction - Simplified Approach

## The Realization

After reviewing the Fast Daily report code, we discovered that **the frontend builds the wallet from scratch** every time, starting with $10,000 cash. This means the event processor doesn't need to track wallet state across days!

## How It Actually Works

### Frontend Logic (Fast Daily Report)

```javascript
// 1. Fetch ALL events from database for date range
const eventsData = await getTradeEvents(apiParams);

// 2. Sort chronologically
const sortedEvents = eventsWithSession.sort((a, b) => {
  const dateCompare = a.event_date.localeCompare(b.event_date);
  if (dateCompare !== 0) return dateCompare;
  return a.event_time.localeCompare(b.event_time);
});

// 3. Filter to alternating BUY/SELL pattern
const executedTrades = [];
let expectingBuy = true;

for (const event of sortedEvents) {
  if (expectingBuy && event.event_type === 'BUY') {
    executedTrades.push(event);
    expectingBuy = false;
  } else if (!expectingBuy && event.event_type === 'SELL') {
    executedTrades.push(event);
    expectingBuy = true;
  }
}

// 4. Build wallet from scratch starting at $10,000
let cash = 10000;
let shares = 0;

const eventsWithWallet = executedTrades.map((event) => {
  if (event.event_type === 'BUY') {
    const sharesToBuy = Math.floor(cash / adjustedPrice);
    const cost = sharesToBuy * adjustedPrice;
    cash -= cost;
    shares += sharesToBuy;
  } else if (event.event_type === 'SELL' && shares > 0) {
    const proceeds = shares * adjustedPrice;
    cash += proceeds;
    shares = 0;
  }
  // ... return event with wallet state
});
```

## What This Means for Event Processing

### Old Approach (Overcomplicated) ❌
- Check last event to determine if holding cash or shares
- Calculate how many shares from previous day's price
- Continue simulation from that state
- Track wallet across days

### New Approach (Simplified) ✅
- Check last event to determine if expecting BUY or SELL
- Log alternating BUY/SELL signals only
- Let frontend build wallet from scratch
- No wallet tracking needed!

## Updated Event Processor Logic

```javascript
// 1. Check what we're expecting next (BUY or SELL)
const startState = await getLastEventState(client, tableName, symbol, buyPct, sellPct, targetDate);
// Returns: { expectingBuy: true/false }

// 2. Log alternating signals only
function simulateDay(minuteData, buyPct, sellPct, startState) {
  const events = [];
  let expectingBuy = startState.expectingBuy;
  
  for (const bar of minuteData) {
    const buyThreshold = baseline * (1 + buyPct / 100);
    const sellThreshold = baseline * (1 - sellPct / 100);
    
    // BUY signal - only if expecting BUY
    if (expectingBuy && ratio >= buyThreshold) {
      events.push({ ...event, event_type: 'BUY' });
      expectingBuy = false;
    }
    // SELL signal - only if expecting SELL
    else if (!expectingBuy && ratio <= sellThreshold) {
      events.push({ ...event, event_type: 'SELL' });
      expectingBuy = true;
    }
  }
  
  return events;
}
```

## Key Benefits

### 1. Simpler Logic
- No wallet state tracking
- No share calculations
- No price lookups from previous day
- Just track: expecting BUY or SELL?

### 2. Frontend Flexibility
- Can start report at any time (11am, 3:33pm, etc.)
- Can apply slippage and conservative rounding
- Can use different buy/sell percentages for RTH vs AH
- Wallet is always built fresh from the events

### 3. Correct Behavior
- Frontend filters to first BUY, then alternating SELL/BUY
- Wallet simulation matches user's actual parameters
- ROI calculated with user's chosen adjustments
- No assumptions about previous day's state

## What Changed in the Code

### Before (Overcomplicated)
```javascript
async function getLastEventState(client, tableName, symbol, buyPct, sellPct) {
  // ... query last event
  if (lastEvent.event_type === 'BUY') {
    return { hasCash: false, hasShares: true, lastPrice: parseFloat(lastEvent.stock_price) };
  } else {
    return { hasCash: true, hasShares: false, lastPrice: null };
  }
}

function simulateDay(minuteData, buyPct, sellPct, startState) {
  let cash = startState.hasCash ? INITIAL_CASH : 0;
  let shares = startState.hasShares ? Math.floor(INITIAL_CASH / startState.lastPrice) : 0;
  // ... complex wallet tracking
}
```

### After (Simplified)
```javascript
async function getLastEventState(client, tableName, symbol, buyPct, sellPct, targetDate) {
  // ... query last event before target date
  if (result.rows.length === 0) {
    return { expectingBuy: true }; // First event should be BUY
  }
  return { expectingBuy: lastEvent.event_type === 'SELL' };
}

function simulateDay(minuteData, buyPct, sellPct, startState) {
  let expectingBuy = startState.expectingBuy;
  // ... simple alternating pattern
}
```

## Why This Works

### The Frontend Always:
1. Starts with $10,000 cash
2. Filters to alternating BUY/SELL pattern
3. Builds wallet from scratch
4. Calculates ROI based on final portfolio value

### The Backend Just:
1. Logs signals in alternating pattern
2. Ensures continuity (if last was BUY, next must be SELL)
3. Stores raw events without wallet calculations
4. Lets frontend do the wallet simulation

## Example Scenario

### Day 1 (Oct 24)
- 9:30 AM: BUY signal → Log BUY event
- 2:15 PM: SELL signal → Log SELL event
- 3:45 PM: BUY signal → Log BUY event
- End of day: Last event was BUY

### Day 2 (Oct 25)
- Check: Last event was BUY, so expecting SELL
- 10:00 AM: BUY signal → Skip (expecting SELL)
- 11:30 AM: SELL signal → Log SELL event (now expecting BUY)
- 2:00 PM: BUY signal → Log BUY event (now expecting SELL)

### Frontend Report (Oct 24-25)
- Fetches all 5 events
- Filters to alternating: BUY, SELL, BUY, SELL, BUY
- Builds wallet:
  - Start: $10,000 cash
  - BUY: Buy shares, cash → 0
  - SELL: Sell shares, cash → $10,XXX
  - BUY: Buy shares, cash → 0
  - SELL: Sell shares, cash → $10,XXX
  - BUY: Buy shares, cash → 0
  - End: Holding shares worth $X,XXX

## Conclusion

The original approach was overthinking the problem. The frontend already handles wallet simulation perfectly, so the backend just needs to log alternating BUY/SELL signals. This is simpler, more flexible, and matches how the system actually works.

**Key Insight:** The frontend builds the wallet AFTER fetching events, not during event generation. This separation of concerns makes the system much simpler and more maintainable.