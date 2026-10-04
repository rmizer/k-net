from django.db.models import OuterRef, Subquery
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSiteManager

from .models import Tracker, TrackerPing
from .serializers import PingInputSerializer, PingSerializer, TrackerSerializer


def latest_pings_for(trackers):
    """{tracker id: its most recent ping}, in two queries however many trackers there are."""
    latest_ids = (
        Tracker.objects.filter(pk__in=[t.pk for t in trackers])
        .annotate(latest=Subquery(TrackerPing.objects.filter(tracker=OuterRef("pk")).values("pk")[:1]))
        .values_list("pk", "latest")
    )
    ids = {tracker_id: ping_id for tracker_id, ping_id in latest_ids if ping_id}
    pings = TrackerPing.objects.in_bulk(ids.values())
    return {tracker_id: pings[ping_id] for tracker_id, ping_id in ids.items()}


class TrackerViewSet(viewsets.ModelViewSet):
    """Site Managers add, edit and remove trackers. Creating a tracker (or
    rotating its key) returns the secret key once; devices use it to report."""

    queryset = Tracker.objects.select_related("person")
    serializer_class = TrackerSerializer
    permission_classes = [IsSiteManager]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == "list":
            context["latest_pings"] = latest_pings_for(list(self.get_queryset()))
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tracker = Tracker(**serializer.validated_data, created_by=request.user)
        token = tracker.issue_token()
        tracker.save()
        data = TrackerSerializer(tracker, context=self.get_serializer_context()).data
        return Response({**data, "token": token}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def rotate_key(self, request, pk=None):
        """Issues a new key; the old one stops working immediately."""
        tracker = self.get_object()
        token = tracker.issue_token()
        tracker.save(update_fields=["token_hash"])
        return Response({"token": token})

    @action(detail=True, methods=["post"])
    def location(self, request, pk=None):
        """Sets a tracker's location by hand."""
        tracker = self.get_object()
        serializer = PingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ping = serializer.save_for(tracker, TrackerPing.Source.MANUAL)
        return Response(PingSerializer(ping).data, status=status.HTTP_201_CREATED)


class TrackerPingView(APIView):
    """Where devices report locations. Authenticates with the tracker's key
    instead of a login session:

        POST /api/trackers/ping/
        Authorization: Bearer <tracker key>
        {"latitude": 33.749, "longitude": -84.388, "accuracy_m": 15}
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        header = request.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
        tracker = Tracker.for_token(token) if token else None
        if tracker is None or not tracker.person.is_active:
            return Response({"detail": "Invalid or inactive tracker key."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = PingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save_for(tracker, TrackerPing.Source.DEVICE)
        return Response({"detail": "Location recorded."}, status=status.HTTP_201_CREATED)


class CrewFinderView(APIView):
    """Everyone with an active tracker and where they were last seen. Visible to
    every signed-in user; device identifiers and keys are left out."""

    def get(self, request):
        trackers = list(
            Tracker.objects.filter(is_active=True, person__is_active=True).select_related("person__department")
        )
        latest = latest_pings_for(trackers)
        return Response(
            [
                {
                    "tracker_id": tracker.pk,
                    "tracker_type": tracker.tracker_type,
                    "tracker_type_display": tracker.get_tracker_type_display(),
                    "label": tracker.label,
                    "person": {
                        "id": tracker.person.pk,
                        "first_name": tracker.person.first_name,
                        "last_name": tracker.person.last_name,
                        "role_display": tracker.person.get_role_display(),
                        "department_name": tracker.person.department.name if tracker.person.department else None,
                        "phone": tracker.person.phone,
                        "profile_picture": (
                            request.build_absolute_uri(tracker.person.profile_picture.url)
                            if tracker.person.profile_picture
                            else None
                        ),
                    },
                    "location": PingSerializer(latest[tracker.pk]).data if tracker.pk in latest else None,
                }
                for tracker in trackers
            ]
        )
