102,108c\
     // Get baselines for the PREVIOUS trading day (lagging baseline strategy)\
     // We use yesterday's baseline to trade today\
     const baselineResult = await client.query(`\
       SELECT session, baseline\
       FROM baseline_daily\
       WHERE trading_day < $1\
         AND symbol = $2\
         AND method = $3\
       ORDER BY trading_day DESC\
       LIMIT 1\
     `, [date, symbol, method]);
