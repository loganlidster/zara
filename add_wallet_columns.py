import re

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'r') as f:
    content = f.read()

# Add wallet columns to table headers
content = re.sub(
    r'(<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Trade ROI</th>)',
    r'<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>\n                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>\n                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolio</th>\n                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROI %</th>\n                      \1',
    content
)

# Add wallet columns to table rows (before Trade ROI column)
content = re.sub(
    r'(<td className="px-6 py-4 whitespace-nowrap text-sm text-right">\s*{event\.trade_roi_pct)',
    r'''<td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{event.shares_held || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.cash_balance?.toFixed(2) || '0.00'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.portfolio_value?.toFixed(2) || '0.00'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            (event.roi_pct || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {event.roi_pct?.toFixed(2) || '0.00'}%
                          </span>
                        </td>
                        \1''',
    content
)

with open('frontend-dashboard/app/reports/fast-daily/page.tsx', 'w') as f:
    f.write(content)

print("Added wallet columns to Fast Daily report")