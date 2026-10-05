from rest_framework import viewsets

from accounts.permissions import ReadOnlyOrManagerLevel

from .models import Location
from .serializers import LocationSerializer


class LocationViewSet(viewsets.ModelViewSet):
    """Everyone can see the production's locations; Directors, Assistants and
    Site Managers add, edit and remove them.

    Addresses are placed on the map automatically. Send latitude and longitude
    to place a pin by hand instead.
    """

    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
