'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Header from '@/components/Header';

const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP'];
const METHODS = ['EQUAL_MEAN', 'WINSORIZED'];

interface CurvePoint {
  date: string;
  timestamp: string;
  trade_roi: number;
  cumulative_return: number;
}

interface DailyCurveResponse {
  success: boolean;
  symbol: string;
  method: string;
  buy_pct: number;
  sell_pct: number;
  summary: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    avg_return: number;
    total_return: number;
  };
  curve: CurvePoint[];
}

export default function CryptoDailyCurveReport() {
  const [symbol, setSymbol] = useState('ADA');
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [buyPct, setBuyPct] = useState(1.0);
  const [sellPct, setSellPct] = useState(2.0);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2025-11-02');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DailyCurveResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const params = new URLSearchParams({
        symbol,
        method,
        buy_pct: buyPct.toString(),
        sell_pct: sellPct.toString(),
        start_date: startDate,
        end_date: endDate
      });
      
      const response = await fetch(`${API_URL}/api/crypto/daily-curve-simple?${params}`);
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
        <h1 className="text-3xl font-bold mb-6">Crypto Daily Curve & ROI</h1>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                 <label className="block text-sm font-medium mb-1">Buy %</label>
                 <select 
                   value={buyPct} 
                   onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                   className="w-full border rounded px-3 py-2"
                 >
                   <option value="0.3">0.3%</option>
                   <option value="1.0">1.0%</option>
                   <option value="1.5">1.5%</option>
                   <option value="2.0">2.0%</option>
                   <option value="3.0">3.0%</option>
                   <option value="4.0">4.0%</option>
                   <option value="5.0">5.0%</option>
                 </select>
               </div>
            
            <div>
                 <label className="block text-sm font-medium mb-1">Sell %</label>
                 <select 
                   value={sellPct} 
                   onChange={(e) => setSellPct(parseFloat(e.target.value))}
                   className="w-full border rounded px-3 py-2"
                 >
                   <option value="0.3">0.3%</option>
                   <option value="1.0">1.0%</option>
                   <option value="1.5">1.5%</option>
                   <option value="2.0">2.0%</option>
                   <option value="3.0">3.0%</option>
                   <option value="4.0">4.0%</option>
                   <option value="5.0">5.0%</option>
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
            {loading ? 'Loading...' : 'Generate Curve'}
          </button>
        </form>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary Stats */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-bold mb-4">Performance Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Return</div>
                  <div className={`text-2xl font-bold ${data.summary.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.summary.total_return.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Trades</div>
                  <div className="text-2xl font-bold">{data.summary.total_trades}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Winning</div>
                  <div className="text-2xl font-bold text-green-600">{data.summary.winning_trades}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Losing</div>
                  <div className="text-2xl font-bold text-red-600">{data.summary.losing_trades}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Win Rate</div>
                  <div className="text-2xl font-bold">{data.summary.win_rate.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Avg Return</div>
                  <div className="text-2xl font-bold">{data.summary.avg_return.toFixed(2)}%</div>
                </div>
              </div>
            </div>

            {/* Cumulative Return Chart */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-bold mb-4">Cumulative Return Over Time</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.curve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    label={{ value: 'Cumulative Return (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cumulative_return" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Cumulative Return (%)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Trade History Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h2 className="text-xl font-bold">Recent Trades</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Trade ROI</th>
                      <th className="px-4 py-3 text-right">Cumulative Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.curve.slice(-20).reverse().map((point, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{point.date}</td>
                        <td className={`px-4 py-3 text-right ${point.trade_roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {point.trade_roi.toFixed(2)}%
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${point.cumulative_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {point.cumulative_return.toFixed(2)}%
                        </td>
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