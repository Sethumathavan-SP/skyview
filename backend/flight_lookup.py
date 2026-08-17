import os
import requests
from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

# Import the airports module
from . import airports

AVIATIONSTACK_API_KEY = os.getenv('AVIATIONSTACK_API_KEY')
AVIATIONSTACK_BASE_URL = 'http://api.aviationstack.com/v1/flights'


def get_flight_info(flight_number: str) -> dict:
    """
    Fetch real-time flight information from AviationStack API.

    Args:
        flight_number: IATA flight number (e.g., 'UA123', 'DL456')

    Returns:
        dict with: origin_iata, dest_iata, origin_lat, origin_lon,
        dest_lat, dest_lon, departure_time_utc

    Raises:
        ValueError: If API key not configured
        Exception: If API returns error or no results found
    """
    if not AVIATIONSTACK_API_KEY:
        raise ValueError('AVIATIONSTACK_API_KEY not configured in environment')

    params = {
        'access_key': AVIATIONSTACK_API_KEY,
        'flight_iata': flight_number
    }

    response = requests.get(AVIATIONSTACK_BASE_URL, params=params, timeout=30)

    if response.status_code != 200:
        raise Exception(f'AviationStack API error: {response.status_code} - {response.text}')

    data = response.json()

    # Check for API-level errors
    if 'error' in data:
        raise Exception(f'AviationStack API error: {data["error"].get("message", "Unknown error")}')

    flights = data.get('data', [])

    if not flights:
        raise Exception(f'No flight found for flight number: {flight_number}')

    # Take the first matching flight
    flight = flights[0]

    # Parse and return relevant fields
    return _parse_flight_data(flight)


def _parse_flight_data(flight: dict) -> dict:
    """Parse the AviationStack flight response into our standard format."""

    # Print raw response for debugging
    import json
    print('=== Raw AviationStack Response ===')
    print(json.dumps(flight, indent=2))

    # Extract departure and arrival info
    departure = flight.get('departure', {})
    arrival = flight.get('arrival', {})

    origin_iata = departure.get('iata')
    dest_iata = arrival.get('iata')

    # Check if coordinates are provided by AviationStack
    origin_lat = departure.get('lat')
    origin_lon = departure.get('lon')
    dest_lat = arrival.get('lat')
    dest_lon = arrival.get('lon')

    # Scheduled departure time
    scheduled_utc = departure.get('scheduled')

    # If coordinates not in API response, look them up from our airport database
    coords_from_api = all(v is not None for v in [origin_lat, origin_lon, dest_lat, dest_lon])

    if not coords_from_api:
        print('Coordinates not in AviationStack response, looking up from airport database...')
        try:
            if origin_iata:
                origin_lat, origin_lon = airports.get_airport_coords(origin_iata)
            if dest_iata:
                dest_lat, dest_lon = airports.get_airport_coords(dest_iata)
            print(f'Resolved: {origin_iata} -> ({origin_lat}, {origin_lon})')
            print(f'Resolved: {dest_iata} -> ({dest_lat}, {dest_lon})')
        except KeyError as e:
            raise Exception(f'Could not resolve airport coordinates: {e}')

    print(f'\n=== Parsed Fields ===')
    print(f'origin_iata: {origin_iata}')
    print(f'dest_iata: {dest_iata}')
    print(f'origin_lat: {origin_lat}')
    print(f'origin_lon: {origin_lon}')
    print(f'dest_lat: {dest_lat}')
    print(f'dest_lon: {dest_lon}')
    print(f'departure_time_utc: {scheduled_utc}')

    return {
        'origin_iata': origin_iata,
        'dest_iata': dest_iata,
        'origin_lat': origin_lat,
        'origin_lon': origin_lon,
        'dest_lat': dest_lat,
        'dest_lon': dest_lon,
        'departure_time_utc': scheduled_utc,
        'coordinates_present': True  # Now always True since we resolve from database
    }


if __name__ == '__main__':
    # Test with a known flight number
    test_flight = 'UA2369'  # Example: United Airlines flight
    try:
        result = get_flight_info(test_flight)
        print(f'\n[SUCCESS] {result}')
    except Exception as e:
        print(f'\n[ERROR] {e}')