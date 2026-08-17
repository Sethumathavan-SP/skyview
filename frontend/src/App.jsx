import { useState } from 'react'
import FlightForm from './components/FlightForm'
import RecommendationCard from './components/RecommendationCard'
import FlightMap from './components/FlightMap'
import './App.css'

function App() {
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (formData) => {
    setLoading(true)
    setError(null)
    try {
      // Determine endpoint based on payload shape
      // flight_number present -> /flight-recommend (today mode)
      // lat/lon fields present -> /recommend (future date mode)
      const isFlightNumber = formData.flight_number !== undefined
      const endpoint = isFlightNumber ? '/flight-recommend' : '/recommend'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Request failed: ${response.status}`)
      }
      const data = await response.json()
      setRecommendation(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Skyview</h1>
        <p className="subtitle">Find the best seat for sunrise/sunset views</p>
      </header>

      <main className="main">
        <FlightForm onSubmit={handleSubmit} loading={loading} />
        {error && <div className="error">{error}</div>}
        {recommendation && <RecommendationCard data={recommendation} />}
        {recommendation && <FlightMap data={recommendation} />}
      </main>
    </div>
  )
}

export default App