"""Weather and place lookup via Open-Meteo (free, no API key)."""

import json
import logging
from decimal import Decimal
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from django.core.cache import cache

logger = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
CACHE_SECONDS = 15 * 60
TIMEOUT_SECONDS = 6

# WMO weather interpretation codes used by Open-Meteo.
WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with hail",
}


class WeatherUnavailable(Exception):
    pass


def describe(code):
    return WEATHER_CODES.get(code, "Unknown")


def _get_json(url, params):
    try:
        with urlopen(f"{url}?{urlencode(params)}", timeout=TIMEOUT_SECONDS) as response:
            return json.load(response)
    except (URLError, TimeoutError, ValueError) as error:
        logger.warning("Open-Meteo request failed: %s", error)
        raise WeatherUnavailable("The weather service couldn't be reached.") from error


def get_forecast(latitude, longitude, time_zone, units):
    """Current conditions plus a 5-day forecast, cached for 15 minutes."""
    cache_key = f"weather:{latitude}:{longitude}:{time_zone}:{units}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    imperial = units == "imperial"
    data = _get_json(
        FORECAST_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "timezone": time_zone,
            "forecast_days": 5,
            "temperature_unit": "fahrenheit" if imperial else "celsius",
            "wind_speed_unit": "mph" if imperial else "kmh",
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        },
    )

    try:
        current = data["current"]
        daily = data["daily"]
        forecast = {
            "temperature_unit": "°F" if imperial else "°C",
            "wind_unit": "mph" if imperial else "km/h",
            "current": {
                "temperature": round(current["temperature_2m"]),
                "feels_like": round(current["apparent_temperature"]),
                "humidity": current["relative_humidity_2m"],
                "wind_speed": round(current["wind_speed_10m"]),
                "code": current["weather_code"],
                "description": describe(current["weather_code"]),
            },
            "daily": [
                {
                    "date": date,
                    "code": code,
                    "description": describe(code),
                    "high": round(high),
                    "low": round(low),
                    "precipitation_chance": precip,
                }
                for date, code, high, low, precip in zip(
                    daily["time"],
                    daily["weather_code"],
                    daily["temperature_2m_max"],
                    daily["temperature_2m_min"],
                    daily["precipitation_probability_max"],
                )
            ],
        }
    except (KeyError, TypeError) as error:
        logger.warning("Unexpected Open-Meteo response: %s", error)
        raise WeatherUnavailable("The weather service returned an unexpected response.") from error

    cache.set(cache_key, forecast, CACHE_SECONDS)
    return forecast


def _coordinate(value):
    """Six decimal places (about 10cm), matching the model fields."""
    return Decimal(str(value)).quantize(Decimal("0.000001"))


def find_place(query):
    """Best match for a place name, with its coordinates and time zone, or None."""
    data = _get_json(GEOCODING_URL, {"name": query, "count": 1, "language": "en", "format": "json"})
    results = data.get("results") or []
    if not results:
        return None
    place = results[0]
    name_parts = [place.get("name"), place.get("admin1"), place.get("country")]
    return {
        "location_name": ", ".join(part for part in name_parts if part),
        "latitude": _coordinate(place["latitude"]),
        "longitude": _coordinate(place["longitude"]),
        "time_zone": place.get("timezone") or "UTC",
    }
