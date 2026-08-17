import { useState, useEffect, useRef, useCallback } from 'react'

function FlightForm({ onSubmit, loading }) {
  const [formData, setFormData] = useState({
    departure_date: '',
    flight_number: '',
    from_iata: '',
    from_name: '',
    from_lat: null,
    from_lon: null,
    to_iata: '',
    to_name: '',
    to_lat: null,
    to_lon: null,
    departure_time: ''
  })

  const [errors, setErrors] = useState({})
  const [fromSuggestions, setFromSuggestions] = useState([])
  const [toSuggestions, setToSuggestions] = useState([])
  const [showFromDropdown, setShowFromDropdown] = useState(false)
  const [showToDropdown, setShowToDropdown] = useState(false)
  const [fromFocused, setFromFocused] = useState(false)
  const [toFocused, setToFocused] = useState(false)
  const fromInputRef = useRef(null)
  const toInputRef = useRef(null)
  const debounceTimeoutRef = useRef(null)

  // Initialize departure_date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setFormData(prev => ({ ...prev, departure_date: today }))
  }, [])

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  const validate = () => {
    const newErrors = {}
    const date = formData.departure_date

    if (!date) {
      newErrors.departure_date = 'Required'
    }

    if (isToday(date)) {
      // Today = flight number mode
      if (!formData.flight_number) newErrors.flight_number = 'Required'
      else if (!/^[A-Z0-9]{2,6}$/i.test(formData.flight_number)) newErrors.flight_number = 'Invalid format (e.g., UA2369)'
    } else {
      // Future date = airport search mode
      if (!formData.from_iata || !formData.from_lat) {
        newErrors.from = 'Select a valid airport from suggestions'
      }
      if (!formData.to_iata || !formData.to_lat) {
        newErrors.to = 'Select a valid airport from suggestions'
      }
      if (formData.from_iata && formData.to_iata && formData.from_iata === formData.to_iata) {
        newErrors.to = 'Origin and destination cannot be the same'
      }
      if (!formData.departure_time) newErrors.departure_time = 'Required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const date = formData.departure_date

    if (isToday(date)) {
      onSubmit({ flight_number: formData.flight_number.toUpperCase() })
    } else {
      const isoString = `${date}T${formData.departure_time}:00Z`
      onSubmit({
        origin_lat: formData.from_lat,
        origin_lon: formData.from_lon,
        dest_lat: formData.to_lat,
        dest_lon: formData.to_lon,
        departure_time_utc: isoString
      })
    }
  }

  // Debounced airport search
  const searchAirports = useCallback(async (query, setter) => {
    if (!query || query.length < 2) {
      setter([])
      return
    }

    try {
      const response = await fetch(`/airports/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setter(data)
      }
    } catch (err) {
      console.error('Airport search error:', err)
      setter([])
    }
  }, [])

  const handleFromInput = (e) => {
    const value = e.target.value
    setFormData(prev => ({ ...prev, from_name: value, from_iata: '', from_lat: null, from_lon: null }))
    clearTimeout(debounceTimeoutRef.current)
    debounceTimeoutRef.current = setTimeout(() => {
      searchAirports(value, setFromSuggestions)
    }, 300)
    if (errors.from) {
      setErrors(prev => ({ ...prev, from: null }))
    }
  }

  const handleToInput = (e) => {
    const value = e.target.value
    setFormData(prev => ({ ...prev, to_name: value, to_iata: '', to_lat: null, to_lon: null }))
    clearTimeout(debounceTimeoutRef.current)
    debounceTimeoutRef.current = setTimeout(() => {
      searchAirports(value, setToSuggestions)
    }, 300)
    if (errors.to) {
      setErrors(prev => ({ ...prev, to: null }))
    }
  }

  const selectFromSuggestion = (airport) => {
    setFormData(prev => ({
      ...prev,
      from_iata: airport.iata,
      from_name: airport.name,
      from_lat: airport.lat,
      from_lon: airport.lon
    }))
    setFromSuggestions([])
    setShowFromDropdown(false)
    if (fromInputRef.current) fromInputRef.current.blur()
  }

  const selectToSuggestion = (airport) => {
    setFormData(prev => ({
      ...prev,
      to_iata: airport.iata,
      to_name: airport.name,
      to_lat: airport.lat,
      to_lon: airport.lon
    }))
    setToSuggestions([])
    setShowToDropdown(false)
    if (toInputRef.current) toInputRef.current.blur()
  }

  const formatSuggestion = (airport) => {
    return `${airport.iata} — ${airport.name} (${airport.city}, ${airport.country})`
  }

  const today = new Date().toISOString().split('T')[0]
  const isTodayMode = isToday(formData.departure_date)

  return (
    <form className="flight-form" onSubmit={handleSubmit}>
      <h2>Flight Details</h2>

      {/* Date field - always shown at top */}
      <div className="form-group">
        <label htmlFor="departure_date">Departure Date (UTC)</label>
        <input
          type="date"
          id="departure_date"
          name="departure_date"
          value={formData.departure_date}
          onChange={handleChange}
          disabled={loading}
          min={today}
          onBlur={() => {
            // Clear suggestions when date changes
            setFromSuggestions([])
            setToSuggestions([])
          }}
          aria-invalid={!!errors.departure_date}
          aria-describedby={errors.departure_date ? 'departure_date_error' : undefined}
        />
        {errors.departure_date && <span id="departure_date_error" className="error-text">{errors.departure_date}</span>}
      </div>

      {isTodayMode ? (
        // TODAY MODE: Flight Number input
        <div className="form-group">
          <label htmlFor="flight_number">Flight Number (IATA)</label>
          <input
            type="text"
            id="flight_number"
            name="flight_number"
            placeholder="e.g., UA2369"
            value={formData.flight_number}
            onChange={handleChange}
            disabled={loading}
            aria-invalid={!!errors.flight_number}
            aria-describedby={errors.flight_number ? 'flight_number_error' : undefined}
            style={{ textTransform: 'uppercase' }}
          />
          {errors.flight_number && <span id="flight_number_error" className="error-text">{errors.flight_number}</span>}
          <p className="form-hint">AviationStack free tier: current/real-time flights only</p>
        </div>
      ) : (
        // FUTURE DATE MODE: From/To autocomplete + Time
        <>
          <div className="form-group">
            <label htmlFor="from_airport">From</label>
            <div className="autocomplete-wrapper" ref={fromInputRef}>
              <input
                type="text"
                id="from_airport"
                name="from_airport"
                placeholder="Type airport name, city, or code (e.g., JFK, New York)"
                value={formData.from_name}
                onChange={handleFromInput}
                onFocus={() => { setFromFocused(true); setShowFromDropdown(true); }}
                onBlur={() => { setFromFocused(false); setTimeout(() => setShowFromDropdown(false), 200); }}
                disabled={loading}
                aria-invalid={!!errors.from}
                aria-describedby={errors.from ? 'from_error' : undefined}
                autoComplete="off"
              />
              {errors.from && <span id="from_error" className="error-text">{errors.from}</span>}
              {showFromDropdown && fromSuggestions.length > 0 && (
                <ul className="autocomplete-dropdown" role="listbox">
                  {fromSuggestions.map((airport, idx) => (
                    <li
                      key={airport.iata}
                      role="option"
                      onClick={() => selectFromSuggestion(airport)}
                      onMouseEnter={() => setShowFromDropdown(true)}
                    >
                      {formatSuggestion(airport)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="to_airport">To</label>
            <div className="autocomplete-wrapper" ref={toInputRef}>
              <input
                type="text"
                id="to_airport"
                name="to_airport"
                placeholder="Type airport name, city, or code (e.g., LAX, Los Angeles)"
                value={formData.to_name}
                onChange={handleToInput}
                onFocus={() => { setToFocused(true); setShowToDropdown(true); }}
                onBlur={() => { setToFocused(false); setTimeout(() => setShowToDropdown(false), 200); }}
                disabled={loading}
                aria-invalid={!!errors.to}
                aria-describedby={errors.to ? 'to_error' : undefined}
                autoComplete="off"
              />
              {errors.to && <span id="to_error" className="error-text">{errors.to}</span>}
              {showToDropdown && toSuggestions.length > 0 && (
                <ul className="autocomplete-dropdown" role="listbox">
                  {toSuggestions.map((airport, idx) => (
                    <li
                      key={airport.iata}
                      role="option"
                      onClick={() => selectToSuggestion(airport)}
                      onMouseEnter={() => setShowToDropdown(true)}
                    >
                      {formatSuggestion(airport)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="departure_time">Departure Time (UTC)</label>
            <input
              type="time"
              id="departure_time"
              name="departure_time"
              value={formData.departure_time}
              onChange={handleChange}
              disabled={loading}
              aria-invalid={!!errors.departure_time}
              aria-describedby={errors.departure_time ? 'departure_time_error' : undefined}
            />
            {errors.departure_time && <span id="departure_time_error" className="error-text">{errors.departure_time}</span>}
          </div>
        </>
      )}

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? 'Analyzing...' : 'Get Recommendation'}
      </button>
    </form>
  )
}

export default FlightForm