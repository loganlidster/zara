// API client for Tradiac event-based data
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // Increase to 2 minutes for large queries
});

export interface TradeEvent {
  symbol: string;
  method: string;
  session: string;
  buy_pct: number;
  sell_pct: number;
  event_date: string;
  event_time: string;
  event_type: 'BUY' | 'SELL';
  stock_price: number;
  btc_price: number;
  ratio: number;
  baseline: number;
  trade_roi_pct: number | null;
}

export interface SimulationMetadata {
  symbol: string;
  method: string;
  session: string;
  buy_pct: number;
  sell_pct: number;
  status: string;
  first_event_date: string;
  last_event_date: string;
  total_events: number;
  total_buys: number;
  total_sells: number;
  avg_trade_roi_pct: number;
  win_rate_pct: number;
}

export interface TopPerformer {
  symbol: string;
  method: string;
  session: string;
  buy_pct: number;
  sell_pct: number;
  roi_pct: number;
  total_events: number;
  buy_events: number;
  sell_events: number;
}

// Get trade events for a specific combination
export async function getTradeEvents(params: {
  symbol: string;
  method: string;
  session: string;
  buyPct?: number;
  sellPct?: number;
  rthBuyPct?: number;
  rthSellPct?: number;
  ahBuyPct?: number;
  ahSellPct?: number;
  startDate: string;
  endDate: string;
}): Promise<TradeEvent[]> {
  const response = await api.get('/api/events/query', { params });
  // Convert string values to numbers
  return response.data.events.map((event: any) => ({
    ...event,
    stock_price: parseFloat(event.stock_price),
    btc_price: parseFloat(event.btc_price),
    ratio: parseFloat(event.ratio),
    baseline: parseFloat(event.baseline),
    trade_roi_pct: event.trade_roi_pct ? parseFloat(event.trade_roi_pct) : null,
  }));
}

// Get summary for a specific combination
export async function getSummary(params: {
  symbol: string;
  method: string;
  session: string;
  buyPct?: number;
  sellPct?: number;
  rthBuyPct?: number;
  rthSellPct?: number;
  ahBuyPct?: number;
  ahSellPct?: number;
  startDate: string;
  endDate: string;
}) {
  const response = await api.get('/api/events/summary', { params });
  return response.data.summary;
}

// Get top performers
export async function getTopPerformers(params: {
  startDate: string;
  endDate: string;
  limit?: number;
  symbol?: string;
  method?: string;
  session?: string;
}): Promise<TopPerformer[]> {
  const response = await api.get('/api/events/top-performers', { params });
  return response.data.topPerformers;
}

// Get metadata for all simulations
export async function getMetadata(params?: {
  symbol?: string;
  method?: string;
  session?: string;
  status?: string;
}): Promise<SimulationMetadata[]> {
  const response = await api.get('/api/events/metadata', { params });
  return response.data.metadata;
}

// Get BTC impact analysis
export async function getBtcImpact(params: {
  symbol: string;
  method: string;
  session: string;
  buyPct: number;
  sellPct: number;
  startDate: string;
  endDate: string;
}) {
  const response = await api.get('/api/flexible/btc-impact', { params });
  return response.data.analysis;
}

// Get intraday patterns
export async function getIntradayPatterns(params: {
  symbol: string;
  method: string;
  session: string;
  buyPct: number;
  sellPct: number;
  startDate: string;
  endDate: string;
}) {
  const response = await api.get('/api/flexible/intraday-patterns', { params });
  return response.data.patterns;
}

// Get holding periods analysis
export async function getHoldingPeriods(params: {
  symbol: string;
  method: string;
  session: string;
  buyPct: number;
  sellPct: number;
  startDate: string;
  endDate: string;
}) {
  const response = await api.get('/api/flexible/holding-periods', { params });
  return response.data.statistics;
}

export default api;