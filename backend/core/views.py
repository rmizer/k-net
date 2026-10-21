from collections import OrderedDict
from datetime import datetime, time, timedelta

from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsManagerLevel, IsSiteManager, ReadOnlyOrManagerLevel
from announcements.models import Alert, Announcement
from announcements.serializers import AlertSerializer, AnnouncementSerializer
from schedule.models import Event, crew_calls
from schedule.serializers import EventSerializer
from tasks.models import Task
from tasks.serializers import TaskSerializer
from tasks.views import visible_to

from . import weather
from .models import InvestorPage, ProductionSettings
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
    """Sets the production location from a place name (e.g. "Tampa, FL"),
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
                {"query": ["We couldn't find that place. Try a city name, like “Tampa”."]},
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

        events = Event.objects.select_related("department").prefetch_related("attendees", "influencers")
        todays_events = events.overlapping(_start_of(today), _start_of(today + timedelta(days=1)))
        week_events = events.overlapping(_start_of(week_start), _start_of(week_start + timedelta(days=7)))
        # Staff see only their own week; Directors and Assistants see everyone's.
        if not user.is_manager_level:
            week_events = week_events.for_user(user)

        my_tasks = (
            Task.objects.select_related("assigned_to", "department")
            .filter(visible_to(user))
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
                "todays_crew": self._todays_crew(today),
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

    def _todays_crew(self, today):
        """Who's working today by the schedule, grouped by department."""
        # By department, with people who have none last.
        crew = sorted(
            crew_calls(today),
            key=lambda person: (person.department is None, getattr(person.department, "name", ""), person.first_name),
        )
        groups = OrderedDict()
        for person in crew:
            name = person.department.name if person.department else "Unassigned"
            groups.setdefault(name, []).append(
                {"id": person.pk, "first_name": person.first_name, "last_name": person.last_name}
            )
        return [{"department": name, "members": members} for name, members in groups.items()]


class StaffOverviewView(APIView):
    """The Task Manager's master staff list: everyone, with their task load and
    what's next on their schedule. Directors, Assistants and Site Managers only."""

    permission_classes = [IsManagerLevel]

    def get(self, request):
        today = timezone.localdate()
        now = timezone.now()
        week_start = _start_of(today - timedelta(days=today.weekday()))
        week_end = week_start + timedelta(days=7)
        people = User.objects.filter(is_active=True).select_related("department").order_by("first_name", "last_name")
        tasks = list(Task.objects.filter(assigned_to__in=people).values("assigned_to", "status", "due_date"))

        rows = []
        for person in people:
            mine = [t for t in tasks if t["assigned_to"] == person.pk]
            open_tasks = [t for t in mine if t["status"] != Task.Status.DONE]
            events = Event.objects.for_user(person)
            upcoming = events.filter(end__gt=now).order_by("start").first()
            this_week = events.overlapping(week_start, week_end).filter(all_day=False)
            hours = sum(
                (min(e.end, week_end) - max(e.start, week_start)).total_seconds() / 3600 for e in this_week
            )
            rows.append(
                {
                    "id": person.pk,
                    "name": person.get_full_name(),
                    "first_name": person.first_name,
                    "email": person.email,
                    "phone": person.phone,
                    "role": person.role,
                    "role_display": person.get_role_display(),
                    "department": person.department_id,
                    "department_name": person.department.name if person.department else None,
                    "is_active_crew": person.is_active_crew,
                    "lodging": person.lodging,
                    "room_number": person.room_number,
                    "tasks": {
                        "open": len(open_tasks),
                        "overdue": sum(1 for t in open_tasks if t["due_date"] and t["due_date"] < today),
                        "done": len(mine) - len(open_tasks),
                    },
                    "next_event": {
                        "id": upcoming.pk,
                        "title": upcoming.title,
                        "start": upcoming.start,
                        "end": upcoming.end,
                        "all_day": upcoming.all_day,
                        "location": upcoming.location,
                    }
                    if upcoming
                    else None,
                    "hours_this_week": round(hours, 1),
                }
            )
        return Response(rows)


class InvestorLinkView(APIView):
    """Site Managers get the investor page's share link, or replace it
    (POST), which stops the old link from working."""

    permission_classes = [IsSiteManager]

    def get(self, request):
        return Response({"token": InvestorPage.load().token})

    def post(self, request):
        page = InvestorPage.load()
        page.rotate_token()
        return Response({"token": page.token})


class InvestorPageView(APIView):
    """The investor page itself, open to anyone: it's linked from the public
    About the trial page. Share links with a token (from before the page went
    public) keep working while the token is current; other tokens are a 404."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token=None):
        if token is not None and not constant_time_compare(token, InvestorPage.load().token):
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        # The page content lives in the frontend; this only checks access.
        return Response({"status": "ok"})
