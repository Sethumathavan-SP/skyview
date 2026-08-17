import './RecommendationCard.css'

function RecommendationCard({ data }) {
  const { recommended_side, best_row_zone, confidence, explanation, waypoints, flight_info } = data

  // Sun icon SVG
  const sunIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )

  // Aircraft icon SVG (simple top-down view)
  const aircraftIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M7 20v-6" />
      <path d="M17 20v-6" />
    </svg>
  )

  // Left/right indicator with sun position
  const SideIndicator = () => (
    <div className={`side-indicator ${recommended_side}`}>
      <div className="aircraft-wrapper">
        {aircraftIcon}
        <div className={`sun-position ${recommended_side}`}>{sunIcon}</div>
      </div>
      <div className="side-label">
        {recommended_side === 'left' ? '← Best View: Left Side' : 'Best View: Right Side →'}
      </div>
    </div>
  )

  return (
    <div className="recommendation-card">
      <div className="recommendation-header">
        <div className={`side-badge ${recommended_side}`}>
          {recommended_side === 'left' ? 'L' : 'R'}
        </div>
        <div className="recommendation-title">
          <h2>Recommended Seat Side</h2>
          <p>{recommended_side === 'left' ? 'Choose a window seat on the LEFT side' : 'Choose a window seat on the RIGHT side'}</p>
          <span className={`confidence-badge ${confidence}`}>{confidence} confidence</span>
        </div>
      </div>

      <div className="visual-indicator">
        <SideIndicator />
      </div>

      <div className="explanation">
        <strong>Why?</strong>
        <p>{explanation}</p>
      </div>

      <div className="zone-info">
        <div className="zone-item">
          <span className="zone-label">Best Row Zone</span>
          <span className="zone-value">{best_row_zone.charAt(0).toUpperCase() + best_row_zone.slice(1)}</span>
        </div>
        <div className="zone-item">
          <span className="zone-label">Waypoints Analyzed</span>
          <span className="zone-value">{waypoints.length}</span>
        </div>
        <div className="zone-item">
          <span className="zone-label">Sun Elevation Range</span>
          <span className="zone-value">
            {Math.min(...waypoints.map(w => w.sun_elevation)).toFixed(1)}° to {Math.max(...waypoints.map(w => w.sun_elevation)).toFixed(1)}°
          </span>
        </div>
      </div>

      {flight_info && (
        <div className="flight-info">
          <h3>Flight Details</h3>
          <div className="flight-info-grid">
            <div className="flight-info-item">
              <span className="flight-info-label">Flight</span>
              <span className="flight-info-value">{flight_info.flight_number}</span>
            </div>
            <div className="flight-info-item">
              <span className="flight-info-label">Route</span>
              <span className="flight-info-value">{flight_info.origin_iata} → {flight_info.dest_iata}</span>
            </div>
            <div className="flight-info-item">
              <span className="flight-info-label">Departure (UTC)</span>
              <span className="flight-info-value">{flight_info.departure_time_utc}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecommendationCard