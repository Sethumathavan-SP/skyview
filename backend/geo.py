"""
Geospatial utilities using geopy.
"""
from math import radians, degrees, sin, cos, sqrt, atan2, asin
from typing import List, Tuple

from geopy.distance import geodesic
from geopy.point import Point


def get_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the initial compass bearing in degrees (0-360) from point 1 to point 2.
    Uses the standard spherical trigonometry formula.
    """
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lon_rad = radians(lon2 - lon1)

    y = sin(delta_lon_rad) * cos(lat2_rad)
    x = cos(lat1_rad) * sin(lat2_rad) - sin(lat1_rad) * cos(lat2_rad) * cos(delta_lon_rad)

    bearing_rad = atan2(y, x)
    bearing_deg = degrees(bearing_rad)
    return (bearing_deg + 360) % 360


def _slerp(lat1: float, lon1: float, lat2: float, lon2: float, fraction: float) -> Tuple[float, float]:
    """
    Spherical linear interpolation (slerp) between two points on a sphere.
    fraction=0 returns point 1, fraction=1 returns point 2.
    """
    lat1_rad = radians(lat1)
    lon1_rad = radians(lon1)
    lat2_rad = radians(lat2)
    lon2_rad = radians(lon2)

    # Angular distance between points
    cos_delta = sin(lat1_rad) * sin(lat2_rad) + cos(lat1_rad) * cos(lat2_rad) * cos(lon2_rad - lon1_rad)
    # Clamp to avoid numerical errors
    cos_delta = max(-1.0, min(1.0, cos_delta))
    delta = acos(cos_delta)

    if delta < 1e-10:
        return lat1, lon1

    a = sin((1 - fraction) * delta) / sin(delta)
    b = sin(fraction * delta) / sin(delta)

    x = a * cos(lat1_rad) * cos(lon1_rad) + b * cos(lat2_rad) * cos(lon2_rad)
    y = a * cos(lat1_rad) * sin(lon1_rad) + b * cos(lat2_rad) * sin(lon2_rad)
    z = a * sin(lat1_rad) + b * sin(lat2_rad)

    lat_interp = degrees(atan2(z, sqrt(x * x + y * y)))
    lon_interp = degrees(atan2(y, x))

    return lat_interp, lon_interp


from math import acos


def get_great_circle_path(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    num_points: int = 20
) -> List[Tuple[float, float]]:
    """
    Returns evenly spaced waypoints along the great-circle route between
    origin and destination, using spherical linear interpolation (slerp).

    Returns list of (lat, lon) tuples including both endpoints.
    """
    path = []
    for i in range(num_points):
        fraction = i / (num_points - 1) if num_points > 1 else 0
        lat, lon = _slerp(origin_lat, origin_lon, dest_lat, dest_lon, fraction)
        path.append((lat, lon))
    return path