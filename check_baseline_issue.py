import csv

with open('HIVE_EQUAL_MEAN_2025-09-24_2025-09-25_0.5buy_1sell_RTH.csv', 'r') as f:
    reader = csv.DictReader(f)
    trades = list(reader)

print("=== BASELINE PROBLEM DETECTED ===\n")

for trade in trades:
    baseline = float(trade['Baseline'])
    price = float(trade['Price'])
    current_ratio = float(trade['Current Ratio'])
    
    print(f"Date: {trade['Date'][:10]} {trade['Time']}")
    print(f"  Stock Price: ${price:.2f}")
    print(f"  Baseline (from CSV): ${baseline:.2f} ← THIS IS BITCOIN PRICE!")
    print(f"  Current Ratio: {current_ratio:.2f}")
    print(f"  Expected Stock Baseline: ${baseline / current_ratio:.4f}")
    print()

print("\n=== THE ISSUE ===")
print("The 'Baseline' column contains the BITCOIN baseline, not the STOCK baseline!")
print("The stock baseline should be: Bitcoin Baseline / Current Ratio")
print("\nFor EQUAL_MEAN method, we need to calculate:")
print("Stock Baseline = Bitcoin Price / Ratio")
