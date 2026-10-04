from django.utils import timezone

from .models import ProductionSettings


class ProductionTimeZoneMiddleware:
    """Runs every request in the production's time zone, so "today" and the
    times the API returns match where the shoot is happening."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        timezone.activate(ProductionSettings.load().zone)
        try:
            return self.get_response(request)
        finally:
            timezone.deactivate()
