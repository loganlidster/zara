with open('frontend-dashboard/app/page.tsx', 'r') as f:
    lines = f.readlines()

daily_curve_card = '''
            {/* Daily Curve */}
            <Link href="/reports/daily-curve">
              <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-indigo-500">
                <div className="flex items-center mb-4">
                  <div className="bg-indigo-500 text-white rounded-full p-3 mr-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Daily Curve &amp; ROI</h2>
                </div>
                <p className="text-gray-600">
                  Multi-symbol performance comparison with Bitcoin benchmark overlay
                </p>
                <div className="mt-4 text-indigo-500 font-semibold">
                  View Report →
                </div>
              </div>
            </Link>
'''

# Insert at line 82 (before Method Comparison)
lines.insert(81, daily_curve_card)

with open('frontend-dashboard/app/page.tsx', 'w') as f:
    f.writelines(lines)

print("✅ Added Daily Curve card to home page")