from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

from .recommender import recommend_seat
from . import flight_lookup
from . import airports

app = FastAPI()

# CORS middleware allowing all origins (for local development only)
# Fixed: allow_credentials=False since this app does not use cookies/auth
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RecommendRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    departure_time_utc: str  # ISO 8601 string


class FlightRecommendRequest(BaseModel):
    """Request model for flight number-based recommendation.

    Note: AviationStack free tier only supports current/real-time flights,
    not historical or future date lookups. The flight_number must be
    an IATA flight code (e.g., 'UA2369') for a currently scheduled flight.
    """
    flight_number: str


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/airports/search")
async def search_airports(q: str = ""):
    """
    Search airports by name, city, or IATA code.

    Args:
        q: Search query (minimum 2 characters)

    Returns:
        List of airport objects with iata, name, city, country, lat, lon
    """
    if not q or len(q.strip()) < 2:
        return []

    results = airports.search_airports(q, limit=5)
    return results


@app.post("/recommend")
async def recommend(request: RecommendRequest):
    # Parse the ISO 8601 timestamp
    departure_time = datetime.fromisoformat(request.departure_time_utc.replace("Z", "+00:00"))

    result = recommend_seat(
        origin_lat=request.origin_lat,
        origin_lon=request.origin_lon,
        dest_lat=request.dest_lat,
        dest_lon=request.dest_lon,
        departure_time_utc=departure_time
    )
    return result


@app.post("/flight-recommend")
async def flight_recommend(request: FlightRecommendRequest):
    """
    Get seat recommendation by flight number.

    AviationStack free tier only supports current/real-time flights,
    not historical or future date lookups.
    """
    try:
        flight_info = flight_lookup.get_flight_info(request.flight_number)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Flight not found or API error: {e}")

    # Parse the ISO 8601 timestamp from the flight info
    departure_time = datetime.fromisoformat(flight_info['departure_time_utc'].replace("Z", "+00:00"))

    result = recommend_seat(
        origin_lat=flight_info['origin_lat'],
        origin_lon=flight_info['origin_lon'],
        dest_lat=flight_info['dest_lat'],
        dest_lon=flight_info['dest_lon'],
        departure_time_utc=departure_time
    )

    # Add flight info to response for context
    result['flight_info'] = {
        'flight_number': request.flight_number,
        'origin_iata': flight_info['origin_iata'],
        'dest_iata': flight_info['dest_iata'],
        'departure_time_utc': flight_info['departure_time_utc']
    }

    return result