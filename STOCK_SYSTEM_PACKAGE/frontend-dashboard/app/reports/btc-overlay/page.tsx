'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const SYMBOLS = ['RIOT', 'MARA', 'CLSK', 'CIFR', 'CORZ', 'HUT', 'BTDR', 'HIVE', 'CAN', 'WULF', 'IREN'];
const METHODS = ['VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN', 'EQUAL_MEAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

interface MinuteData {
  et_date: string;
  et_time: string;
  stock_price: number;
  btc_price: number;
  ratio: number;
  session: string;
}

interface Trade {
  entryDate: string;
  entryTime: string;
  entryPrice: number;
  exitDate: string;
  exitTime: string;
  exitPrice: number;
  return: number;
  stockDelta: number;
  btcDelta: number;
}

interface SimulationSummary {
  totalReturn: number;
  totalReturnPct: number;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgReturn: number;
  bestTrade: number;
  worstTrade: number;
  finalEquity: number;
}

export default function BtcOverlayReport() {
  // Form state
  const [symbol, setSymbol] = useState('RIOT');
  const [method, setMethod] = useState('VWAP_RATIO');
  const [sessionType, setSessionType] = useState('RTH');
  const [startDate, setStartDate] = useState('2024-10-24');
  const [endDate, setEndDate] = useState('2024-10-29');
  const [buyThreshold, setBuyThreshold] = useState('0.5');
  const [sellThreshold, setSellThreshold] = useState('1.0');
  const [conservativePricing, setConservativePricing] = useState(true);
  const [slippage, setSlippage] = useState('0.0');

  // Session-specific thresholds for ALL mode
  const [rthBuyPct, setRthBuyPct] = useState('0.5');
  const [rthSellPct, setRthSellPct] = useState('1.0');
  const [ahBuyPct, setAhBuyPct] = useState('0.8');
  const [ahSellPct, setAhSellPct] = useState('1.5');

  // Data state
  const [minuteData, setMinuteData] = useState<MinuteData[]>([]);
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('price');

  // Load minute data
  const loadMinuteData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/btc-overlay-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          startDate,
          endDate,
          sessionType
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load data');
      }

      setMinuteData(data.data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading minute data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run simulation
  const runSimulation = async () => {
    try {
      setLoading(true);
      setError(null);

      const requestBody: any = {
        symbol,
        startDate,
        endDate,
        method,
        buyThreshold: parseFloat(buyThreshold),
        sellThreshold: parseFloat(sellThreshold),
        sessionType,
        conservativePricing,
        slippage: parseFloat(slippage),
        initialCapital: 10000
      };

      if (sessionType === 'ALL') {
        requestBody.rthBuyPct = parseFloat(rthBuyPct);
        requestBody.rthSellPct = parseFloat(rthSellPct);
        requestBody.ahBuyPct = parseFloat(ahBuyPct);
        requestBody.ahSellPct = parseFloat(ahSellPct);
      }

      const response = await fetch(`${API_URL}/api/simulate-trades-detailed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Simulation failed');
      }

      setSimulation(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error running simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = minuteData.map((bar) => {
    const timestamp = `${bar.et_date} ${bar.et_time}`;
    return {
      timestamp,
      stockPrice: bar.stock_price,
      btcPrice: bar.btc_price,
      ratio: bar.ratio
    };
  });

  // Export to CSV
  const exportToCSV = () => {
    if (!simulation) return;

    const headers = ['Entry Date', 'Entry Time', 'Entry Price', 'Exit Date', 'Exit Time', 'Exit Price', 'Return %', 'Stock Delta %', 'BTC Delta %'];
    const rows = simulation.trades.map((t: Trade) => [
      t.entryDate,
      t.entryTime,
      t.entryPrice.toFixed(2),
      t.exitDate,
      t.exitTime,
      t.exitPrice.toFixed(2),
      t.return.toFixed(2),
      t.stockDelta.toFixed(2),
      t.btcDelta.toFixed(2)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `btc-overlay-${symbol}-${startDate}-${endDate}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">BTC Overlay Report</h1>
          {simulation && (
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              📥 Export CSV
            </button>
          )}
        </div>

        {/* Controls Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {SYMBOLS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baseline Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Session */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {SESSIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Buy Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buy Threshold %</label>
              <input
                type="number"
                step="0.1"
                value={buyThreshold}
                onChange={(e) => setBuyThreshold(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Sell Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sell Threshold %</label>
              <input
                type="number"
                step="0.1"
                value={sellThreshold}
                onChange={(e) => setSellThreshold(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Slippage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slippage</label>
              <input
                type="number"
                step="0.0001"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Session-specific thresholds for ALL mode */}
          {sessionType === 'ALL' && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="font-semibold mb-3">Session-Specific Thresholds</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RTH Buy %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rthBuyPct}
                    onChange={(e) => setRthBuyPct(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RTH Sell %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rthSellPct}
                    onChange={(e) => setRthSellPct(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AH Buy %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ahBuyPct}
                    onChange={(e) => setAhBuyPct(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AH Sell %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ahSellPct}
                    onChange={(e) => setAhSellPct(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={loadMinuteData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Load Data'}
            </button>
            <button
              onClick={runSimulation}
              disabled={loading || minuteData.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Running...' : 'Run Simulation'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>

        {/* Summary Statistics */}
        {simulation && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Summary Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Return</p>
                <p className={`text-2xl font-bold ${simulation.summary.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {simulation.summary.totalReturnPct.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Trades</p>
                <p className="text-2xl font-bold">{simulation.summary.tradeCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold">{simulation.summary.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Return</p>
                <p className="text-2xl font-bold">{simulation.summary.avgReturn.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Best Trade</p>
                <p className="text-2xl font-bold text-green-600">{simulation.summary.bestTrade.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Worst Trade</p>
                <p className="text-2xl font-bold text-red-600">{simulation.summary.worstTrade.toFixed(2)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Charts and Tables */}
        {minuteData.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex space-x-4 px-6">
                <button
                  onClick={() => setActiveTab('price')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === 'price'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Price Chart
                </button>
                <button
                  onClick={() => setActiveTab('equity')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === 'equity'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Equity Curve
                </button>
                <button
                  onClick={() => setActiveTab('trades')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === 'trades'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Trade List
                </button>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'price' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Stock &amp; BTC Prices</h3>
                  <ResponsiveContainer width="100%" height={500}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis yAxisId="left" label={{ value: 'Stock Price ($)', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'BTC Price ($)', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="stockPrice" stroke="#8884d8" name="Stock Price" dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="btcPrice" stroke="#82ca9d" name="BTC Price" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {activeTab === 'equity' && simulation && simulation.dailyEquity && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={simulation.dailyEquity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis label={{ value: 'Equity ($)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="endEquity" stroke="#8884d8" name="Equity" />
                      <ReferenceLine y={10000} stroke="red" strokeDasharray="3 3" label="Initial Capital" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {activeTab === 'trades' && simulation && simulation.trades && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Trade List</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Price</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Price</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Return %</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Δ %</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">BTC Δ %</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {simulation.trades.map((trade: Trade, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trade.entryDate} {trade.entryTime}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">${trade.entryPrice.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trade.exitDate} {trade.exitTime}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">${trade.exitPrice.toFixed(2)}</td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {trade.return.toFixed(2)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{trade.stockDelta.toFixed(2)}%</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{trade.btcDelta.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {minuteData.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            Click "Load Data" to begin
          </div>
        )}
      </div>
    </div>
  );
}