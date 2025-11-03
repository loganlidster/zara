'use client';

import { useState } from 'react';
import Header from '@/components/Header';

const CRYPTO_SYMBOLS = ['ADA']; // Only ADA has data right now
const METHODS = ['EQUAL_MEAN', 'WINSORIZED'];

interface GridResult {
  method: string;
  buyPct: number;
  sellPct: number;
  totalReturn: number;
  totalReturnPct: number;
  totalTrades: number;
  finalEquity: number;
}

interface GridResponse {
  success: boolean;
  symbol: string;
  results: GridResult[];
  bestPerMethod: Record<string, GridResult>;
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

export default function CryptoGridSearchReport() {
  const [symbol, setSymbol] = useState('ADA');
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['EQUAL_MEAN']);
  const [buyMin, setBuyMin] = useState(0.2);
  const [buyMax, setBuyMax] = useState(2.0);
  const [buyStep, setBuyStep] = useState(0.2);
  const [sellMin, setSellMin] = useState(0.2);
  const [sellMax, setSellMax] = useState(2.0);
  const [sellStep, setSellStep] = useState(0.2);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-31');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [slippage, setSlippage] = useState(0.1);
  const [conservativeRounding, setConservativeRounding] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GridResponse | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'heatmap'>('heatmap');

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
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-server-neon-five.vercel.app';
      const response = await fetch(`${API_URL}/api/crypto/crypto-grid-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          methods: selectedMethods,
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
      
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getHeatmapColor = (returnPct: number) => {
    if (returnPct >= 10) return 'bg-green-600 text-white';
    if (returnPct >= 5) return 'bg-green-500 text-white';
    if (returnPct >= 2) return 'bg-green-400 text-white';
    if (returnPct >= 0) return 'bg-green-200 text-gray-900';
    if (returnPct >= -2) return 'bg-red-200 text-gray-900';
    if (returnPct >= -5) return 'bg-red-400 text-white';
    return 'bg-red-600 text-white';
  };

  const renderHeatmap = (method: string) => {
    if (!data) return null;
    
    const methodResults = data.results.filter(r => r.method === method);
    if (methodResults.length === 0) return null;
    
    const buyValues = [...new Set(methodResults.map(r => r.buyPct))].sort((a, b) => a - b);
    const sellValues = [...new Set(methodResults.map(r => r.sellPct))].sort((a, b) => a - b);
    
    const resultMap = new Map();
    methodResults.forEach(r => {
      resultMap.set(`${r.buyPct}-${r.sellPct}`, r);
    });
    
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{method}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-2 bg-gray-100 text-sm font-semibold">
                  Buy % →<br/>Sell % ↓
                </th>
                {buyValues.map(buy => (
                  <th key={buy} className="border border-gray-300 px-2 py-2 bg-gray-100 text-sm font-semibold">
                    {buy.toFixed(1)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellValues.map(sell => (
                <tr key={sell}>
                  <td className="border border-gray-300 px-2 py-2 bg-gray-100 text-sm font-semibold">
                    {sell.toFixed(1)}%
                  </td>
                  {buyValues.map(buy => {
                    const result = resultMap.get(`${buy}-${sell}`);
                    if (!result) {
                      return <td key={buy} className="border border-gray-300 px-2 py-2 bg-gray-50 text-center text-xs">-</td>;
                    }
                    return (
                      <td 
                        key={buy} 
                        className={`border border-gray-300 px-2 py-2 text-center text-xs font-semibold ${getHeatmapColor(result.totalReturnPct)}`}
                        title={`Buy: ${buy}%, Sell: ${sell}%\nReturn: ${result.totalReturnPct.toFixed(2)}%\nTrades: ${result.totalTrades}`}
                      >
                        {result.totalReturnPct.toFixed(1)}%
                        <div className="text-[10px] opacity-75">{result.totalTrades}t</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {data.bestPerMethod[method] && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-sm font-semibold text-green-900">
              Best: Buy {data.bestPerMethod[method].buyPct}%, Sell {data.bestPerMethod[method].sellPct}% 
              → {data.bestPerMethod[method].totalReturnPct.toFixed(2)}% return ({data.bestPerMethod[method].totalTrades} trades)
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Crypto Grid Search</h1>
          <p className="text-gray-600">Test all buy/sell combinations with heatmap visualization</p>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {CRYPTO_SYMBOLS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Buy Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buy Min %</label>
              <input
                type="number"
                step="0.1"
                value={buyMin}
                onChange={(e) => setBuyMin(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buy Max %</label>
              <input
                type="number"
                step="0.1"
                value={buyMax}
                onChange={(e) => setBuyMax(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buy Step %</label>
              <input
                type="number"
                step="0.1"
                value={buyStep}
                onChange={(e) => setBuyStep(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Sell Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sell Min %</label>
              <input
                type="number"
                step="0.1"
                value={sellMin}
                onChange={(e) => setSellMin(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sell Max %</label>
              <input
                type="number"
                step="0.1"
                value={sellMax}
                onChange={(e) => setSellMax(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sell Step %</label>
              <input
                type="number"
                step="0.1"
                value={sellStep}
                onChange={(e) => setSellStep(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Capital & Slippage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Capital</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slippage %</label>
              <input
                type="number"
                step="0.1"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="conservative"
                checked={conservativeRounding}
                onChange={(e) => setConservativeRounding(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="conservative" className="text-sm text-gray-700">
                Conservative Rounding
              </label>
            </div>
          </div>

          {/* Method Selection */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Baseline Methods</label>
            <div className="flex gap-3">
              {METHODS.map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => handleMethodToggle(method)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    selectedMethods.includes(method)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {loading ? 'Searching...' : 'Run Grid Search'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="bg-white rounded-lg shadow p-6">
            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{data.stats.totalCombinations}</div>
                <div className="text-sm text-gray-600">Combinations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{data.stats.methodsTested}</div>
                <div className="text-sm text-gray-600">Methods</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{(data.timing.total / 1000).toFixed(1)}s</div>
                <div className="text-sm text-gray-600">Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{data.timing.avgPerCombination.toFixed(0)}ms</div>
                <div className="text-sm text-gray-600">Avg/Combo</div>
              </div>
            </div>

            {/* View Toggle */}
            <div className="mb-6 flex gap-3">
              <button
                onClick={() => setViewMode('heatmap')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  viewMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Heatmap View
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Table View
              </button>
            </div>

            {/* Heatmap View */}
            {viewMode === 'heatmap' && (
              <div>
                {selectedMethods.map(method => renderHeatmap(method))}
              </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">Method</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">Buy %</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">Sell %</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Return %</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Trades</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Final Equity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results
                      .sort((a, b) => b.totalReturnPct - a.totalReturnPct)
                      .slice(0, 50)
                      .map((result, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="px-4 py-2 text-sm text-gray-900">{result.method}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{result.buyPct.toFixed(1)}%</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{result.sellPct.toFixed(1)}%</td>
                          <td className={`px-4 py-2 text-sm text-right font-semibold ${
                            result.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {result.totalReturnPct.toFixed(2)}%
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900">{result.totalTrades}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900">
                            ${result.finalEquity.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}