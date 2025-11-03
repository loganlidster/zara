/**
 * Alpaca API Client
 * 
 * Fetches actual trading data from Alpaca accounts (paper and live)
 * to compare against simulated results.
 * 
 * Supports multiple Alpaca accounts for different users and environments.
 */

// Alpaca API credentials for different accounts
const ALPACA_ACCOUNTS = {
  'aaron_live': {
    key: 'AKM66J83T3HY7ATG6TX8',
    secret: 'zXtNFJm0gMjozrMoHH1b7ipzUDIaMFdyZOydDvEp',
    baseUrl: 'https://api.alpaca.markets'
  },
  'aaron_paper': {
    key: 'PK5O3P0965R40JCKO6EX',
    secret: 'ukJIIDXNNrccKy6eA5UkVrAGAiPEjG4z4otEbCSb',
    baseUrl: 'https://paper-api.alpaca.markets'
  },
  'logan_live': {
    key: 'AKPOCPLRX08Q6XEK7Q8O',
    secret: 'P7x8qxMyfCaSIGjS14e0IsZIWrzC8AVxXUXzZ9p0',
    baseUrl: 'https://api.alpaca.markets'
  },
  'logan_paper': {
    key: 'PKM9CGRKTW3SVUT19YQB',
    secret: 'XVGrnhMlsnE83QO1UYLgteUeOsoQ830Ha93xliE7',
    baseUrl: 'https://paper-api.alpaca.markets'
  }
};

/**
 * Get Alpaca credentials for a specific user and environment
 * @param {string} userId - User ID (e.g., 'P51WMvxXc4XVD73ASaaFysEIIKZ2' for Logan)
 * @param {string} env - Environment ('live' or 'paper')
 * @returns {Object} Alpaca credentials
 */
function getAlpacaCredentials(userId, env) {
  // Map user IDs to account names
  const userMap = {
    'Gu30l6MKUnhMjRouzmqtLCPLm6M2': 'aaron', // Aaron's user ID
    'P51WMvxXc4XVD73ASaaFysEIIKZ2': 'logan'  // Logan's user ID
  };
  
  const userName = userMap[userId] || 'logan'; // Default to Logan
  const accountKey = `${userName}_${env}`;
  
  const account = ALPACA_ACCOUNTS[accountKey];
  if (!account) {
    throw new Error(`No Alpaca account configured for ${userName} ${env}`);
  }
  
  return account;
}

/**
 * Get orders from Alpaca
 * @param {Object} params - Query parameters
 * @param {string} params.userId - User ID to determine which Alpaca account to use
 * @param {string} params.env - Environment ('live' or 'paper')
 * @param {string} params.after - Start date (YYYY-MM-DD)
 * @param {string} params.until - End date (YYYY-MM-DD)
 * @param {string} params.status - Order status (all, open, closed, filled, etc.)
 * @param {number} params.limit - Max number of orders to return
 * @returns {Promise<Array>} Array of order objects
 */
export async function getOrders(params = {}) {
  const { userId, env, ...queryOptions } = params;
  
  // Get credentials for this user/env
  const credentials = getAlpacaCredentials(userId, env);
  
  const queryParams = new URLSearchParams();
  if (queryOptions.after) queryParams.append('after', queryOptions.after);
  if (queryOptions.until) queryParams.append('until', queryOptions.until);
  if (queryOptions.status) queryParams.append('status', queryOptions.status);
  if (queryOptions.limit) queryParams.append('limit', queryOptions.limit.toString());
  if (queryOptions.direction) queryParams.append('direction', queryOptions.direction);
  
  const url = `${credentials.baseUrl}/v2/orders?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': credentials.key,
        'APCA-API-SECRET-KEY': credentials.secret
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${error}`);
    }

    const orders = await response.json();
    console.log(`[Alpaca] Fetched ${orders.length} orders for ${env} account`);
    return orders;
  } catch (error) {
    console.error('[Alpaca] Error fetching orders:', error);
    throw error;
  }
}

/**
 * Get specific order by ID
 * @param {string} orderId - Alpaca order ID
 * @param {string} userId - User ID to determine which Alpaca account to use
 * @param {string} env - Environment ('live' or 'paper')
 * @returns {Promise<Object>} Order object
 */
export async function getOrderById(orderId, userId, env) {
  const credentials = getAlpacaCredentials(userId, env);
  const url = `${credentials.baseUrl}/v2/orders/${orderId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': credentials.key,
        'APCA-API-SECRET-KEY': credentials.secret
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
 * @param {string} userId - User ID to determine which Alpaca account to use
 * @param {string} env - Environment ('live' or 'paper')
 * @returns {Promise<Object>} Account object
 */
export async function getAccount(userId, env) {
  const credentials = getAlpacaCredentials(userId, env);
  const url = `${credentials.baseUrl}/v2/account`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': credentials.key,
        'APCA-API-SECRET-KEY': credentials.secret
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
 * @param {string} params.userId - User ID to determine which Alpaca account to use
 * @param {string} params.env - Environment ('live' or 'paper')
 * @param {string} params.period - Time period (1D, 1W, 1M, 3M, 1A, all)
 * @param {string} params.timeframe - Timeframe (1Min, 5Min, 15Min, 1H, 1D)
 * @param {string} params.date_end - End date (YYYY-MM-DD)
 * @param {boolean} params.extended_hours - Include extended hours
 * @returns {Promise<Object>} Portfolio history object
 */
export async function getPortfolioHistory(params = {}) {
  const { userId, env, ...queryOptions } = params;
  const credentials = getAlpacaCredentials(userId, env);
  
  const queryParams = new URLSearchParams();
  if (queryOptions.period) queryParams.append('period', queryOptions.period);
  if (queryOptions.timeframe) queryParams.append('timeframe', queryOptions.timeframe);
  if (queryOptions.date_end) queryParams.append('date_end', queryOptions.date_end);
  if (queryOptions.extended_hours !== undefined) {
    queryParams.append('extended_hours', queryOptions.extended_hours.toString());
  }
  
  const url = `${credentials.baseUrl}/v2/account/portfolio/history?${queryParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': credentials.key,
        'APCA-API-SECRET-KEY': credentials.secret
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
 * @param {string} userId - User ID to determine which Alpaca account to use
 * @param {string} env - Environment ('live' or 'paper')
 * @returns {Promise<Array>} Array of position objects
 */
export async function getPositions(userId, env) {
  const credentials = getAlpacaCredentials(userId, env);
  const url = `${credentials.baseUrl}/v2/positions`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': credentials.key,
        'APCA-API-SECRET-KEY': credentials.secret
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
  getPositions,
  getAlpacaCredentials
};