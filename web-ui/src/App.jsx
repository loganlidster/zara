import React, { useState } from 'react'
import SimulationForm from './components/SimulationForm'
import ResultsDisplay from './components/ResultsDisplay'
import BatchGridSearch from './pages/BatchGridSearch/BatchGridSearch'
import BatchDaily from './pages/BatchDaily/BatchDaily'
import FastDaily from './pages/FastDaily/FastDaily'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('single-sim')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleRunSimulation = async (params) => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error('Simulation failed')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🥷 TRADIAC</h1>
        <p>Trading Analysis & Backtesting Platform</p>
        
        <nav className="app-nav">
          <button 
            className={activeTab === 'single-sim' ? 'active' : ''}
            onClick={() => setActiveTab('single-sim')}
          >
            📊 Single Simulation
          </button>
          <button 
            className={activeTab === 'batch-search' ? 'active' : ''}
            onClick={() => setActiveTab('batch-search')}
          >
            🔥 Batch Grid Search
          </button>
          <button 
            className={activeTab === 'batch-daily' ? 'active' : ''}
            onClick={() => setActiveTab('batch-daily')}
          >
            📅 Batch Daily
          </button>
          <button 
            className={activeTab === 'fast-daily' ? 'active' : ''}
            onClick={() => setActiveTab('fast-daily')}
          >
            ⚡ Fast Daily
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'single-sim' && (
          <>
            <SimulationForm 
              onSubmit={handleRunSimulation}
              loading={loading}
            />

            {error && (
              <div className="error-message">
                <p>❌ {error}</p>
              </div>
            )}

            {results && <ResultsDisplay results={results} />}
          </>
        )}

        {activeTab === 'batch-search' && (
          <BatchGridSearch />
        )}

        {activeTab === 'batch-daily' && (
          <BatchDaily />
        )}

        {activeTab === 'fast-daily' && (
          <FastDaily />
        )}
      </main>

      <footer className="app-footer">
        <p>Built with ❤️ by NinjaTech AI</p>
      </footer>
    </div>
  )
}

export default App