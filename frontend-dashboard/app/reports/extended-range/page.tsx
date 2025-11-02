'use client';

import { useState } from 'react';
import { getTradeEvents, getSummary, TradeEvent } from '@/lib/api';
import { format } from 'date-fns';
import Header from '@/components/Header';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR'];
const SESSIONS = ['RTH', 'AH'];

// Helper function to determine session from time
function getSessionFromTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // RTH is 9:30 AM to 4:00 PM (570 to 960 minutes)
  if (totalMinutes >= 570 && totalMinutes < 960) {
    return 'RTH';
  }
  return 'AH';
}

// Helper function to format date as MM/DD/YYYY
function formatDate(dateStr: string): string {
  // Date is already in YYYY-MM-DD format, just reformat without timezone conversion
    const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

// Conservative rounding with slippage
function applyConservativeRounding(price: number, isBuy: boolean, slippagePct: number = 0): number {
  // Apply slippage first
  let adjustedPrice = price;
  if (slippagePct > 0) {
    adjustedPrice = isBuy 
      ? price * (1 + slippagePct / 100)
      : price * (1 - slippagePct / 100);
  }
  
  // Then apply conservative rounding
  if (isBuy) {
    return Math.ceil(adjustedPrice * 100) / 100;
  } else {
    return Math.floor(adjustedPrice * 100) / 100;
  }
}

export default function ExtendedRangeReport() {
  const [symbol, setSymbol] = useState('HIVE');
  const [session, setSession] = useState('RTH');
  const [buyPct, setBuyPct] = useState(0.5);
  const [sellPct, setSellPct] = useState(-1.0); // Default to negative
  const [useConservativeRounding, setUseConservativeRounding] = useState(true);
  const [slippagePct, setSlippagePct] = useState(0);
  const [startDate, setStartDate] = useState('2024-09-01');
  const [endDate, setEndDate] = useState('2025-10-22');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const exportToCSV = () => {
    if (events.length === 0) return;
    
    const headers = [
      'Date', 'Time', 'Session', 'Type', 'Stock Price', 'Adjusted Price', 'BTC Price', 'Ratio', 'Baseline',
      'Shares', 'Cash', 'Portfolio', 'ROI %', 'Trade ROI'
    ];
    
    const rows = events.map(e => [
      formatDate(e.event_date),
      e.event_time,
      e.session,
      e.event_type,
      e.stock_price.toFixed(4),
      e.adjusted_price.toFixed(2),
      e.btc_price.toFixed(2),
      e.ratio.toFixed(2),
      e.baseline.toFixed(2),
      e.shares_held || 0,
      e.cash_balance?.toFixed(2) || '0.00',
      e.portfolio_value?.toFixed(2) || '0.00',
      e.roi_pct?.toFixed(2) || '0.00',
      e.trade_roi_pct?.toFixed(2) || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extended-range-${symbol}-EQUAL_MEAN-${session}-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const apiParams: any = {
        symbol,
        method: 'EQUAL_MEAN', // Fixed to EQUAL_MEAN
        session,
        buyPct,
        sellPct,
        startDate,
        endDate
      };

      const eventsData = await getTradeEvents(apiParams);

      // Add session field to each event based on time
      const eventsWithSession = eventsData.map(event => ({
        ...event,
        session: getSessionFromTime(event.event_time)
      }));

      // Sort events by date and time chronologically
      const sortedEvents = eventsWithSession.sort((a, b) => {
        const dateCompare = a.event_date.localeCompare(b.event_date);
        if (dateCompare !== 0) return dateCompare;
        return a.event_time.localeCompare(b.event_time);
      });

      // Filter to only show executed trades (alternating BUY/SELL)
      const executedTrades = [];
      let expectingBuy = true;
      
      for (const event of sortedEvents) {
        if (expectingBuy && event.event_type === 'BUY') {
          executedTrades.push(event);
          expectingBuy = false;
        } else if (!expectingBuy && event.event_type === 'SELL') {
          executedTrades.push(event);
          expectingBuy = true;
        }
      }

      // Calculate wallet simulation
      let cash = 10000;
      let shares = 0;
      const eventsWithWallet = executedTrades.map((event) => {
        // Apply slippage and optional conservative rounding
        let adjustedPrice = event.stock_price;
        
        if (useConservativeRounding) {
          adjustedPrice = applyConservativeRounding(
            event.stock_price, 
            event.event_type === 'BUY',
            slippagePct
          );
        } else {
          if (slippagePct > 0) {
            adjustedPrice = event.event_type === 'BUY'
              ? event.stock_price * (1 + slippagePct / 100)
              : event.stock_price * (1 - slippagePct / 100);
          }
        }

        if (event.event_type === 'BUY') {
          const sharesToBuy = Math.floor(cash / adjustedPrice);
          const cost = sharesToBuy * adjustedPrice;
          cash -= cost;
          shares += sharesToBuy;
        } else if (event.event_type === 'SELL' && shares > 0) {
          const proceeds = shares * adjustedPrice;
          cash += proceeds;
          shares = 0;
        }
        
        const portfolioValue = cash + (shares * adjustedPrice);
        const roi = ((portfolioValue - 10000) / 10000) * 100;
        
        return {
          ...event,
          adjusted_price: adjustedPrice,
          shares_held: shares,
          cash_balance: cash,
          portfolio_value: portfolioValue,
          roi_pct: roi
        };
      });

      // Calculate summary
      const buyEvents = eventsWithWallet.filter(e => e.event_type === 'BUY').length;
      const sellEvents = eventsWithWallet.filter(e => e.event_type === 'SELL').length;
      const finalEvent = eventsWithWallet[eventsWithWallet.length - 1];
      const finalValue = finalEvent?.portfolio_value || 10000;
      const finalROI = ((finalValue - 10000) / 10000) * 100;

      setEvents(eventsWithWallet);
      setSummary({
        startValue: 10000,
        endValue: finalValue,
        roiPct: finalROI,
        totalEvents: eventsWithWallet.length,
        buyEvents,
        sellEvents
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Extended Range Report (EQUAL_MEAN)</h1>
          <p className="text-gray-600">Test EQUAL_MEAN strategy with extended ranges including negative sell thresholds</p>
          <p className="text-sm text-blue-600 mt-2">
            💡 Negative sell thresholds allow selling above baseline during BTC downturns
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buy % (0.1 to 4.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="4.0"
                value={buyPct}
                onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sell % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sell % (-2.0 to 3.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="-2.0"
                max="3.0"
                value={sellPct}
                onChange={(e) => setSellPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Negative = sell above baseline</p>
            </div>

            {/* Slippage % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slippage %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={slippagePct}
                onChange={(e) => setSlippagePct(parseFloat(e.target.value))}
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

            {/* Submit Button and Conservative Rounding */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Run Report'}
              </button>
              <label className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={useConservativeRounding}
                  onChange={(e) => setUseConservativeRounding(e.target.checked)}
                  className="mr-2"
                />
                Conservative Rounding
              </label>
            </div>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Export Button */}
        {events.length > 0 && (
          <button
            onClick={exportToCSV}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors mb-6 font-medium"
          >
            Export to CSV
          </button>
        )}

        {/* Summary */}
        {summary && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Start Value</p>
                <p className="text-2xl font-bold">${summary.startValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">End Value</p>
                <p className="text-2xl font-bold">${summary.endValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ROI</p>
                <p className={`text-2xl font-bold ${summary.roiPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.roiPct.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-2xl font-bold">{summary.totalEvents}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-600">Buy Events</p>
                <p className="text-xl font-bold text-blue-600">{summary.buyEvents}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sell Events</p>
                <p className="text-xl font-bold text-orange-600">{summary.sellEvents}</p>
              </div>
            </div>
          </div>
        )}

        {/* Events Table */}
        {events.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold">Trade Events ({events.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BTC Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ratio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Baseline</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROI %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {events.map((event, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(event.event_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{event.event_time}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          event.session === 'RTH' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {event.session}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          event.event_type === 'BUY' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {event.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">${event.stock_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">${event.btc_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{event.ratio.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{event.baseline.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{event.shares_held}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">${event.cash_balance.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">${event.portfolio_value.toFixed(2)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        event.roi_pct >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {event.roi_pct.toFixed(2)}%
                      </td>
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