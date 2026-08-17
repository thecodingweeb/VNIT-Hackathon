"""
Utility helpers — GPS, formatters, CSV parsing.
"""

import csv
import io
import math
from datetime import datetime, timezone
from typing import Optional, Tuple


def haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float,
) -> float:
    """Calculate haversine distance in kilometers between two GPS points."""
    R = 6371.0  # Earth radius in km

    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def bearing_direction(
    lat1: float, lon1: float, lat2: float, lon2: float,
) -> str:
    """Calculate compass bearing direction between two points."""
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlon = math.radians(lon2 - lon1)

    x = math.sin(dlon) * math.cos(lat2_r)
    y = (
        math.cos(lat1_r) * math.sin(lat2_r)
        - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlon)
    )
    bearing = math.degrees(math.atan2(x, y))
    bearing = (bearing + 360) % 360

    directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ]
    idx = round(bearing / 22.5) % 16
    return directions[idx]


def format_timestamp(dt: Optional[datetime] = None) -> str:
    """Format a datetime as ISO 8601 UTC string."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    return dt.isoformat()


def parse_csv_to_dicts(content: bytes) -> list[dict]:
    """Parse CSV bytes into a list of dictionaries."""
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def generate_geojson_point(lat: float, lng: float, properties: dict = None) -> dict:
    """Create a GeoJSON Point Feature."""
    return {
        "type": "Feature",
        "properties": properties or {},
        "geometry": {
            "type": "Point",
            "coordinates": [lng, lat],
        },
    }


def generate_geojson_collection(features: list[dict]) -> dict:
    """Wrap features in a GeoJSON FeatureCollection."""
    return {
        "type": "FeatureCollection",
        "features": features,
    }
