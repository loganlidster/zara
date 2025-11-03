'use client';

import { useState } from 'react';
import Header from '@/components/Header';

const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP'];
const METHODS = ['EQUAL_MEAN', 'WINSORIZED'];

interface FastDailyResult {
  symbol: string;
  buy_pct: number;
  sell_pct: number;
  num_trades: number;
  total_return: number;
  avg_return: number;
  min_return: number;
  max_return: number;
  winning_trades: number;
  win_rate: number;
}

interface FastDailyResponse {
  success: boolean;
  symbol: string;
  method: string;
  results: FastDailyResult[];
  total_combinations: number;
}

export default function CryptoFastDailyReport() {
  const [symbol, setSymbol] = useState('ADA');
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2025-11-02');
  const [limit, setLimit] = useState(50);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FastDailyResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-server-neon-five.vercel.app';
      const params = new URLSearchParams({
        symbol,
        method,
        start_date: startDate,
        end_date: endDate,
        limit: limit.toString()
      });
      
      const response = await fetch(`${API_URL}/api/crypto/fast-daily-simple?${params}`);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Crypto Fast Daily - Top Performers</h1>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Symbol</label>
              <select 
                value={symbol} 
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">All Symbols</option>
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
            
            <div>
              <label className="block text-sm font-medium mb-1">Top N</label>
              <input 
                type="number" 
                value={limit} 
                onChange={(e) => setLimit(parseInt(e.target.value))}
                min="10"
                max="100"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Get Top Performers'}
          </button>
        </form>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {data && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b">
              <h2 className="text-xl font-bold">
                Top {data.results.length} Combinations - {data.symbol} ({data.method})
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-right">Buy %</th>
                    <th className="px-4 py-3 text-right">Sell %</th>
                    <th className="px-4 py-3 text-right">Total Return</th>
                    <th className="px-4 py-3 text-right">Avg Return</th>
                    <th className="px-4 py-3 text-right">Trades</th>
                    <th className="px-4 py-3 text-right">Win Rate</th>
                    <th className="px-4 py-3 text-right">Min</th>
                    <th className="px-4 py-3 text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((result, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{result.symbol}</td>
                      <td className="px-4 py-3 text-right">{result.buy_pct}%</td>
                      <td className="px-4 py-3 text-right">{result.sell_pct}%</td>
                      <td className={`px-4 py-3 text-right font-bold ${result.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.total_return.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right">{result.avg_return.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right">{result.num_trades}</td>
                      <td className="px-4 py-3 text-right">{result.win_rate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-red-600">{result.min_return.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right text-green-600">{result.max_return.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}