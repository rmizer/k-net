from rest_framework import viewsets

from accounts.permissions import ReadOnlyOrManagerLevel

from .models import Resource
from .serializers import ResourceSerializer


class ResourceViewSet(viewsets.ModelViewSet):
    """Everyone can view the Resources Directory; Directors, Assistants and
    Site Managers add, edit and remove listings."""

    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
