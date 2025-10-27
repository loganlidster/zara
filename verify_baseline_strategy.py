import csv

# From your database query
db_baselines = {
    '2025-09-24': 28616.780459,  # Calculated from 9/23 data, used on 9/24
    '2025-09-25': 30059.776703   # Calculated from 9/24 data, used on 9/25
}

# From the CSV
with open('HIVE_EQUAL_MEAN_2025-09-24_2025-09-25_0.5buy_1sell_RTH.csv', 'r') as f:
    reader = csv.DictReader(f)
    trades = list(reader)

print("=== Baseline Verification ===\n")

for trade in trades:
    date = trade['Date'][:10]
    baseline_in_csv = float(trade['Baseline'])
    prev_baseline_date = trade['Prev Baseline Date'][:10]
    
    print(f"Trade Date: {date}")
    print(f"  Baseline in CSV: {baseline_in_csv:.2f}")
    print(f"  Prev Baseline Date: {prev_baseline_date}")
    print(f"  Expected (from DB): {db_baselines.get(date, 0):.2f}")
    
    # The CSV should show the PREVIOUS day's baseline
    expected_prev_date = '2025-09-23' if date == '2025-09-24' else '2025-09-24'
    print(f"  Expected Prev Date: {expected_prev_date}")
    print(f"  Match: {prev_baseline_date == expected_prev_date}")
    print()

print("\n=== THE REAL ISSUE ===")
print("The CSV is showing the baseline from 'Prev Baseline Date', not the current trading_day!")
print("This means the query is getting the PREVIOUS day's baseline, not the current day's.")
