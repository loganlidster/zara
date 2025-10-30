with open('frontend-dashboard/app/reports/daily-curve/page.tsx', 'r') as f:
    lines = f.readlines()

# Find the line with "Submit Button" comment
for i, line in enumerate(lines):
    if '/* Submit Button */' in line or '{/* Submit Button */}' in line:
        # Insert new section before this line
        indent = '             '
        new_section = f'''
{indent}{{/* Slippage & Conservative Rounding */}}
{indent}<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
{indent}  <div>
{indent}    <label className="block text-sm font-medium text-gray-700 mb-2">
{indent}      Slippage (%)
{indent}    </label>
{indent}    <input
{indent}      type="number"
{indent}      step="0.1"
{indent}      min="0"
{indent}      max="5"
{indent}      value={{slippagePct}}
{indent}      onChange={{(e) => setSlippagePct(parseFloat(e.target.value))}}
{indent}      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
{indent}    />
{indent}    <p className="mt-1 text-xs text-gray-500">
{indent}      Simulates price impact (0-5%, default 0.1%)
{indent}    </p>
{indent}  </div>

{indent}  <div>
{indent}    <label className="flex items-center pt-7">
{indent}      <input
{indent}        type="checkbox"
{indent}        checked={{conservativeRounding}}
{indent}        onChange={{(e) => setConservativeRounding(e.target.checked)}}
{indent}        className="mr-2"
{indent}      />
{indent}      <span className="text-sm font-medium text-gray-700">
{indent}        Conservative Rounding
{indent}      </span>
{indent}    </label>
{indent}    <p className="mt-1 text-xs text-gray-500 ml-6">
{indent}      Round up for buys, down for sells (more realistic)
{indent}    </p>
{indent}  </div>
{indent}</div>

'''
        lines.insert(i, new_section)
        break

with open('frontend-dashboard/app/reports/daily-curve/page.tsx', 'w') as f:
    f.writelines(lines)

print("✓ Added slippage and conservative rounding UI controls")
