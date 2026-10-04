from rest_framework import viewsets

from accounts.permissions import ReadOnlyOrManagerLevel

from .models import Alert, Announcement
from .serializers import AlertSerializer, AnnouncementSerializer


class AnnouncementViewSet(viewsets.ModelViewSet):
    """Everyone can read; Directors, Assistants and Site Managers post and edit."""

    queryset = Announcement.objects.select_related("created_by")
    serializer_class = AnnouncementSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def get_queryset(self):
        # Expired alerts stay in the database but drop off the API and dashboard.
        return Alert.objects.active()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
