import csv

with open('HIVE_EQUAL_MEAN_2025-09-24_2025-09-25_0.5buy_1sell_RTH.csv', 'r') as f:
    reader = csv.DictReader(f)
    trades = list(reader)

print("=== Threshold Analysis ===\n")

for i, trade in enumerate(trades, 1):
    baseline = float(trade['Baseline'])
    price = float(trade['Price'])
    action = trade['Action']
    
    # Calculate what the thresholds SHOULD be
    buy_threshold = baseline * (1 + 0.5)  # 0.5 = 50% buy adjustment
    sell_threshold = baseline * (1 - 1.0)  # 1.0 = 100% sell adjustment
    
    print(f"Trade {i}: {trade['Date'][:10]} {trade['Time']} - {action}")
    print(f"  Baseline: ${baseline:.2f}")
    print(f"  Price: ${price:.2f}")
    print(f"  Buy Threshold (baseline * 1.5): ${buy_threshold:.2f}")
    print(f"  Sell Threshold (baseline * 0): ${sell_threshold:.2f}")
    
    if action == 'BUY':
        print(f"  Should BUY when price >= ${buy_threshold:.2f}")
        print(f"  Price ${price:.2f} >= ${buy_threshold:.2f}? {price >= buy_threshold}")
    else:
        print(f"  Should SELL when price <= ${sell_threshold:.2f}")
        print(f"  Price ${price:.2f} <= ${sell_threshold:.2f}? {price <= sell_threshold}")
    
    print()
