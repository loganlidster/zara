import csv

# Read the CSV
with open('HIVE_EQUAL_MEAN_2025-09-24_2025-09-25_0.5buy_1sell_RTH.csv', 'r') as f:
    reader = csv.DictReader(f)
    trades = list(reader)

print("=== HIVE Trade Analysis ===\n")

starting_cash = 10000.00
cash = starting_cash
shares = 0

for i, trade in enumerate(trades, 1):
    action = trade['Action']
    num_shares = int(trade['Shares'])
    price = float(trade['Price'])
    value = float(trade['Value'])
    
    print(f"Trade {i}: {trade['Date'][:10]} {trade['Time']}")
    print(f"  Action: {action}")
    print(f"  Shares: {num_shares}")
    print(f"  Price: ${price}")
    print(f"  Value: ${value:.2f}")
    
    if action == 'BUY':
        cash -= value
        shares += num_shares
        print(f"  Cash after: ${cash:.2f}")
        print(f"  Shares held: {shares}")
    else:  # SELL
        cash += value
        shares -= num_shares
        print(f"  Cash after: ${cash:.2f}")
        print(f"  Shares held: {shares}")
    
    print()

print("=== Final Results ===")
print(f"Starting cash: ${starting_cash:.2f}")
print(f"Final cash: ${cash:.2f}")
print(f"Final shares: {shares}")
print(f"Net change: ${cash - starting_cash:.2f}")
print(f"ROI: {((cash - starting_cash) / starting_cash * 100):.2f}%")

# Check the calculation
print("\n=== Verification ===")
print(f"Trade 1 BUY:  -$9998.10")
print(f"Trade 2 SELL: +$10236.15")
print(f"Trade 3 BUY:  -$10237.47")
print(f"Trade 4 SELL: +$9592.59")
print(f"Net: ${-9998.10 + 10236.15 - 10237.47 + 9592.59:.2f}")
