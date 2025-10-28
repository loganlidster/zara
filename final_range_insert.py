with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    lines = f.readlines()

range_ui = '''
              {/* Mode Selection */}
              <div className="md:col-span-4 mb-4 pb-4 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Testing Mode</label>
                <div className="flex gap-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="all"
                      checked={mode === 'all'}
                      onChange={(e) => setMode(e.target.value as 'all' | 'range')}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      <strong>All</strong> - Query existing precomputed data (fast)
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="range"
                      checked={mode === 'range'}
                      onChange={(e) => setMode(e.target.value as 'all' | 'range')}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      <strong>Custom Range</strong> - Test specific threshold ranges
                    </span>
                  </label>
                </div>
              </div>

              {/* Range Testing Controls */}
              {mode === 'range' && (
                <div className="md:col-span-4 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Custom Range Testing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Buy Thresholds (%)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Min</label>
                          <input type="number" value={buyMin} onChange={(e) => setBuyMin(parseFloat(e.target.value))} step="0.1" min="0" max="10" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Max</label>
                          <input type="number" value={buyMax} onChange={(e) => setBuyMax(parseFloat(e.target.value))} step="0.1" min="0" max="10" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sell Thresholds (%)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Min</label>
                          <input type="number" value={sellMin} onChange={(e) => setSellMin(parseFloat(e.target.value))} step="0.1" min="0" max="10" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Max</label>
                          <input type="number" value={sellMax} onChange={(e) => setSellMax(parseFloat(e.target.value))} step="0.1" min="0" max="10" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-blue-700">
                    <strong>This will test:</strong> {Math.round((buyMax - buyMin) / 0.1) + 1} buy × {Math.round((sellMax - sellMin) / 0.1) + 1} sell = <strong>{(Math.round((buyMax - buyMin) / 0.1) + 1) * (Math.round((sellMax - sellMin) / 0.1) + 1)} combinations</strong>
                  </div>
                </div>
              )}

'''

# Insert at line 328 (before Submit Button comment)
lines.insert(327, range_ui)  # 0-indexed, so 327 = line 328

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
    f.writelines(lines)

print("Successfully inserted range testing UI at line 328")