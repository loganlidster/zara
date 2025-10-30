with open('api-server/daily-curve-endpoint.js', 'r') as f:
    lines = f.readlines()

# Find the line with "for (const event of dayEvents)"
for i, line in enumerate(lines):
    if 'for (const event of dayEvents)' in line and i > 170:
        # Replace the next line (const price = ...)
        if 'const price = parseFloat(event.stock_price);' in lines[i+1]:
            # Insert new lines
            indent = '         '
            new_lines = [
                f'{indent}let price = parseFloat(event.stock_price);\n',
                f'{indent}const isBuy = event.event_type === \'BUY\';\n',
                f'{indent}\n',
                f'{indent}// Apply slippage if enabled\n',
                f'{indent}if (slippagePct > 0) {{\n',
                f'{indent}  price = applySlippage(price, slippagePct, isBuy);\n',
                f'{indent}}}\n',
                f'{indent}\n',
                f'{indent}// Apply conservative rounding if enabled\n',
                f'{indent}if (conservativeRounding) {{\n',
                f'{indent}  price = applyConservativeRounding(price, isBuy);\n',
                f'{indent}}}\n',
                f'{indent}\n',
            ]
            # Replace lines[i+1] and lines[i+2] (const price and blank line)
            lines[i+1:i+3] = new_lines
            break

with open('api-server/daily-curve-endpoint.js', 'w') as f:
    f.writelines(lines)

print("✓ Updated trading loop with slippage and conservative rounding")
