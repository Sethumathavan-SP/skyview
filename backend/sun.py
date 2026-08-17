"""
Sun position utilities using astral library.
"""
from datetime import datetime
from typing import Dict

from astral import Observer
from astral.sun import azimuth, elevation


def get_sun_position(lat: float, lon: float, timestamp_utc: datetime) -> Dict[str, float]:
    """
    Get sun azimuth and elevation for a given location and UTC timestamp.

    Args:
        lat: Latitude in degrees
        lon: Longitude in degrees
        timestamp_utc: Timezone-aware or naive UTC datetime

    Returns:
        Dict with "azimuth" (degrees, 0-360) and "elevation" (degrees, -90 to 90)
    """
    # Astral's Observer expects latitude, longitude, and optionally elevation (meters)
    observer = Observer(latitude=lat, longitude=lon, elevation=0)

    # astral.sun.azimuth and elevation expect a timezone-aware datetime
    # If timestamp_utc is naive, assume it's UTC
    if timestamp_utc.tzinfo is None:
        from datetime import timezone
        timestamp_utc = timestamp_utc.replace(tzinfo=timezone.utc)

    sun_azimuth = azimuth(observer, timestamp_utc)
    sun_elevation = elevation(observer, timestamp_utc)

    return {
        "azimuth": sun_azimuth,
        "elevation": sun_elevation
    }