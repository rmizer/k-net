from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import ReadOnlyOrManagerLevel
from notifications import slack

from .models import Alert, Announcement, CallSheet
from .serializers import AlertSerializer, AnnouncementSerializer, CallSheetSerializer, CallSheetSummarySerializer


class AnnouncementViewSet(viewsets.ModelViewSet):
    """Everyone can read; Directors, Assistants and Site Managers post and edit."""

    queryset = Announcement.objects.select_related("created_by")
    serializer_class = AnnouncementSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def perform_create(self, serializer):
        slack.notify_announcement(serializer.save(created_by=self.request.user))


class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def get_queryset(self):
        # Expired alerts stay in the database but drop off the API and dashboard.
        return Alert.objects.active()

    def perform_create(self, serializer):
        slack.notify_alert(serializer.save(created_by=self.request.user))


class CallSheetViewSet(viewsets.ModelViewSet):
    """Published call sheets. Everyone can read them; Directors, Assistants and
    Site Managers publish (Add to announcements) and remove them."""

    queryset = CallSheet.objects.select_related("published_by")
    permission_classes = [ReadOnlyOrManagerLevel]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_serializer_class(self):
        return CallSheetSummarySerializer if self.action == "list" else CallSheetSerializer

    def perform_create(self, serializer):
        serializer.save(published_by=self.request.user)

    @action(detail=False)
    def latest(self, request):
        sheet = self.get_queryset().first()
        return Response(CallSheetSerializer(sheet).data if sheet else None)
