import csv
import os

# Module-level cache: IATA code -> {iata, name, city, country, lat, lon}
_AIRPORTS_CACHE = None
_AIRPORTS_LIST = None  # List of all airport dicts for searching


def _load_airports() -> dict:
    """Load airport data from OpenFlights dataset into a dict: IATA -> airport dict."""
    data_path = os.path.join(os.path.dirname(__file__), 'data', 'airports.dat')
    airports = {}
    airports_list = []

    with open(data_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 8:
                continue

            # Columns: Airport ID, Name, City, Country, IATA, ICAO, Latitude, Longitude, ...
            airport_id = row[0].strip()
            name = row[1].strip()
            city = row[2].strip()
            country = row[3].strip()
            iata = row[4].strip()
            icao = row[5].strip()
            lat_str = row[6].strip()
            lon_str = row[7].strip()

            # Skip if IATA is empty, \N, or not a 3-letter code
            if not iata or iata == '\\N' or len(iata) != 3:
                continue

            try:
                lat = float(lat_str)
                lon = float(lon_str)
            except ValueError:
                continue

            airport = {
                'iata': iata,
                'icao': icao,
                'name': name,
                'city': city,
                'country': country,
                'lat': lat,
                'lon': lon
            }
            airports[iata] = airport
            airports_list.append(airport)

    return airports, airports_list


# Load once at module import time
_AIRPORTS_CACHE, _AIRPORTS_LIST = _load_airports()


def get_airport_coords(iata_code: str) -> tuple[float, float]:
    """
    Look up airport coordinates by IATA code.

    Args:
        iata_code: 3-letter IATA airport code (e.g., 'JFK', 'LAX')

    Returns:
        Tuple of (latitude, longitude) as floats

    Raises:
        KeyError: If IATA code not found in database
    """
    if not iata_code:
        raise KeyError('IATA code is empty or None')

    code = iata_code.strip().upper()

    if code not in _AIRPORTS_CACHE:
        raise KeyError(f'Airport not found for IATA code: {code}')

    airport = _AIRPORTS_CACHE[code]
    return airport['lat'], airport['lon']


def search_airports(query: str, limit: int = 5) -> list[dict]:
    """
    Search airports by case-insensitive substring match against name, city, or IATA code.

    Args:
        query: Search query string
        limit: Maximum number of results to return (default 5)

    Returns:
        List of airport dicts with keys: iata, name, city, country, lat, lon
    """
    if not query or len(query.strip()) < 2:
        return []

    query_lower = query.strip().lower()
    matches = []

    for airport in _AIRPORTS_LIST:
        if (query_lower in airport['name'].lower() or
            query_lower in airport['city'].lower() or
            query_lower in airport['iata'].lower()):
            matches.append({
                'iata': airport['iata'],
                'name': airport['name'],
                'city': airport['city'],
                'country': airport['country'],
                'lat': airport['lat'],
                'lon': airport['lon']
            })
            if len(matches) >= limit:
                break

    return matches


def get_airport_count() -> int:
    """Return the number of airports loaded."""
    return len(_AIRPORTS_CACHE)


if __name__ == '__main__':
    # Quick test
    print(f'Loaded {get_airport_count()} airports')

    test_codes = ['JFK', 'LAX', 'IAH', 'ANC', 'XYZ']
    for code in test_codes:
        try:
            lat, lon = get_airport_coords(code)
            print(f'{code}: ({lat}, {lon})')
        except KeyError as e:
            print(f'{code}: NOT FOUND - {e}')

    print('\n--- Search tests ---')
    test_queries = ['new york', 'jfk', 'london', 'lax', 'a']
    for q in test_queries:
        results = search_airports(q, 5)
        print(f'\nQuery: "{q}" -> {len(results)} results')
        for r in results:
            print(f"  {r['iata']} — {r['name']} ({r['city']}, {r['country']})")