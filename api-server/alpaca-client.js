/**
 * Alpaca API Client
 * 
 * Fetches actual trading data from Alpaca paper trading account
 * to compare against simulated results.
 */

const ALPACA_API_KEY = 'PKM9CGRKTW3SVUT19YQB';
const ALPACA_SECRET = 'XVGrnhMlsnE83QO1UYLgteUeOsoQ830Ha93xliE7';
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets';

/**
 * Get orders from Alpaca
 * @param {Object} params - Query parameters
 * @param {string} params.after - Start date (YYYY-MM-DD)
 * @param {string} params.until - End date (YYYY-MM-DD)
 * @param {string} params.status - Order status (all, open, closed, filled, etc.)
 * @param {number} params.limit - Max number of orders to return
 * @returns {Promise<Array>} Array of order objects
 */
export async function getOrders(params = {}) {
  const queryParams = new URLSearchParams();
  
  if (params.after) queryParams.append('after', params.after);
  if (params.until) queryParams.append('until', params.until);
  if (params.status) queryParams.append('status', params.status);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.direction) queryParams.append('direction', params.direction);
  
  const url = `${ALPACA_BASE_URL}/v2/orders?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${error}`);
    }

    const orders = await response.json();
    console.log(`[Alpaca] Fetched ${orders.length} orders`);
    return orders;
  } catch (error) {
    console.error('[Alpaca] Error fetching orders:', error);
    throw error;
  }
}

/**
 * Get specific order by ID
 * @param {string} orderId - Alpaca order ID
 * @returns {Promise<Object>} Order object
 */
export async function getOrderById(orderId) {
  const url = `${ALPACA_BASE_URL}/v2/orders/${orderId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[Alpaca] Error fetching order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Get account information
 * @returns {Promise<Object>} Account object
 */
export async function getAccount() {
  const url = `${ALPACA_BASE_URL}/v2/account`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Alpaca] Error fetching account:', error);
    throw error;
  }
}

/**
 * Get portfolio history
 * @param {Object} params - Query parameters
 * @param {string} params.period - Time period (1D, 1W, 1M, 3M, 1A, all)
 * @param {string} params.timeframe - Timeframe (1Min, 5Min, 15Min, 1H, 1D)
 * @param {string} params.date_end - End date (YYYY-MM-DD)
 * @param {boolean} params.extended_hours - Include extended hours
 * @returns {Promise<Object>} Portfolio history object
 */
export async function getPortfolioHistory(params = {}) {
  const queryParams = new URLSearchParams();
  
  if (params.period) queryParams.append('period', params.period);
  if (params.timeframe) queryParams.append('timeframe', params.timeframe);
  if (params.date_end) queryParams.append('date_end', params.date_end);
  if (params.extended_hours !== undefined) {
    queryParams.append('extended_hours', params.extended_hours.toString());
  }
  
  const url = `${ALPACA_BASE_URL}/v2/account/portfolio/history?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Alpaca] Error fetching portfolio history:', error);
    throw error;
  }
}

/**
 * Get current positions
 * @returns {Promise<Array>} Array of position objects
 */
export async function getPositions() {
  const url = `${ALPACA_BASE_URL}/v2/positions`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Alpaca] Error fetching positions:', error);
    throw error;
  }
}

export default {
  getOrders,
  getOrderById,
  getAccount,
  getPortfolioHistory,
  getPositions
};