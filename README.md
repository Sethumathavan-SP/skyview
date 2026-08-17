# Skyview — Scenic Flight Seat Recommender

Skyview tells travelers which side of the plane (left or right) has the best sunrise or sunset views for their flight. It computes the great-circle path, samples the sun's azimuth and elevation at 20 waypoints along the route, and scores which side gets better viewing conditions.

---

## What It Does

Given a flight (by flight number for today, or by origin/destination airport for any other date), Skyview returns:

- **Recommended seat side** — `left` or `right`
- **Best row zone** — `front`, `middle`, or `rear` of the aircraft
- **Confidence** — `high`, `medium`, or `low` based on viewing quality
- **Explanation** — Plain-language reason for the recommendation
- **Interactive map** — Flight path, origin/destination markers, animated plane slider scrubbing through waypoints with live sun azimuth/elevation

---

## How It Works

1. **Great-circle path** — Computes 20 waypoints along the shortest spherical route between origin and destination using spherical linear interpolation (slerp).
2. **Timestamp interpolation** — At 850 km/h cruising speed, calculates when the flight reaches each waypoint proportionally along the total distance.
3. **Sun position** — Uses the `astral` library to get precise solar azimuth (compass bearing) and elevation (angle above horizon) at each waypoint's lat/lon/timestamp.
4. **Side scoring** — For each waypoint, determines whether the sun is to the left or right of the aircraft heading (signed angular difference). Scores each side:
   - `2.0` points if sun elevation is ideal (−2° to +6°)
   - `1.0` point if sun elevation is good (−6° to +10°)
   - `0.0` otherwise
5. **Confidence** — Based on whether *any* waypoint had ideal/good elevation on the winning side.
6. **Best row zone** — The third of the flight (front/middle/rear) containing the highest-scoring waypoint.

**Tie-breaker:** If scores are equal, defaults to `left`.

---

## Two Search Modes

| Date selected | Mode | Input | Endpoint |
|---------------|------|-------|----------|
| **Today** | Live flight lookup | IATA flight number (e.g., `UA2369`) | `POST /flight-recommend` |
| **Any future/past date** | Manual airport search | Origin & destination airport names/city/IATA (autocomplete) + departure time | `POST /recommend` |

**Why the split?** The AviationStack free tier only provides **real-time / currently scheduled** flights. It does not support historical or future-date lookups. For dates other than today, the user manually picks airports and a departure time, and Skyview computes the recommendation from great-circle geometry alone.

---

## Tech Stack

| Layer | Technology | Port |
|-------|------------|------|
| Backend | FastAPI, Python 3.13 | 8001 |
| Frontend | React 18 + Vite | 5173 (dev) |
| Map | Leaflet + react-leaflet | — |
| Sun math | `astral` | — |
| Flight data | AviationStack API | — |
| Airport DB | OpenFlights `airports.dat` (6,072 airports) | — |

### Key Backend Files

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, 4 endpoints, CORS config |
| `backend/recommender.py` | Core logic: great-circle, sun position, scoring, confidence |
| `backend/geo.py` | Great-circle path (slerp), bearing calculations |
| `backend/sun.py` | Sun azimuth/elevation via `astral` |
| `backend/flight_lookup.py` | AviationStack API call + coordinate resolution via local DB |
| `backend/airports.py` | Loads `airports.dat`, provides `get_airport_coords(iata)` and `search_airports(query, limit)` |
| `backend/data/airports.dat` | OpenFlights airport database (CSV, no header) |

### Key Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/App.jsx` | Root, routing logic (chooses endpoint based on payload) |
| `frontend/src/components/FlightForm.jsx` | Date-driven form: today = flight number; future = From/To autocomplete + time |
| `frontend/src/components/RecommendationCard.jsx` | Displays side, zone, confidence, explanation, flight info |
| `frontend/src/components/FlightMap.jsx` | Leaflet map with path, markers, animated plane, scrubber slider |
| `frontend/src/App.css` | All styling (form, card, map, autocomplete dropdown) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check → `{"status":"ok"}` |
| `GET` | `/airports/search?q=<query>` | Airport autocomplete (min 2 chars) → list of `{iata, name, city, country, lat, lon}` (max 5) |
| `POST` | `/flight-recommend` | `{ "flight_number": "UA2369" }` → full recommendation + `flight_info` |
| `POST` | `/recommend` | `{ origin_lat, origin_lon, dest_lat, dest_lon, departure_time_utc: "ISO8601" }` → full recommendation |

**Example `/recommend` request:**
```json
{
  "origin_lat": 29.9844,
  "origin_lon": -95.3414,
  "dest_lat": 61.1744,
  "dest_lon": -149.9960,
  "departure_time_utc": "2026-08-16T14:35:00Z"
}
```

**Example `/flight-recommend` response:**
```json
{
  "recommended_side": "left",
  "best_row_zone": "front",
  "confidence": "low",
  "explanation": "Sun elevation outside ideal range...",
  "waypoints": [...],
  "flight_info": {
    "flight_number": "UA2369",
    "origin_iata": "IAH",
    "dest_iata": "ANC",
    "departure_time_utc": "2026-08-16T14:35:00+00:00"
  }
}
```

---

## Run Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- AviationStack API key (free tier at aviationstack.com)

### 1. Backend
```bash
cd backend
# Create .env with your API key
echo "AVIATIONSTACK_API_KEY=your_key_here" > .env

# Install deps
pip install -r requirements.txt
# or: pip install fastapi uvicorn[standard] geopy astral python-multipart pydantic python-dotenv

# Run server on port 8001
uvicorn main:app --host 127.0.0.1 --port 8001
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# Vite dev server on http://localhost:5173 (proxies /recommend, /flight-recommend, /airports/search, /health to backend)
```

Open **http://localhost:5173** in your browser.

---

## Known Limitations

1. **AviationStack free tier** — Only returns currently scheduled/active flights. No historical or future-date lookups. This is why the UI restricts flight-number mode to **today's date only**.
2. **Tie-breaker defaults to left** — When left/right scores are exactly equal, the algorithm picks `left` (see `recommender.py:150`).
3. **Great-circle approximation** — Real flights follow ATC routes, not perfect great circles. Waypoints are illustrative.
4. **No live position** — The plane marker animates along the computed path by time-fraction, not real radar data.
5. **Sun elevation ideal range** — Heuristic: −2° to +6° is "ideal", −6° to +10° is "good". Subject to tuning.
6. **Single flight per IATA code** — If multiple flights share the same IATA number on a day, takes the first result.

---

## End-to-End Testing

Includes a Playwright test script that validates both search modes visually:

```bash
# From project root
node e2e-test.js
```

Tests:
- **Test A** — Today's date + flight number `UA2369`
- **Test B** — Future date + From "London" + To "Los Angeles" + time

Captures screenshots at each step (`screenshots/`) and verifies:
- Recommendation card appears with side + confidence
- Flight info block (for flight-number mode)
- Map loads with tiles, path, 3 markers
- Slider moves plane + updates waypoint sun data
- Zero console errors

---

## Project Structure

```
Skyview/
├── backend/
│   ├── main.py                 # FastAPI app + 4 endpoints
│   ├── recommender.py          # Core recommendation engine
│   ├── geo.py                  # Great-circle & bearing math
│   ├── sun.py                  # Sun position via astral
│   ├── flight_lookup.py        # AviationStack API + coord resolution
│   ├── airports.py             # Airport DB load + search
│   ├── data/
│   │   └── airports.dat        # OpenFlights CSV (6,072 airports)
│   ├── requirements.txt
│   └── .env                    # AVIATIONSTACK_API_KEY (not committed)
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Root + routing logic
│   │   ├── App.css             # All styles
│   │   ├── components/
│   │   │   ├── FlightForm.jsx  # Date-driven form
│   │   │   ├── RecommendationCard.jsx
│   │   │   ├── FlightMap.jsx   # Leaflet map + slider
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js          # Proxy config
├── e2e-test.js                 # Playwright E2E test
├── .gitignore
└── README.md
```

---

## License

MIT — free to use, modify, and distribute.