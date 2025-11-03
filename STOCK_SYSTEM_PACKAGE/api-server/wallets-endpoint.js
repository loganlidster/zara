/**
 * Wallets Endpoint
 * 
 * Fetches wallet configurations and stock settings from live trading database.
 * This allows users to load their actual live trading settings into reports.
 */

let livePool = null;

// Lazy load live DB connection
async function getLivePool() {
  if (!livePool) {
    try {
      const liveDbModule = await import('./live-db.js');
      livePool = liveDbModule.default;
    } catch (error) {
      console.error('[Wallets] Failed to load live DB:', error);
      throw new Error('Live database connection not available');
    }
  }
  return livePool;
}

// Method name mapping from live DB to testing DB
const METHOD_MAP = {
  'MEDIAN': 'WEIGHTED_MEDIAN',
  'EQUAL_MEAN': 'EQUAL_MEAN',
  'VWAP_RATIO': 'VWAP_RATIO',
  'VOL_WEIGHTED': 'VOL_WEIGHTED',
  'WINSORIZED': 'WINSORIZED'
};

/**
 * Get all wallets with their stock configurations
 */
async function handleGetWallets(req, res) {
  try {
    console.log('[Wallets] Fetching all wallets from live database');

    const pool = await getLivePool();

    // Fetch all wallets
    const walletsQuery = `
      SELECT 
        wallet_id,
        user_id,
        env,
        name,
        enabled,
        created_at,
        updated_at
      FROM public.wallets
      ORDER BY name ASC
    `;

    const walletsResult = await pool.query(walletsQuery);
    const wallets = walletsResult.rows;

    console.log(`[Wallets] Found ${wallets.length} wallets`);

    // For each wallet, fetch stock configurations
    const walletsWithStocks = await Promise.all(
      wallets.map(async (wallet) => {
        const stocksQuery = `
          SELECT 
            symbol,
            buy_budget_usd,
            buy_pct_rth,
            sell_pct_rth,
            buy_pct_ah,
            sell_pct_ah,
            method_rth,
            method_ah,
            updated_at,
            budget_mode,
            percent_budget,
            enabled
          FROM public.wallet_symbols
          WHERE wallet_id = $1
          ORDER BY symbol ASC
        `;

        const stocksResult = await pool.query(stocksQuery, [wallet.wallet_id]);
        
        // Map method names and format data
        const stocks = stocksResult.rows.map(stock => ({
          symbol: stock.symbol,
          method_rth: METHOD_MAP[stock.method_rth] || stock.method_rth,
          method_ah: METHOD_MAP[stock.method_ah] || stock.method_ah,
          buy_pct_rth: parseFloat(stock.buy_pct_rth),
          sell_pct_rth: parseFloat(stock.sell_pct_rth),
          buy_pct_ah: parseFloat(stock.buy_pct_ah),
          sell_pct_ah: parseFloat(stock.sell_pct_ah),
          buy_budget_usd: stock.buy_budget_usd ? parseFloat(stock.buy_budget_usd) : null,
          budget_mode: stock.budget_mode,
          percent_budget: stock.percent_budget ? parseFloat(stock.percent_budget) : null,
          enabled: stock.enabled,
          updated_at: stock.updated_at
        }));

        return {
          wallet_id: wallet.wallet_id,
          user_id: wallet.user_id,
          env: wallet.env,
          name: wallet.name,
          enabled: wallet.enabled,
          created_at: wallet.created_at,
          updated_at: wallet.updated_at,
          stock_count: stocks.length,
          enabled_stock_count: stocks.filter(s => s.enabled).length,
          stocks: stocks
        };
      })
    );

    res.json({
      success: true,
      count: walletsWithStocks.length,
      wallets: walletsWithStocks
    });

  } catch (error) {
    console.error('[Wallets] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get specific wallet by ID
 */
async function handleGetWalletById(req, res) {
  try {
    const { walletId } = req.params;
    console.log(`[Wallets] Fetching wallet ${walletId}`);

    const pool = await getLivePool();

    // Fetch wallet
    const walletQuery = `
      SELECT 
        wallet_id,
        user_id,
        env,
        name,
        enabled,
        created_at,
        updated_at
      FROM public.wallets
      WHERE wallet_id = $1
    `;

    const walletResult = await pool.query(walletQuery, [walletId]);
    
    if (walletResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const wallet = walletResult.rows[0];

    // Fetch stock configurations
    const stocksQuery = `
      SELECT 
        symbol,
        buy_budget_usd,
        buy_pct_rth,
        sell_pct_rth,
        buy_pct_ah,
        sell_pct_ah,
        method_rth,
        method_ah,
        updated_at,
        budget_mode,
        percent_budget,
        enabled
      FROM public.wallet_symbols
      WHERE wallet_id = $1
      ORDER BY symbol ASC
    `;

    const stocksResult = await pool.query(stocksQuery, [walletId]);
    
    // Map method names and format data
    const stocks = stocksResult.rows.map(stock => ({
      symbol: stock.symbol,
      method_rth: METHOD_MAP[stock.method_rth] || stock.method_rth,
      method_ah: METHOD_MAP[stock.method_ah] || stock.method_ah,
      buy_pct_rth: parseFloat(stock.buy_pct_rth),
      sell_pct_rth: parseFloat(stock.sell_pct_rth),
      buy_pct_ah: parseFloat(stock.buy_pct_ah),
      sell_pct_ah: parseFloat(stock.sell_pct_ah),
      buy_budget_usd: stock.buy_budget_usd ? parseFloat(stock.buy_budget_usd) : null,
      budget_mode: stock.budget_mode,
      percent_budget: stock.percent_budget ? parseFloat(stock.percent_budget) : null,
      enabled: stock.enabled,
      updated_at: stock.updated_at
    }));

    res.json({
      success: true,
      wallet: {
        wallet_id: wallet.wallet_id,
        user_id: wallet.user_id,
        env: wallet.env,
        name: wallet.name,
        enabled: wallet.enabled,
        created_at: wallet.created_at,
        updated_at: wallet.updated_at,
        stock_count: stocks.length,
        enabled_stock_count: stocks.filter(s => s.enabled).length,
        stocks: stocks
      }
    });

  } catch (error) {
    console.error('[Wallets] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export { handleGetWallets, handleGetWalletById };