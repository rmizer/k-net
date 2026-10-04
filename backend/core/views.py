from collections import OrderedDict
from datetime import datetime, time, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsManagerLevel, ReadOnlyOrManagerLevel
from announcements.models import Alert, Announcement
from announcements.serializers import AlertSerializer, AnnouncementSerializer
from schedule.models import Event
from schedule.serializers import EventSerializer
from tasks.models import Task
from tasks.serializers import TaskSerializer

from . import weather
from .models import ProductionSettings
from .serializers import LocationQuerySerializer, ProductionSettingsSerializer

ANNOUNCEMENT_LIMIT = 5
STAFF_TASK_LIMIT = 8


class ProductionSettingsView(APIView):
    permission_classes = [ReadOnlyOrManagerLevel]

    def get(self, request):
        return Response(ProductionSettingsSerializer(ProductionSettings.load()).data)

    def patch(self, request):
        serializer = ProductionSettingsSerializer(ProductionSettings.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProductionLocationView(APIView):
    """Sets the production location from a place name (e.g. "Atlanta, GA"),
    which also sets the time zone used for "today"."""

    permission_classes = [IsManagerLevel]

    def post(self, request):
        serializer = LocationQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            place = weather.find_place(serializer.validated_data["query"])
        except weather.WeatherUnavailable as error:
            return Response({"detail": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if place is None:
            return Response(
                {"query": ["We couldn't find that place. Try a city name, like “Atlanta”."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        production = ProductionSettings.load()
        for field, value in place.items():
            setattr(production, field, value)
        production.full_clean()
        production.save()
        return Response(ProductionSettingsSerializer(production).data)


class WeatherView(APIView):
    def get(self, request):
        production = ProductionSettings.load()
        if not production.has_location:
            return Response({"configured": False})
        try:
            forecast = weather.get_forecast(
                production.latitude, production.longitude, production.time_zone, production.units
            )
        except weather.WeatherUnavailable as error:
            return Response({"detail": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"configured": True, "location_name": production.location_name, **forecast})


def _start_of(day):
    return timezone.make_aware(datetime.combine(day, time.min))


class DashboardView(APIView):
    """Everything the dashboard shows, in one request, filtered for the viewer's role."""

    def get(self, request):
        user = request.user
        context = {"request": request}
        production = ProductionSettings.load()
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())  # Monday

        events = Event.objects.select_related("department").prefetch_related("attendees")
        todays_events = events.overlapping(_start_of(today), _start_of(today + timedelta(days=1)))
        week_events = events.overlapping(_start_of(week_start), _start_of(week_start + timedelta(days=7)))
        # Staff see only their own week; Directors and Assistants see everyone's.
        if not user.is_manager_level:
            week_events = week_events.for_user(user)

        my_tasks = (
            Task.objects.select_related("assigned_to", "department")
            .filter(assigned_to=user)
            .exclude(status=Task.Status.DONE)
        )

        return Response(
            {
                "production": {
                    "name": production.name,
                    "location_name": production.location_name,
                    "time_zone": production.time_zone,
                    "today": today,
                    "week_start": week_start,
                },
                "alerts": AlertSerializer(Alert.objects.active(), many=True).data,
                "announcements": AnnouncementSerializer(
                    Announcement.objects.select_related("created_by")[:ANNOUNCEMENT_LIMIT], many=True
                ).data,
                "daily_rundown": EventSerializer(todays_events, many=True, context=context).data,
                "my_tasks": TaskSerializer(my_tasks, many=True).data,
                "staff_tasks": self._staff_tasks(today) if user.is_manager_level else None,
                "week_events": EventSerializer(week_events, many=True, context=context).data,
                "todays_crew": self._todays_crew(),
            }
        )

    def _staff_tasks(self, today):
        """Summary of every staff task, for Directors and Assistants."""
        tasks = Task.objects.select_related("assigned_to", "department")
        open_tasks = tasks.exclude(status=Task.Status.DONE)
        return {
            "counts": {
                "todo": tasks.filter(status=Task.Status.TODO).count(),
                "in_progress": tasks.filter(status=Task.Status.IN_PROGRESS).count(),
                "overdue": open_tasks.filter(due_date__lt=today).count(),
                "done": tasks.filter(status=Task.Status.DONE).count(),
            },
            "open": TaskSerializer(open_tasks[:STAFF_TASK_LIMIT], many=True).data,
            "open_total": open_tasks.count(),
        }

    def _todays_crew(self):
        """Active crew grouped by department."""
        crew = (
            User.objects.filter(is_active=True, is_active_crew=True)
            .select_related("department")
            .order_by("department__name", "first_name", "last_name")
        )
        groups = OrderedDict()
        for person in crew:
            name = person.department.name if person.department else "Unassigned"
            groups.setdefault(name, []).append(
                {"id": person.pk, "first_name": person.first_name, "last_name": person.last_name}
            )
        return [{"department": name, "members": members} for name, members in groups.items()]
