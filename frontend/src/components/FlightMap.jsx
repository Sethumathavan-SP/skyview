import { useState, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './FlightMap.css'

// Fix for react-leaflet v4 default marker icons not displaying
// Standard workaround: explicitly define default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom plane marker icon
const planeIcon = new L.DivIcon({
  className: 'plane-marker',
  html: '<div class="plane-icon">✈</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

// Custom origin marker icon
const originIcon = new L.DivIcon({
  className: 'origin-marker',
  html: "<div class='origin-icon'>🛫</div>",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

// Custom destination marker icon
const destIcon = new L.DivIcon({
  className: 'dest-marker',
  html: "<div class='dest-icon'>🛬</div>",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

// Custom component to fit map bounds to waypoints on mount/waypoints change
function FitBounds({ waypoints }) {
  const map = useMap()
  useEffect(() => {
    if (waypoints.length > 0) {
      const bounds = waypoints.map(wp => [wp.lat, wp.lon])
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [waypoints, map])
  return null
}

function FlightMap({ data }) {
  const [sliderIndex, setSliderIndex] = useState(0)
  const waypoints = data?.waypoints || []
  const maxIndex = waypoints.length - 1

  const currentWp = waypoints[sliderIndex]
  const pathCoords = waypoints.map(wp => [wp.lat, wp.lon])

  const handleSliderChange = (e) => {
    setSliderIndex(parseInt(e.target.value, 10))
  }

  if (!data || waypoints.length === 0) {
    return <div className="flight-map-empty">No flight data to display</div>
  }

  return (
    <div className="flight-map-container">
      <MapContainer
        className="flight-map"
        center={waypoints[0] ? [waypoints[0].lat, waypoints[0].lon] : [0, 0]}
        zoom={4}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds waypoints={waypoints} />

        {/* Flight path */}
        <Polyline
          positions={pathCoords}
          color="#3b82f6"
          weight={3}
          opacity={0.7}
          lineCap="round"
          lineJoin="round"
        />

        {/* Origin marker */}
        <Marker position={[waypoints[0].lat, waypoints[0].lon]} icon={originIcon} />

        {/* Destination marker */}
        <Marker position={[waypoints[maxIndex].lat, waypoints[maxIndex].lon]} icon={destIcon} />

        {/* Animated plane marker at current slider position */}
        {currentWp && (
          <Marker position={[currentWp.lat, currentWp.lon]} icon={planeIcon} />
        )}
      </MapContainer>

      {/* Slider and info panel */}
      <div className="flight-map-controls">
        <div className="slider-wrapper">
          <label htmlFor="flight-scrubber" className="slider-label">
            Scrub through flight: {sliderIndex + 1} / {waypoints.length}
          </label>
          <input
            type="range"
            id="flight-scrubber"
            className="flight-scrubber"
            min={0}
            max={maxIndex}
            value={sliderIndex}
            onChange={handleSliderChange}
            aria-label="Flight progress"
          />
        </div>

        {currentWp && (
          <div className="waypoint-info">
            <strong>Sun at this waypoint:</strong>
            <span>Azimuth: {currentWp.sun_azimuth.toFixed(1)}°</span>
            <span>Elevation: {currentWp.sun_elevation.toFixed(1)}°</span>
            <span className={`side-badge ${currentWp.side_of_aircraft}`}>
              Side: {currentWp.side_of_aircraft === 'none' ? 'Neither' : currentWp.side_of_aircraft}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default FlightMap