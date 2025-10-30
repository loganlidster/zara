'use client';

import { useState } from 'react';
import Header from '@/components/Header';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

interface GridResult {
  method: string;
  buyPct: number;
  sellPct: number;
  totalReturn: number;
  totalTrades: number;
  finalEquity: number;
}

interface GridResponse {
  success: boolean;
  symbol: string;
  session: string;
  results: GridResult[];
  bestPerMethod: Record<string, {
    buyPct: number;
    sellPct: number;
    totalReturn: number;
    totalTrades: number;
  }>;
  stats: {
    totalCombinations: number;
    methodsTested: number;
    buyValues: number;
    sellValues: number;
  };
  timing: {
    total: number;
    avgPerCombination: number;
  };
}

export default function GridSearchReport() {
  const [symbol, setSymbol] = useState('HIVE');
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['VWAP_RATIO', 'WINSORIZED']);
  const [session, setSession] = useState('RTH');
  const [buyMin, setBuyMin] = useState(0.5);
  const [buyMax, setBuyMax] = useState(2.0);
  const [buyStep, setBuyStep] = useState(0.5);
  const [sellMin, setSellMin] = useState(0.5);
  const [sellMax, setSellMax] = useState(2.0);
  const [sellStep, setSellStep] = useState(0.5);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-29');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [slippage, setSlippage] = useState(0.1);
  const [conservativeRounding, setConservativeRounding] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GridResponse | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'heatmap'>('table');

  const handleMethodToggle = (method: string) => {
    if (selectedMethods.includes(method)) {
      setSelectedMethods(selectedMethods.filter(m => m !== method));
    } else {
      setSelectedMethods([...selectedMethods, method]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedMethods.length === 0) {
      setError('Please select at least one baseline method');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const response = await fetch(`${API_URL}/api/events/grid-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          methods: selectedMethods,
          session,
          buyMin,
          buyMax,
          buyStep,
          sellMin,
          sellMax,
          sellStep,
          startDate,
          endDate,
          initialCapital,
          slippage,
          conservativeRounding
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Error running grid search:', err);
      setError(err.message || 'Failed to run grid search');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    
    const headers = ['Method', 'Buy %', 'Sell %', 'Total Return %', 'Total Trades', 'Final Equity'];
    const rows = data.results.map(r => [
      r.method,
      r.buyPct.toFixed(1),
      r.sellPct.toFixed(1),
      r.totalReturn.toFixed(2),
      r.totalTrades,
      r.finalEquity.toFixed(2)
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grid-search-${symbol}-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get unique buy and sell values for heatmap
  const getBuyValues = () => {
    if (!data) return [];
    const values = new Set(data.results.map(r => r.buyPct));
    return Array.from(values).sort((a, b) => a - b);
  };

  const getSellValues = () => {
    if (!data) return [];
    const values = new Set(data.results.map(r => r.sellPct));
    return Array.from(values).sort((a, b) => a - b);
  };

  // Get color for heatmap cell based on return value
  const getHeatmapColor = (value: number) => {
    if (value >= 20) return 'bg-green-700';
    if (value >= 10) return 'bg-green-600';
    if (value >= 5) return 'bg-green-500';
    if (value >= 0) return 'bg-green-400';
    if (value >= -5) return 'bg-red-400';
    if (value >= -10) return 'bg-red-500';
    return 'bg-red-600';
  };

  // Get return value for specific method/buy/sell combination
  const getReturnValue = (method: string, buyPct: number, sellPct: number) => {
    const result = data?.results.find(
      r => r.method === method && r.buyPct === buyPct && r.sellPct === sellPct
    );
    return result?.totalReturn || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Grid Search</h1>
          <a
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </a>
        </div>
        <p className="text-gray-600 mb-8">Parameter optimization - test multiple buy%/sell% combinations</p>

        {/* Filters */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symbol
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SYMBOLS.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>

            {/* Session */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session
              </label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SESSIONS.map(sess => (
                  <option key={sess} value={sess}>{sess}</option>
                ))}
              </select>
            </div>

            {/* Initial Capital */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Capital ($)
              </label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(parseFloat(e.target.value))}
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Trading Realism Settings */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Trading Realism Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Slippage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slippage (%)
                </label>
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value))}
                  step="0.05"
                  min="0"
                  max="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Increases buy prices and decreases sell prices (typical: 0.1-0.5%)
                </p>
              </div>

              {/* Conservative Rounding */}
              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conservativeRounding}
                    onChange={(e) => setConservativeRounding(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    Conservative Rounding
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Round up for buys (pay more), round down for sells (receive less)
                </p>
              </div>
            </div>
          </div>

          {/* Baseline Methods */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Baseline Methods
            </label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => handleMethodToggle(method)}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    selectedMethods.includes(method)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Selected: {selectedMethods.length} method{selectedMethods.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Buy % Range */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buy % Range
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min</label>
                <input
                  type="number"
                  value={buyMin}
                  onChange={(e) => setBuyMin(parseFloat(e.target.value))}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max</label>
                <input
                  type="number"
                  value={buyMax}
                  onChange={(e) => setBuyMax(parseFloat(e.target.value))}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Step</label>
                <input
                  type="number"
                  value={buyStep}
                  onChange={(e) => setBuyStep(parseFloat(e.target.value))}
                  step="0.1"
                  min="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Sell % Range */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sell % Range
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min</label>
                <input
                  type="number"
                  value={sellMin}
                  onChange={(e) => setSellMin(parseFloat(e.target.value))}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max</label>
                <input
                  type="number"
                  value={sellMax}
                  onChange={(e) => setSellMax(parseFloat(e.target.value))}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Step</label>
                <input
                  type="number"
                  value={sellStep}
                  onChange={(e) => setSellStep(parseFloat(e.target.value))}
                  step="0.1"
                  min="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || selectedMethods.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Running Grid Search...' : 'Run Grid Search'}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Total Combinations</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.totalCombinations}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Methods Tested</p>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.methodsTested}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Execution Time</p>
                  <p className="text-2xl font-bold text-gray-900">{(data.timing.total / 1000).toFixed(1)}s</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg per Combo</p>
                  <p className="text-2xl font-bold text-gray-900">{data.timing.avgPerCombination}ms</p>
                </div>
              </div>
              {(slippage > 0 || conservativeRounding) && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">Trading Realism Applied:</p>
                  <div className="flex gap-4 mt-2 text-sm text-blue-800">
                    {slippage > 0 && (
                      <span>✓ Slippage: {slippage}%</span>
                    )}
                    {conservativeRounding && (
                      <span>✓ Conservative Rounding</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Best Per Method */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Best Combination Per Method</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Buy %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sell %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Return %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Trades
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(data.bestPerMethod).map(([method, best]) => (
                      <tr key={method}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {best.buyPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {best.sellPct.toFixed(1)}%
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                          best.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {best.totalReturn.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {best.totalTrades}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">All Results</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-4 py-2 rounded-lg ${
                      viewMode === 'table'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    onClick={() => setViewMode('heatmap')}
                    className={`px-4 py-2 rounded-lg ${
                      viewMode === 'heatmap'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Heatmap View
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {viewMode === 'table' ? (
                /* Table View */
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Buy %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sell %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Return %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Trades
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Final Equity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.results.slice(0, 100).map((result, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {result.method}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.buyPct.toFixed(1)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.sellPct.toFixed(1)}%
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                            result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {result.totalReturn.toFixed(2)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.totalTrades}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${result.finalEquity.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.results.length > 100 && (
                    <p className="text-sm text-gray-500 mt-4 text-center">
                      Showing top 100 results. Export CSV for full data.
                    </p>
                  )}
                </div>
              ) : (
                /* Heatmap View */
                <div className="space-y-8">
                  {selectedMethods.map(method => {
                    const buyValues = getBuyValues();
                    const sellValues = getSellValues();
                    
                    return (
                      <div key={method}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{method}</h3>
                        <div className="overflow-x-auto">
                          <table className="border-collapse">
                            <thead>
                              <tr>
                                <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-sm font-medium">
                                  Buy % \ Sell %
                                </th>
                                {sellValues.map(sell => (
                                  <th key={sell} className="border border-gray-300 px-3 py-2 bg-gray-100 text-sm font-medium">
                                    {sell.toFixed(1)}%
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {buyValues.map(buy => (
                                <tr key={buy}>
                                  <td className="border border-gray-300 px-3 py-2 bg-gray-100 text-sm font-medium">
                                    {buy.toFixed(1)}%
                                  </td>
                                  {sellValues.map(sell => {
                                    const returnValue = getReturnValue(method, buy, sell);
                                    const colorClass = getHeatmapColor(returnValue);
                                    return (
                                      <td
                                        key={`${buy}-${sell}`}
                                        className={`border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-white ${colorClass}`}
                                        title={`Buy: ${buy.toFixed(1)}%, Sell: ${sell.toFixed(1)}%, Return: ${returnValue.toFixed(2)}%`}
                                      >
                                        {returnValue.toFixed(1)}%
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center gap-4 mt-4 text-sm">
                          <span className="text-gray-600">Legend:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-700"></div>
                            <span>≥20%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-600"></div>
                            <span>10-20%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500"></div>
                            <span>5-10%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-400"></div>
                            <span>0-5%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-400"></div>
                            <span>-5-0%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-600"></div>
                            <span>≤-10%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}