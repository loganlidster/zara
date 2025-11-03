'use client';

import { useState } from 'react';
import Header from '@/components/Header';

const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DAI', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP', 'ZEC'];
const METHODS = ['EQUAL_MEAN', 'WINSORIZED'];
const THRESHOLDS = [0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];

interface TradeEvent {
  event_timestamp: string;
  event_type: string;
  crypto_price: number;
  btc_price: number;
  ratio: number;
  baseline: number;
  trade_roi_pct: number | null;
}

// Helper function to format date as MM/DD/YYYY
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

// Helper function to format time as HH:MM:SS
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[1].substring(0, 8);
}

// Helper function to format price with appropriate decimal places
function formatPrice(price: number): string {
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.1) return price.toFixed(5);
  if (price >= 0.01) return price.toFixed(6);
  return price.toFixed(8);
}

// Conservative rounding with slippage - adaptive precision for crypto
function applyConservativeRounding(price: number, isBuy: boolean, slippagePct: number = 0): number {
  // Apply slippage first
  const priceWithSlippage = isBuy 
    ? price * (1 + slippagePct / 100)  // Increase price for buys
    : price * (1 - slippagePct / 100); // Decrease price for sells
  
  // Determine appropriate decimal places based on price
  // This ensures rounding impact is reasonable across all price ranges
  let decimalPlaces: number;
  if (priceWithSlippage >= 100) {
    decimalPlaces = 2;  // $100+ -> round to cents ($100.12)
  } else if (priceWithSlippage >= 10) {
    decimalPlaces = 3;  // $10-99 -> round to 0.1 cents ($10.123)
  } else if (priceWithSlippage >= 1) {
    decimalPlaces = 4;  // $1-9 -> round to 0.01 cents ($1.1234)
  } else if (priceWithSlippage >= 0.1) {
    decimalPlaces = 5;  // $0.10-0.99 -> 5 decimals ($0.12345)
  } else if (priceWithSlippage >= 0.01) {
    decimalPlaces = 6;  // $0.01-0.09 -> 6 decimals ($0.012345)
  } else {
    decimalPlaces = 8;  // <$0.01 -> 8 decimals (like BTC precision)
  }
  
  const multiplier = Math.pow(10, decimalPlaces);
  const scaled = priceWithSlippage * multiplier;
  
  if (isBuy) {
    // Round UP for buys (conservative - pay more)
    return Math.ceil(scaled) / multiplier;
  } else {
    // Round DOWN for sells (conservative - receive less)
    return Math.floor(scaled) / multiplier;
  }
}

export default function CryptoFastDailyReport() {
  const [symbol, setSymbol] = useState('ETH');
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [buyPct, setBuyPct] = useState(1.0);
  const [sellPct, setSellPct] = useState(1.0);
  const [useConservativeRounding, setUseConservativeRounding] = useState(true);
  const [slippagePct, setSlippagePct] = useState(0);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2025-11-02');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

      const response = await fetch(`${API_URL}/api/crypto/fast-daily-events?${params}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch data');
        return;
      }

      // Process events with portfolio tracking
      const processedEvents = [];
      let sharesHeld = 0;
      let cashBalance = 10000; // Starting cash
      let lastBuyPrice = 0;

      for (const event of data.events) {
        const isBuy = event.event_type === 'BUY';
        const rawPrice = parseFloat(event.crypto_price);
        
        // Apply conservative rounding if enabled
        const adjustedPrice = useConservativeRounding 
          ? applyConservativeRounding(rawPrice, isBuy, slippagePct)
          : rawPrice;

        let tradeRoi = null;

        if (isBuy) {
          // Buy: use all cash to buy shares
          const sharesToBuy = cashBalance / adjustedPrice;
          sharesHeld += sharesToBuy;
          cashBalance = 0;
          lastBuyPrice = adjustedPrice;
        } else if (sharesHeld > 0) {
          // Sell: sell all shares
          const saleProceeds = sharesHeld * adjustedPrice;
          cashBalance += saleProceeds;
          
          // Calculate trade ROI
          if (lastBuyPrice > 0) {
            tradeRoi = ((adjustedPrice - lastBuyPrice) / lastBuyPrice) * 100;
          }
          
          sharesHeld = 0;
        }

        const portfolioValue = cashBalance + (sharesHeld * adjustedPrice);
        const roi = ((portfolioValue - 10000) / 10000) * 100;

        processedEvents.push({
          ...event,
          adjusted_price: adjustedPrice,
          shares_held: sharesHeld,
          cash_balance: cashBalance,
          portfolio_value: portfolioValue,
          roi_pct: roi,
          trade_roi_pct: tradeRoi
        });
      }

      setEvents(processedEvents);

      // Calculate summary
      const finalPortfolioValue = processedEvents.length > 0 
        ? processedEvents[processedEvents.length - 1].portfolio_value 
        : 10000;
      
      const totalReturn = ((finalPortfolioValue - 10000) / 10000) * 100;
      const completedTrades = processedEvents.filter(e => e.trade_roi_pct !== null).length;
      const winningTrades = processedEvents.filter(e => e.trade_roi_pct !== null && e.trade_roi_pct > 0).length;
      const winRate = completedTrades > 0 ? (winningTrades / completedTrades) * 100 : 0;

      setSummary({
        total_events: processedEvents.length,
        completed_trades: completedTrades,
        winning_trades: winningTrades,
        win_rate: winRate,
        total_return: totalReturn,
        final_portfolio_value: finalPortfolioValue
      });

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (events.length === 0) return;
    
    const headers = [
      'Date', 'Time', 'Type', 'Crypto Price', 'Adjusted Price', 'BTC Price', 'Ratio', 'Baseline',
      'Shares Held', 'Cash Balance', 'Portfolio Value', 'ROI %', 'Trade ROI %'
    ];
    
    const rows = events.map(e => [
      formatDate(e.event_timestamp),
      formatTime(e.event_timestamp),
      e.event_type,
      formatPrice(e.crypto_price),
      formatPrice(e.adjusted_price),
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
    a.download = `crypto_fast_daily_${symbol}_${method}_${buyPct}_${sellPct}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Crypto Fast Daily Report</h1>
        <p className="text-gray-600 mb-6">Single simulation showing all BUY/SELL events with optional conservative rounding</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
              <label className="block text-sm font-medium mb-1">Baseline Method</label>
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
                {THRESHOLDS.map(t => (
                  <option key={t} value={t}>{t}%</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Sell %</label>
              <select 
                value={sellPct} 
                onChange={(e) => setSellPct(parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2"
              >
                {THRESHOLDS.map(t => (
                  <option key={t} value={t}>{t}%</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Slippage %</label>
              <input 
                type="number" 
                step="0.1"
                value={slippagePct} 
                onChange={(e) => setSlippagePct(parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
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

          <div className="mb-4">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={useConservativeRounding}
                onChange={(e) => setUseConservativeRounding(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Conservative Rounding</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Run Report'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-bold mb-4">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Events</div>
                <div className="text-2xl font-bold">{summary.total_events}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Completed Trades</div>
                <div className="text-2xl font-bold">{summary.completed_trades}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Winning Trades</div>
                <div className="text-2xl font-bold">{summary.winning_trades}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Win Rate</div>
                <div className="text-2xl font-bold">{summary.win_rate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Return</div>
                <div className={`text-2xl font-bold ${summary.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.total_return.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Final Value</div>
                <div className="text-2xl font-bold">${summary.final_portfolio_value.toFixed(2)}</div>
              </div>
            </div>
            
            <button 
              onClick={exportToCSV}
              className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Export to CSV
            </button>
          </div>
        )}

        {/* Events Table */}
        {events.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Crypto Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Adjusted</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">BTC Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ratio</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Baseline</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Shares</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cash</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Portfolio</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROI %</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Trade ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {events.map((event, idx) => (
                    <tr key={idx} className={event.event_type === 'BUY' ? 'bg-green-50' : 'bg-red-50'}>
                      <td className="px-4 py-3 text-sm">{formatDate(event.event_timestamp)}</td>
                      <td className="px-4 py-3 text-sm">{formatTime(event.event_timestamp)}</td>
                      <td className="px-4 py-3 text-sm font-medium">{event.event_type}</td>
                      <td className="px-4 py-3 text-sm text-right">${formatPrice(event.crypto_price)}</td>
                      <td className="px-4 py-3 text-sm text-right">${formatPrice(event.adjusted_price)}</td>
                      <td className="px-4 py-3 text-sm text-right">${event.btc_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">{event.ratio.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">{event.baseline.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">{event.shares_held.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">${event.cash_balance.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">${event.portfolio_value.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${event.roi_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {event.roi_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {event.trade_roi_pct !== null ? `${event.trade_roi_pct.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && events.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">
            Run a report to see trade events
          </div>
        )}
      </div>
    </div>
  );
}