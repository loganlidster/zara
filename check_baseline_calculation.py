import csv

# Your expected baselines
expected_baselines = {
    '2025-09-24': 28616.780459,
    '2025-09-25': 30059.776703
}

# Read the CSV
with open('HIVE_EQUAL_MEAN_2025-09-24_2025-09-25_0.5buy_1sell_RTH.csv', 'r') as f:
    reader = csv.DictReader(f)
    trades = list(reader)

print("=== BASELINE COMPARISON ===\n")

for trade in trades:
    date = trade['Date'][:10]
    baseline_in_csv = float(trade['Baseline'])
    expected = expected_baselines.get(date, 0)
    
    print(f"Date: {date}")
    print(f"  Baseline in CSV: ${baseline_in_csv:.2f}")
    print(f"  Expected Baseline: ${expected:.2f}")
    print(f"  Difference: ${baseline_in_csv - expected:.2f}")
    print(f"  Match: {abs(baseline_in_csv - expected) < 1}")
    print()

print("\n=== THE PROBLEM ===")
print("The baseline values in the CSV don't match your expected values!")
print("This means either:")
print("1. The baseline_daily table has wrong values")
print("2. The wrong baseline is being retrieved")
print("3. The baseline calculation method is incorrect")
