'use client';

import { useState } from 'react';
import { getTradeEvents, getSummary, TradeEvent } from '@/lib/api';
import { format } from 'date-fns';
import Header from '@/components/Header';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

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
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Conservative rounding with slippage
function applyConservativeRounding(price: number, isBuy: boolean, slippagePct: number = 0): number {
  // Apply slippage first
  const priceWithSlippage = isBuy 
    ? price * (1 + slippagePct / 100)  // Increase price for buys
    : price * (1 - slippagePct / 100); // Decrease price for sells
  
  // Round to nearest cent
  const cents = Math.round(priceWithSlippage * 100);
  
  if (isBuy) {
    // Round UP for buys (conservative - pay more)
    return Math.ceil(cents) / 100;
  } else {
    // Round DOWN for sells (conservative - receive less)
    return Math.floor(cents) / 100;
  }
}

export default function FastDailyReport() {
  const [symbol, setSymbol] = useState('HIVE');
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [rthMethod, setRthMethod] = useState('EQUAL_MEAN');
  const [ahMethod, setAhMethod] = useState('EQUAL_MEAN');
  const [session, setSession] = useState('RTH');
  const [buyPct, setBuyPct] = useState(0.5);
  const [sellPct, setSellPct] = useState(0.5);
  const [rthBuyPct, setRthBuyPct] = useState(0.5);
  const [rthSellPct, setRthSellPct] = useState(0.5);
  const [ahBuyPct, setAhBuyPct] = useState(0.5);
  const [ahSellPct, setAhSellPct] = useState(0.5);
  const [useSameValues, setUseSameValues] = useState(true);
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
      'Shares Held', 'Cash Balance', 'Portfolio Value', 'ROI %', 'Trade ROI %'
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
    a.download = `fast-daily-${symbol}-${method}-${session}-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Prepare API parameters based on session type
      const apiParams: any = {
        symbol,
        method,
        session,
        startDate,
        endDate
      };

      if (session === 'ALL') {
        // Use separate RTH and AH values
        apiParams.rthBuyPct = useSameValues ? buyPct : rthBuyPct;
        apiParams.rthSellPct = useSameValues ? sellPct : rthSellPct;
        apiParams.ahBuyPct = useSameValues ? buyPct : ahBuyPct;
        apiParams.ahSellPct = useSameValues ? sellPct : ahSellPct;
      } else {
        // Single session - use regular buy/sell percentages
        apiParams.buyPct = buyPct;
        apiParams.sellPct = sellPct;
      }

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
          // Apply conservative rounding with slippage
          adjustedPrice = applyConservativeRounding(
            event.stock_price, 
            event.event_type === 'BUY',
            slippagePct
          );
        } else {
          // Just apply slippage without rounding
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

      // Calculate summary from filtered events
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
    <div className="min-h-screen relative bg-white">
      {/* Logo Watermark Background */}
      <div 
        className="fixed inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'url(/RAAS_primary_transparent_512.png)',
          backgroundSize: '700px 700px',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <Header />
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Fast Daily Report</h1>
          <p className="text-gray-600">Single simulation showing all BUY/SELL events with optional conservative rounding</p>
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

            {/* Conditional inputs based on session */}
            {session === 'ALL' ? (
              <>
                {/* Use Same Values Checkbox */}
                <div className="col-span-full">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={useSameValues}
                      onChange={(e) => setUseSameValues(e.target.checked)}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Use same values for RTH and AH</span>
                  </label>
                </div>

                {useSameValues ? (
                  <>
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
                  </>
                ) : (
                  <>
                    {/* RTH Settings Box */}
                    <div className="col-span-2 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-blue-800 mb-3">RTH Settings (9:30 AM - 4:00 PM)</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Buy %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="3.0"
                            value={rthBuyPct}
                            onChange={(e) => setRthBuyPct(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Sell %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="3.0"
                            value={rthSellPct}
                            onChange={(e) => setRthSellPct(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* AH Settings Box */}
                    <div className="col-span-2 bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-purple-800 mb-3">AH Settings (After Hours)</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Buy %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="3.0"
                            value={ahBuyPct}
                            onChange={(e) => setAhBuyPct(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Sell %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="3.0"
                            value={ahSellPct}
                            onChange={(e) => setAhSellPct(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
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
              </>
            )}

            {/* Slippage % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slippage %</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="5.0"
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
                className="w-full bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Run Report'}
              </button>
              <label className="flex items-center space-x-2 cursor-pointer justify-center">
                <input
                  type="checkbox"
                  checked={useConservativeRounding}
                  onChange={(e) => setUseConservativeRounding(e.target.checked)}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Conservative Rounding</span>
              </label>
            </div>
          </form>
          
          {/* Export CSV Button - Separate row */}
          {events.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={exportToCSV}
                className="w-full bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 transition-colors"
              >
                Export to CSV
              </button>
            </div>
          )}
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolio</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROI %</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Trade ROI</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {events.map((event, idx) => (
                    <tr key={idx} className={event.event_type === 'BUY' ? 'bg-blue-50' : 'bg-orange-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(event.event_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.event_time}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.session}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          event.event_type === 'BUY' ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'
                        }`}>
                          {event.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.adjusted_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.btc_price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{event.ratio.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{event.baseline.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{event.shares_held || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.cash_balance?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${event.portfolio_value?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          (event.roi_pct || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {event.roi_pct?.toFixed(2) || '0.00'}%
                        </span>
                      </td>
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