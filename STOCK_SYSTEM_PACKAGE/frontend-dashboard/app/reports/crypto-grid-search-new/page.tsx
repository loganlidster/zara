'use client';

import { useState } from 'react';
import Header from '@/components/Header';

const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DAI', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP', 'ZEC'];
const METHODS = ['EQUAL_MEAN', 'WINSORIZED'];

interface GridData {
  buy_pct: number;
  sell_pct: number;
  total_events: number;
  completed_trades: number;
  winning_trades: number;
  win_rate: number;
  avg_roi: number;
  total_return: number;
  min_roi: number;
  max_roi: number;
}

interface GridResponse {
  success: boolean;
  symbol: string;
  method: string;
  combinations: number;
  best_combination: GridData;
  data: GridData[];
}

export default function CryptoGridSearchReport() {
  const [symbol, setSymbol] = useState('ADA');
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2025-11-02');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GridResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const params = new URLSearchParams({
        symbol,
        method,
        start_date: startDate,
        end_date: endDate
      });
      
      const response = await fetch(`${API_URL}/api/crypto/grid-search-simple?${params}`);
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
    if (returnPct >= 150) return 'bg-green-700 text-white';
    if (returnPct >= 100) return 'bg-green-600 text-white';
    if (returnPct >= 50) return 'bg-green-500 text-white';
    if (returnPct >= 0) return 'bg-green-400';
    if (returnPct >= -50) return 'bg-red-400';
    if (returnPct >= -100) return 'bg-red-500 text-white';
    return 'bg-red-600 text-white';
  };

  // Get unique buy and sell percentages for heatmap
  const buyPcts = data ? Array.from(new Set(data.data.map(d => d.buy_pct))).sort((a, b) => a - b) : [];
  const sellPcts = data ? Array.from(new Set(data.data.map(d => d.sell_pct))).sort((a, b) => a - b) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Crypto Grid Search</h1>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Symbol</label>
              <select 
                value={symbol} 
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {CRYPTO_SYMBOLS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <select 
                value={method} 
                onChange={(e) => setMethod(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Run Grid Search'}
          </button>
        </form>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-bold mb-4">Best Combination</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Buy %</div>
                  <div className="text-2xl font-bold">{data.best_combination.buy_pct}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Sell %</div>
                  <div className="text-2xl font-bold">{data.best_combination.sell_pct}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Return</div>
                  <div className="text-2xl font-bold text-green-600">{data.best_combination.total_return}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Trades</div>
                  <div className="text-2xl font-bold">{data.best_combination.completed_trades}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Win Rate</div>
                  <div className="text-2xl font-bold">{data.best_combination.win_rate}%</div>
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Total Return Heatmap (%)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-100">Buy % \ Sell %</th>
                      {sellPcts.map(sell => (
                        <th key={sell} className="border p-2 bg-gray-100">{sell}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {buyPcts.map(buy => (
                      <tr key={buy}>
                        <td className="border p-2 bg-gray-100 font-medium">{buy}%</td>
                        {sellPcts.map(sell => {
                          const cell = data.data.find(d => d.buy_pct === buy && d.sell_pct === sell);
                          return (
                            <td 
                              key={`${buy}-${sell}`} 
                              className={`border p-2 text-center ${cell ? getHeatmapColor(cell.total_return) : 'bg-gray-200'}`}
                            >
                              {cell ? cell.total_return.toFixed(1) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}