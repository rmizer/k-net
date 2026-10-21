from rest_framework import viewsets

from accounts.permissions import IsManagerLevel

from .models import MeetingNote
from .serializers import MeetingNoteSerializer


class MeetingNoteViewSet(viewsets.ModelViewSet):
    """Meeting notes, for Site Managers, Directors and Assistants only."""

    queryset = MeetingNote.objects.select_related("created_by", "updated_by").prefetch_related("attendees")
    serializer_class = MeetingNoteSerializer
    permission_classes = [IsManagerLevel]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
