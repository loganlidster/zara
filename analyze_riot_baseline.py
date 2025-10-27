# RIOT analysis
print("=== RIOT Baseline Analysis ===\n")

baseline = 6160.31
stock_price = 17.29
current_ratio = 6454.213480

print(f"Baseline (from CSV): {baseline}")
print(f"Stock Price: ${stock_price}")
print(f"Current Ratio: {current_ratio}")
print(f"\nCalculated Stock Baseline: ${baseline / current_ratio:.4f}")
print(f"\nThis means:")
print(f"  If baseline is BTC price: Stock baseline = ${baseline / current_ratio:.4f}")
print(f"  If baseline is Stock price: It should be ~${stock_price:.2f}")

print("\n=== The Problem ===")
print("The baseline value of 6160.31 doesn't make sense for either:")
print(f"  - BTC price (should be ~$28,000-30,000)")
print(f"  - RIOT stock price (should be ~${stock_price})")
print(f"\nThe baseline is completely wrong!")

# Check if it's using wrong symbol's baseline
print("\n=== Hypothesis ===")
print("The baseline might be from a different symbol or calculation error")
print(f"6160.31 / 17.29 = {6160.31 / 17.29:.2f} (ratio)")
print(f"This doesn't match the current_ratio of {current_ratio:.2f}")
