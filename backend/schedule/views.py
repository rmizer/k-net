import uuid

from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import ReadOnlyOrManagerLevel

from .models import Event, TimelineItem
from .serializers import BlockScheduleSerializer, EventSerializer, TimelineItemSerializer


class EventViewSet(viewsets.ModelViewSet):
    """Everyone can view the schedule; Directors, Assistants and Site Managers
    add and edit events.

    Filters: ?start=<iso>&end=<iso> limits to events in that window,
    ?mine=1 limits to the signed-in user's own events, and ?person=<id> to
    someone else's (events they attend or that belong to their department).
    """

    serializer_class = EventSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def get_queryset(self):
        events = Event.objects.select_related("department").prefetch_related("attendees", "influencers")
        params = self.request.query_params

        start, end = params.get("start"), params.get("end")
        if start or end:
            start_dt, end_dt = parse_datetime(start or ""), parse_datetime(end or "")
            if not (start_dt and end_dt):
                raise ValidationError("Both start and end must be ISO date-times.")
            events = events.overlapping(start_dt, end_dt)

        if params.get("mine") in ("1", "true"):
            events = events.for_user(self.request.user)
        if params.get("person"):
            person = User.objects.filter(pk=params["person"]).first()
            if person is None:
                raise ValidationError({"person": "No such person."})
            events = events.for_user(person)
        return events

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["post"], url_path="block")
    def create_block(self, request):
        """Schedule the same thing over date ranges and chosen weekdays in one go."""
        serializer = BlockScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = serializer.save(created_by=request.user)
        events = self.get_queryset().filter(pk__in=[event.pk for event in created])
        return Response(
            {
                "block": str(created[0].block),
                "count": len(created),
                "events": self.get_serializer(events, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["delete"], url_path=r"block/(?P<block>[0-9a-f-]{36})")
    def delete_block(self, request, block=None):
        """Remove every event in a block."""
        try:
            events = Event.objects.filter(block=uuid.UUID(block))
        except ValueError:
            raise NotFound("No such block.") from None
        deleted = events.count()
        if not deleted:
            raise NotFound("No such block.")
        events.delete()
        return Response({"deleted": deleted})


class TimelineItemViewSet(viewsets.ModelViewSet):
    """The Master Timeline. Everyone can view it; Directors, Assistants and
    Site Managers add, edit and remove items."""

    queryset = TimelineItem.objects.select_related("created_by")
    serializer_class = TimelineItemSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
