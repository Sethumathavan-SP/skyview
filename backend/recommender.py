"""
Seat recommendation logic combining great-circle path and sun position.
"""
from datetime import datetime, timedelta, timezone
from math import radians, degrees, sin, cos, sqrt, atan2
from typing import List, Dict, Any

from .geo import get_great_circle_path, get_bearing
from .sun import get_sun_position


CRUISING_SPEED_KMH = 850.0
EARTH_RADIUS_KM = 6371.0


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in kilometers."""
    lat1_rad = radians(lat1)
    lon1_rad = radians(lon1)
    lat2_rad = radians(lat2)
    lon2_rad = radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def _angular_diff(angle1: float, angle2: float) -> float:
    """Return the signed angular difference from angle1 to angle2 in degrees (-180, 180]."""
    diff = (angle2 - angle1 + 180) % 360 - 180
    return diff if diff != -180 else 180


def _get_side_of_aircraft(sun_azimuth: float, heading: float) -> str:
    """
    Determine if sun is on left, right, or neither relative to aircraft heading.
    Left = sun azimuth is between heading-180 and heading (i.e., negative angular diff).
    Right = sun azimuth is between heading and heading+180 (i.e., positive angular diff).
    """
    diff = _angular_diff(heading, sun_azimuth)
    if diff < 0:
        return "left"
    elif diff > 0:
        return "right"
    else:
        return "none"


def recommend_seat(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    departure_time_utc: datetime
) -> Dict[str, Any]:
    """
    Recommend scenic seat side based on sun position along the flight path.
    """
    # Ensure departure_time_utc is timezone-aware
    if departure_time_utc.tzinfo is None:
        departure_time_utc = departure_time_utc.replace(tzinfo=timezone.utc)

    # Get waypoints along the great-circle path
    waypoints_coords = get_great_circle_path(origin_lat, origin_lon, dest_lat, dest_lon, num_points=20)

    # Calculate total flight distance and duration
    total_distance_km = _haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    total_duration_hours = total_distance_km / CRUISING_SPEED_KMH
    total_duration_seconds = total_duration_hours * 3600

    # Build waypoints with timestamps and sun data
    waypoints = []
    left_score = 0.0
    right_score = 0.0
    best_elevation = -90.0
    has_ideal_elevation = False
    has_good_elevation = False

    for i, (lat, lon) in enumerate(waypoints_coords):
        # Calculate timestamp at this waypoint (proportional to distance along path)
        if i == 0:
            timestamp = departure_time_utc
        elif i == len(waypoints_coords) - 1:
            timestamp = departure_time_utc + timedelta(seconds=total_duration_seconds)
        else:
            # Interpolate timestamp proportionally
            fraction = i / (len(waypoints_coords) - 1)
            elapsed_seconds = fraction * total_duration_seconds
            timestamp = departure_time_utc + timedelta(seconds=elapsed_seconds)

        # Get sun position
        sun_data = get_sun_position(lat, lon, timestamp)
        sun_azimuth = sun_data["azimuth"]
        sun_elevation = sun_data["elevation"]

        # Update best elevation seen
        best_elevation = max(best_elevation, sun_elevation)
        if -2 <= sun_elevation <= 6:
            has_ideal_elevation = True
        if -6 <= sun_elevation <= 10:
            has_good_elevation = True

        # Calculate aircraft heading at this waypoint (bearing to next waypoint)
        if i < len(waypoints_coords) - 1:
            next_lat, next_lon = waypoints_coords[i + 1]
            heading = get_bearing(lat, lon, next_lat, next_lon)
        else:
            # At last waypoint, use bearing from previous
            prev_lat, prev_lon = waypoints_coords[i - 1]
            heading = get_bearing(prev_lat, prev_lon, lat, lon)

        # Determine sun side relative to aircraft
        side = _get_side_of_aircraft(sun_azimuth, heading)

        # Score based on viewing quality (elevation between -6 and +10 is best)
        if -6 <= sun_elevation <= 10:
            score = 1.0
            # High quality if elevation is between -2 and +6
            if -2 <= sun_elevation <= 6:
                score = 2.0
        else:
            score = 0.0

        if side == "left":
            left_score += score
        elif side == "right":
            right_score += score

        waypoints.append({
            "lat": lat,
            "lon": lon,
            "timestamp": timestamp.isoformat(),
            "sun_azimuth": sun_azimuth,
            "sun_elevation": sun_elevation,
            "side_of_aircraft": side
        })

    # Determine recommended side
    if left_score > right_score:
        recommended_side = "left"
        confidence_score = left_score
    elif right_score > left_score:
        recommended_side = "right"
        confidence_score = right_score
    else:
        # Tie-breaker: check which side has better elevation at any point
        recommended_side = "left"  # default
        confidence_score = left_score

    # Determine confidence
    if has_ideal_elevation:
        confidence = "high"
    elif has_good_elevation:
        confidence = "medium"
    else:
        confidence = "low"

    # Determine best row zone (rough third of flight where view is best)
    # Find the waypoint with best viewing conditions
    best_idx = 0
    best_view_score = -1.0
    for i, wp in enumerate(waypoints):
        elev = wp["sun_elevation"]
        if -6 <= elev <= 10:
            view_score = 1.0
            if -2 <= elev <= 6:
                view_score = 2.0
            if view_score > best_view_score:
                best_view_score = view_score
                best_idx = i

    # Map best waypoint index to zone
    num_waypoints = len(waypoints)
    if best_idx < num_waypoints / 3:
        best_row_zone = "front"
    elif best_idx < 2 * num_waypoints / 3:
        best_row_zone = "middle"
    else:
        best_row_zone = "rear"

    # Generate explanation
    if confidence == "high":
        explanation = (
            f"Sun will be at ideal elevation (-2° to +6°) on the {recommended_side} side "
            f"during the {best_row_zone} portion of the flight. Excellent viewing conditions."
        )
    elif confidence == "medium":
        explanation = (
            f"Sun will be at good elevation (-6° to +10°) on the {recommended_side} side "
            f"during the {best_row_zone} portion of the flight. Good viewing conditions."
        )
    else:
        explanation = (
            f"Sun elevation outside ideal range. {recommended_side.capitalize()} side "
            f"offers the best available view during the {best_row_zone} portion of the flight."
        )

    return {
        "recommended_side": recommended_side,
        "best_row_zone": best_row_zone,
        "confidence": confidence,
        "explanation": explanation,
        "waypoints": waypoints
    }