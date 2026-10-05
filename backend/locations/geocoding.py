"""Street addresses → coordinates, using OpenStreetMap's Nominatim service.

Nominatim's usage policy asks for an identifying User-Agent and at most one
request a second; locations are added by hand, so that's never close.
"""

import hashlib
import json
import logging
from decimal import Decimal
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.core.cache import cache

logger = logging.getLogger(__name__)

SEARCH_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "K-Net production management (internal tool)"
TIMEOUT_SECONDS = 8
CACHE_SECONDS = 60 * 60 * 24 * 30


def geocode(address):
    """(latitude, longitude) for an address, or None if it can't be found."""
    address = " ".join(address.split())
    if not address:
        return None
    cache_key = f"geocode:{hashlib.sha256(address.lower().encode()).hexdigest()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return tuple(cached) or None

    request = Request(
        f"{SEARCH_URL}?{urlencode({'q': address, 'format': 'jsonv2', 'limit': 1})}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            results = json.load(response)
    except (URLError, TimeoutError, ValueError) as error:
        logger.warning("Geocoding failed for %r: %s", address, error)
        return None  # Not cached, so a later save can try again.

    point = (
        (round(Decimal(results[0]["lat"]), 6), round(Decimal(results[0]["lon"]), 6)) if results else ()
    )
    cache.set(cache_key, point, CACHE_SECONDS)
    return point or None
