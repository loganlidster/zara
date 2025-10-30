'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, TrendingUp, TrendingDown } from 'lucide-react';
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
  Scatter,
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

  // Load minute data when symbol/dates change
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

      // Add session-specific thresholds if ALL mode
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
  const chartData = minuteData.map((bar, index) => {
    const timestamp = `${bar.et_date} ${bar.et_time}`;
    
    // Find if there's a trade at this timestamp
    const trade = simulation?.trades?.find((t: Trade) => 
      `${t.entryDate} ${t.entryTime}` === timestamp || 
      `${t.exitDate} ${t.exitTime}` === timestamp
    );

    return {
      timestamp,
      stockPrice: bar.stock_price,
      btcPrice: bar.btc_price,
      ratio: bar.ratio,
      trade: trade ? (
        `${t.entryDate} ${t.entryTime}` === timestamp ? 'BUY' : 'SELL'
      ) : null
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">BTC Overlay Report</h1>
        {simulation && (
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Controls Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Symbol */}
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Method */}
            <div className="space-y-2">
              <Label>Baseline Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Session */}
            <div className="space-y-2">
              <Label>Session</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Buy Threshold */}
            <div className="space-y-2">
              <Label>Buy Threshold %</Label>
              <Input
                type="number"
                step="0.1"
                value={buyThreshold}
                onChange={(e) => setBuyThreshold(e.target.value)}
              />
            </div>

            {/* Sell Threshold */}
            <div className="space-y-2">
              <Label>Sell Threshold %</Label>
              <Input
                type="number"
                step="0.1"
                value={sellThreshold}
                onChange={(e) => setSellThreshold(e.target.value)}
              />
            </div>

            {/* Slippage */}
            <div className="space-y-2">
              <Label>Slippage</Label>
              <Input
                type="number"
                step="0.0001"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
              />
            </div>
          </div>

          {/* Session-specific thresholds for ALL mode */}
          {sessionType === 'ALL' && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-3">Session-Specific Thresholds</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>RTH Buy %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={rthBuyPct}
                    onChange={(e) => setRthBuyPct(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>RTH Sell %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={rthSellPct}
                    onChange={(e) => setRthSellPct(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>AH Buy %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={ahBuyPct}
                    onChange={(e) => setAhBuyPct(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>AH Sell %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={ahSellPct}
                    onChange={(e) => setAhSellPct(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={loadMinuteData} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load Data
            </Button>
            <Button onClick={runSimulation} disabled={loading || minuteData.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Simulation
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {simulation && (
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p className={`text-2xl font-bold ${simulation.summary.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {simulation.summary.totalReturnPct.toFixed(2)}%
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Trades</p>
                <p className="text-2xl font-bold">{simulation.summary.tradeCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{simulation.summary.winRate.toFixed(1)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg Return</p>
                <p className="text-2xl font-bold">{simulation.summary.avgReturn.toFixed(2)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Best Trade</p>
                <p className="text-2xl font-bold text-green-600">{simulation.summary.bestTrade.toFixed(2)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Worst Trade</p>
                <p className="text-2xl font-bold text-red-600">{simulation.summary.worstTrade.toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {minuteData.length > 0 && (
        <Tabs defaultValue="price" className="w-full">
          <TabsList>
            <TabsTrigger value="price">Price Chart</TabsTrigger>
            <TabsTrigger value="equity">Equity Curve</TabsTrigger>
            <TabsTrigger value="trades">Trade List</TabsTrigger>
          </TabsList>

          <TabsContent value="price">
            <Card>
              <CardHeader>
                <CardTitle>Stock & BTC Prices with Trade Markers</CardTitle>
              </CardHeader>
              <CardContent>
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
                    {simulation && simulation.trades.map((trade: Trade, index: number) => (
                      <>
                        <ReferenceLine 
                          key={`entry-${index}`}
                          x={`${trade.entryDate} ${trade.entryTime}`} 
                          stroke="green" 
                          strokeDasharray="3 3"
                          label="BUY"
                        />
                        <ReferenceLine 
                          key={`exit-${index}`}
                          x={`${trade.exitDate} ${trade.exitTime}`} 
                          stroke="red" 
                          strokeDasharray="3 3"
                          label="SELL"
                        />
                      </>
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equity">
            <Card>
              <CardHeader>
                <CardTitle>Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                {simulation && simulation.dailyEquity && (
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trades">
            <Card>
              <CardHeader>
                <CardTitle>Trade List</CardTitle>
              </CardHeader>
              <CardContent>
                {simulation && simulation.trades && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Entry</th>
                          <th className="text-left p-2">Entry Price</th>
                          <th className="text-left p-2">Exit</th>
                          <th className="text-left p-2">Exit Price</th>
                          <th className="text-right p-2">Return %</th>
                          <th className="text-right p-2">Stock Δ %</th>
                          <th className="text-right p-2">BTC Δ %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulation.trades.map((trade: Trade, index: number) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="p-2">{trade.entryDate} {trade.entryTime}</td>
                            <td className="p-2">${trade.entryPrice.toFixed(2)}</td>
                            <td className="p-2">{trade.exitDate} {trade.exitTime}</td>
                            <td className="p-2">${trade.exitPrice.toFixed(2)}</td>
                            <td className={`text-right p-2 font-semibold ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {trade.return >= 0 ? <TrendingUp className="inline h-4 w-4 mr-1" /> : <TrendingDown className="inline h-4 w-4 mr-1" />}
                              {trade.return.toFixed(2)}%
                            </td>
                            <td className="text-right p-2">{trade.stockDelta.toFixed(2)}%</td>
                            <td className="text-right p-2">{trade.btcDelta.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {minuteData.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Click "Load Data" to begin
          </CardContent>
        </Card>
      )}
    </div>
  );
}