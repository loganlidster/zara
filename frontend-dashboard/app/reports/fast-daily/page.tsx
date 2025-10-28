'use client';

import { useState } from 'react';
import { getTradeEvents, getSummary, TradeEvent } from '@/lib/api';
import { format } from 'date-fns';
import Header from '@/components/Header';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['ALL', 'RTH', 'AH'];

export default function FastDailyReport() {
  const [symbol, setSymbol] = useState('HIVE');
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [session, setSession] = useState('ALL');
  const [buyPct, setBuyPct] = useState(0.5);
  const [sellPct, setSellPct] = useState(0.5);
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('2025-09-30');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const [eventsData, summaryData] = await Promise.all([
        getTradeEvents({ symbol, method, session, buyPct, sellPct, startDate, endDate }),
        getSummary({ symbol, method, session, buyPct, sellPct, startDate, endDate })
      ]);

      setEvents(eventsData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-white">
      {/* Logo Watermark Background */}
      <div 
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'url(/RAAS_primary_transparent_512.png)',
          backgroundSize: '400px 400px',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <Header />
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Fast Daily Report</h1>
          <p className="text-gray-600">Single simulation showing all BUY/SELL events</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Baseline Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Session */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Buy % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buy %</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="3.0"
                value={buyPct}
                onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sell % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sell %</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="3.0"
                value={sellPct}
                onChange={(e) => setSellPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Run Report'}
              </button>
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-600">Start Value</div>
                <div className="text-2xl font-bold text-gray-900">${summary.startValue?.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">End Value</div>
                <div className="text-2xl font-bold text-gray-900">${summary.endValue?.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">ROI</div>
                <div className={`text-2xl font-bold ${summary.roiPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {summary.roiPct?.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Events</div>
                <div className="text-2xl font-bold text-gray-900">{summary.totalEvents}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Buy Events</div>
                <div className="text-2xl font-bold text-blue-500">{summary.buyEvents}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sell Events</div>
                <div className="text-2xl font-bold text-orange-500">{summary.sellEvents}</div>
              </div>
            </div>
          </div>
        )}

        {/* Events Table */}
        {events.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Trade Events ({events.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">BTC Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ratio</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Baseline</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Trade ROI</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {events.map((event, idx) => (
                    <tr key={idx} className={event.event_type === 'BUY' ? 'bg-blue-50' : 'bg-orange-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.event_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.event_time}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.session}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          event.event_type === 'BUY' ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'
                        }`}>
                          {event.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.stock_price.toFixed(4)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.btc_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{event.ratio.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{event.baseline.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {event.trade_roi_pct !== null ? (
                          <span className={event.trade_roi_pct >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {event.trade_roi_pct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Data */}
        {!loading && events.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">Run a report to see trade events</p>
          </div>
        )}
      </div>
    </div>
  );
}