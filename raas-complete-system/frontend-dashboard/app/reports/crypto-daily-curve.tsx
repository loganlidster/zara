'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const CRYPTO_SYMBOLS = ['BCH', 'LTC', 'XRP', 'DOGE', 'ETH', 'ADA', 'SOL', 'AVAX'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];

const COLORS = {
  BCH: '#F7931A',  // Bitcoin orange
  LTC: '#345D9D',  // Litecoin blue
  XRP: '#23292F',  // XRP black
  DOGE: '#C2A633', // Doge gold
  ETH: '#627EEA',  // Ethereum blue
  ADA: '#0033AD',  // Cardano blue
  SOL: '#14F195',  // Solana green
  AVAX: '#E84142', // Avalanche red
};

export default function CryptoDailyCurveReport() {
  const [symbol, setSymbol] = useState('ETH');
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [startDate, setStartDate] = useState('2025-10-01');
  const [endDate, setEndDate] = useState('2025-11-02');
  const [buyPct, setBuyPct] = useState(0.5);
  const [sellPct, setSellPct] = useState(0.5);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        symbol,
        method,
        buy_pct: buyPct.toString(),
        sell_pct: sellPct.toString(),
        start_date: startDate,
        end_date: endDate,
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/crypto/daily-curve?${params}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = data?.minuteData?.map((bar: any) => {
    const timestamp = new Date(bar.timestamp);
    const events = data.events.filter((e: any) => 
      new Date(e.event_timestamp).getTime() === timestamp.getTime()
    );

    return {
      timestamp: timestamp.toISOString(),
      time: timestamp.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      crypto_price: bar.crypto_price,
      baseline: bar.baseline,
      ratio: bar.ratio,
      buy_signal: events.find((e: any) => e.event_type === 'BUY') ? bar.crypto_price : null,
      sell_signal: events.find((e: any) => e.event_type === 'SELL') ? bar.crypto_price : null,
    };
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Crypto Daily Curve</h1>
          <p className="mt-2 text-sm text-gray-600">
            View crypto price movements with BUY/SELL signals based on baseline deviations (24/7 trading)
          </p>
        </div>

        {/* Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Symbol */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Crypto Symbol
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CRYPTO_SYMBOLS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Baseline Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Buy Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buy Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  value={buyPct}
                  onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Sell Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sell Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  value={sellPct}
                  onChange={(e) => setSellPct(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Generate Chart'}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-8">
            {/* Summary Stats */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Symbol</p>
                  <p className="text-2xl font-bold">{data.symbol}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Method</p>
                  <p className="text-2xl font-bold">{data.method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold">{data.totalEvents}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date Range</p>
                  <p className="text-sm font-medium">{data.dateRange.start} to {data.dateRange.end}</p>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Price Chart with Signals</h2>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis yAxisId="left" label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Ratio', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  
                  {/* Crypto Price */}
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="crypto_price" 
                    stroke={COLORS[symbol as keyof typeof COLORS] || '#8884d8'}
                    name={`${symbol} Price`}
                    dot={false}
                    strokeWidth={2}
                  />
                  
                  {/* Baseline (as ratio) */}
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="baseline" 
                    stroke="#94a3b8"
                    name="Baseline"
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="5 5"
                  />
                  
                  {/* BUY Signals */}
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="buy_signal" 
                    stroke="#10b981"
                    name="BUY Signal"
                    strokeWidth={0}
                    dot={{ fill: '#10b981', r: 6 }}
                  />
                  
                  {/* SELL Signals */}
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="sell_signal" 
                    stroke="#ef4444"
                    name="SELL Signal"
                    strokeWidth={0}
                    dot={{ fill: '#ef4444', r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Events Table */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Events ({data.events.length})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Baseline</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deviation</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.events.map((event: any, idx: number) => (
                      <tr key={idx} className={event.event_type === 'BUY' ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(event.event_timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            event.event_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {event.event_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          ${event.crypto_price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {event.baseline.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {event.deviation_pct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}