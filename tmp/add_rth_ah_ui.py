with open('frontend-dashboard/app/reports/daily-curve/page.tsx', 'r') as f:
    content = f.read()

# Find the location after Sell % input and before Date Range
marker = '             {/* Date Range */'

rth_ah_ui = '''
            {/* Separate RTH/AH Settings (when session is ALL) */}
            {session === 'ALL' && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="useSameValues"
                    checked={useSameValues}
                    onChange={(e) => setUseSameValues(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="useSameValues" className="text-sm font-medium text-gray-700">
                    Use same values for RTH and AH
                  </label>
                </div>

                {!useSameValues && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* RTH Settings */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-3">RTH (Regular Trading Hours)</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Buy %</label>
                          <input
                            type="number"
                            value={rthBuyPct}
                            onChange={(e) => setRthBuyPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sell %</label>
                          <input
                            type="number"
                            value={rthSellPct}
                            onChange={(e) => setRthSellPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>

                    {/* AH Settings */}
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-900 mb-3">AH (After Hours)</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Buy %</label>
                          <input
                            type="number"
                            value={ahBuyPct}
                            onChange={(e) => setAhBuyPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sell %</label>
                          <input
                            type="number"
                            value={ahSellPct}
                            onChange={(e) => setAhSellPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

'''

if marker in content:
    content = content.replace(marker, rth_ah_ui + marker)
    with open('frontend-dashboard/app/reports/daily-curve/page.tsx', 'w') as f:
        f.write(content)
    print("✓ Added RTH/AH separate settings UI")
else:
    print("✗ Marker not found")