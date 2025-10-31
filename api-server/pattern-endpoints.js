import pkg from 'pg';
const { Pool } = pkg;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || '/cloudsql/tradiac-testing:us-central1:tradiac-testing',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tradiac_testing',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Helper function to execute queries
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// GET /api/patterns/summary
// Returns overview of all pattern types with counts and statistics
export async function getPatternSummary(req, res) {
  try {
    const query = `
      SELECT 
        pattern_type,
        COUNT(*) as instance_count,
        ROUND(AVG(btc_change_pct), 2) as avg_change_pct,
        ROUND(MIN(btc_change_pct), 2) as min_change_pct,
        ROUND(MAX(btc_change_pct), 2) as max_change_pct,
        MIN(start_date) as first_occurrence,
        MAX(start_date) as last_occurrence,
        ROUND(AVG(btc_end_price - btc_start_price), 2) as avg_price_change
      FROM btc_patterns
      GROUP BY pattern_type
      ORDER BY instance_count DESC
    `;

    const results = await executeQuery(query);

    res.json({
      success: true,
      data: results,
      total_patterns: results.reduce((sum, r) => sum + parseInt(r.instance_count), 0)
    });
  } catch (error) {
    console.error('Error in getPatternSummary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// GET /api/patterns/instances?type=CRASH&limit=100&offset=0&startDate=2024-01-01&endDate=2025-12-31
// Returns specific instances of a pattern type
export async function getPatternInstances(req, res) {
  try {
    const { 
      type, 
      limit = 100, 
      offset = 0,
      startDate,
      endDate,
      minChange,
      maxChange
    } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Pattern type is required'
      });
    }

    let query = `
      SELECT 
        pattern_id,
        pattern_type,
        start_date,
        start_time,
        end_date,
        end_time,
        ROUND(btc_start_price, 2) as btc_start_price,
        ROUND(btc_end_price, 2) as btc_end_price,
        ROUND(btc_change_pct, 2) as btc_change_pct,
        ROUND(btc_high_price, 2) as btc_high_price,
        ROUND(btc_low_price, 2) as btc_low_price,
        pattern_metrics
      FROM btc_patterns
      WHERE pattern_type = $1
    `;

    const params = [type];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND start_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND start_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (minChange) {
      query += ` AND btc_change_pct >= $${paramIndex}`;
      params.push(minChange);
      paramIndex++;
    }

    if (maxChange) {
      query += ` AND btc_change_pct <= $${paramIndex}`;
      params.push(maxChange);
      paramIndex++;
    }

    query += ` ORDER BY start_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const results = await executeQuery(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM btc_patterns WHERE pattern_type = $1`;
    const countParams = [type];
    
    if (startDate) {
      countQuery += ` AND start_date >= $${countParams.length + 1}`;
      countParams.push(startDate);
    }
    if (endDate) {
      countQuery += ` AND start_date <= $${countParams.length + 1}`;
      countParams.push(endDate);
    }
    if (minChange) {
      countQuery += ` AND btc_change_pct >= $${countParams.length + 1}`;
      countParams.push(minChange);
    }
    if (maxChange) {
      countQuery += ` AND btc_change_pct <= $${countParams.length + 1}`;
      countParams.push(maxChange);
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = parseInt(countResult[0].total);

    res.json({
      success: true,
      data: results,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('Error in getPatternInstances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// GET /api/patterns/overreactions?limit=20
// Returns record high drops ranked by overreaction score
export async function getOverreactions(req, res) {
  try {
    const { limit = 20 } = req.query;

    const query = `
      SELECT 
        pattern_id,
        start_date as record_high_date,
        end_date as drop_date,
        ROUND(btc_start_price, 2) as record_high_price,
        ROUND(btc_end_price, 2) as price_after_drop,
        ROUND(btc_change_pct, 2) as drop_pct,
        pattern_metrics->>'days_to_drop' as days_to_drop,
        ROUND((pattern_metrics->>'max_drop_pct')::NUMERIC, 2) as max_drop_pct,
        ROUND((pattern_metrics->>'overreaction_score')::NUMERIC, 2) as overreaction_score
      FROM btc_patterns
      WHERE pattern_type = 'RECORD_HIGH_DROP'
      ORDER BY (pattern_metrics->>'overreaction_score')::NUMERIC DESC
      LIMIT $1
    `;

    const results = await executeQuery(query, [limit]);

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error in getOverreactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// GET /api/patterns/details/:patternId
// Returns detailed information about a specific pattern instance
export async function getPatternDetails(req, res) {
  try {
    const { patternId } = req.params;

    const query = `
      SELECT 
        pattern_id,
        pattern_type,
        start_date,
        start_time,
        end_date,
        end_time,
        ROUND(btc_start_price, 2) as btc_start_price,
        ROUND(btc_end_price, 2) as btc_end_price,
        ROUND(btc_change_pct, 2) as btc_change_pct,
        ROUND(btc_high_price, 2) as btc_high_price,
        ROUND(btc_low_price, 2) as btc_low_price,
        pattern_metrics,
        detected_at
      FROM btc_patterns
      WHERE pattern_id = $1
    `;

    const results = await executeQuery(query, [patternId]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pattern not found'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    console.error('Error in getPatternDetails:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// GET /api/patterns/types
// Returns list of available pattern types
export async function getPatternTypes(req, res) {
  try {
    const query = `
      SELECT DISTINCT pattern_type
      FROM btc_patterns
      ORDER BY pattern_type
    `;

    const results = await executeQuery(query);

    res.json({
      success: true,
      data: results.map(r => r.pattern_type)
    });
  } catch (error) {
    console.error('Error in getPatternTypes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// GET /api/patterns/date-range
// Returns the date range of available patterns
export async function getPatternDateRange(req, res) {
  try {
    const query = `
      SELECT 
        MIN(start_date) as first_date,
        MAX(start_date) as last_date
      FROM btc_patterns
    `;

    const results = await executeQuery(query);

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    console.error('Error in getPatternDateRange:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  getPatternSummary,
  getPatternInstances,
  getOverreactions,
  getPatternDetails,
  getPatternTypes,
  getPatternDateRange
};