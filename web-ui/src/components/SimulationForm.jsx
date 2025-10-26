import React, { useState } from 'react'
import './SimulationForm.css'

const SYMBOLS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE']
const METHODS = ['EQUAL_MEAN', 'WEIGHTED_MEDIAN', 'VOL_WEIGHTED', 'WINSORIZED', 'VWAP_RATIO']
const SESSIONS = ['ALL', 'RTH', 'AH']

function SimulationForm({ onSubmit, loading }) {
  const [params, setParams] = useState({
    symbol: 'RIOT',
    startDate: '2025-09-15',
    endDate: '2025-09-15',
    sessionMode: 'SINGLE',
    method: 'EQUAL_MEAN',
    buyPct: 0.5,
    sellPct: 1.1,
    session: 'ALL',
    rthMethod: 'EQUAL_MEAN',
    rthBuyPct: 0.5,
    rthSellPct: 1.1,
    ahMethod: 'EQUAL_MEAN',
    ahBuyPct: 0.5,
    ahSellPct: 1.1,
    initialCapital: 10000,
    allowShorts: false,
    conservativePricing: true,
    slippage: 0.1
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? checked 
        : (name === 'buyPct' || name === 'sellPct' || name === 'initialCapital' 
          ? parseFloat(value) 
          : value)
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(params)
  }

  return (
    <div className="simulation-form-container">
      <h2>📊 Run Simulation</h2>
      <form onSubmit={handleSubmit} className="simulation-form">
        <div className="form-row">
          <div className="form-group">
            <label>Symbol</label>
            <select name="symbol" value={params.symbol} onChange={handleChange}>
              {SYMBOLS.map(sym => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Session Mode</label>
            <select name="sessionMode" value={params.sessionMode} onChange={handleChange}>
              <option value="SINGLE">Single Session</option>
              <option value="ALL">All Hours (RTH + AH)</option>
            </select>
          </div>
        </div>

        {params.sessionMode === 'SINGLE' && (
          <div className="form-row">
            <div className="form-group">
              <label>Session</label>
              <select name="session" value={params.session} onChange={handleChange}>
                {SESSIONS.map(session => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Method</label>
              <select name="method" value={params.method} onChange={handleChange}>
                {METHODS.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Buy Threshold (%)</label>
              <input 
                type="number" 
                name="buyPct" 
                value={params.buyPct} 
                onChange={handleChange}
                step="0.1"
                min="0"
                max="10"
              />
            </div>

            <div className="form-group">
              <label>Sell Threshold (%)</label>
              <input 
                type="number" 
                name="sellPct" 
                value={params.sellPct} 
                onChange={handleChange}
                step="0.1"
                min="0"
                max="10"
              />
            </div>
          </div>
        )}

        {params.sessionMode === 'ALL' && (
          <>
            <div className="session-section">
              <h3>🌅 RTH Settings (9:30 AM - 4:00 PM)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Method</label>
                  <select name="rthMethod" value={params.rthMethod} onChange={handleChange}>
                    {METHODS.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Buy Threshold (%)</label>
                  <input 
                    type="number" 
                    name="rthBuyPct" 
                    value={params.rthBuyPct} 
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="10"
                  />
                </div>

                <div className="form-group">
                  <label>Sell Threshold (%)</label>
                  <input 
                    type="number" 
                    name="rthSellPct" 
                    value={params.rthSellPct} 
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="10"
                  />
                </div>
              </div>
            </div>

            <div className="session-section">
              <h3>🌙 AH Settings (4:00 PM - 8:00 PM)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Method</label>
                  <select name="ahMethod" value={params.ahMethod} onChange={handleChange}>
                    {METHODS.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Buy Threshold (%)</label>
                  <input 
                    type="number" 
                    name="ahBuyPct" 
                    value={params.ahBuyPct} 
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="10"
                  />
                </div>

                <div className="form-group">
                  <label>Sell Threshold (%)</label>
                  <input 
                    type="number" 
                    name="ahSellPct" 
                    value={params.ahSellPct} 
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="10"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Start Date</label>
            <input 
              type="date" 
              name="startDate" 
              value={params.startDate} 
              onChange={handleChange}
              min="2023-09-01"
              max="2025-10-23"
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input 
              type="date" 
              name="endDate" 
              value={params.endDate} 
              onChange={handleChange}
              min="2023-09-01"
              max="2025-10-23"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Initial Capital ($)</label>
            <input 
              type="number" 
              name="initialCapital" 
              value={params.initialCapital} 
              onChange={handleChange}
              step="1000"
              min="1000"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                name="allowShorts" 
                checked={params.allowShorts} 
                onChange={handleChange}
              />
              <span>Allow Short Positions</span>
            </label>
            <small className="help-text">
              When disabled, only LONG positions are allowed (matches current system)
            </small>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                name="conservativePricing" 
                checked={params.conservativePricing} 
                onChange={handleChange}
              />
              <span>Conservative Pricing</span>
            </label>
            <small className="help-text">
              Round up buys, round down sells (realistic execution)
            </small>
            {params.conservativePricing && (
              <div className="slippage-input">
                <label>Slippage (%)</label>
                <input 
                  type="number" 
                  name="slippage" 
                  value={params.slippage} 
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  max="5"
                />
                <small className="help-text">
                  Simulates execution worse than trigger (0.1% = normal, 0.5% = low liquidity)
                </small>
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? '⏳ Running...' : '🚀 Run Simulation'}
        </button>
      </form>
    </div>
  )
}

export default SimulationForm