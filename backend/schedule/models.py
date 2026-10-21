from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class EventQuerySet(models.QuerySet):
    def overlapping(self, start, end):
        """Events that take place at any point between start and end."""
        return self.filter(start__lt=end, end__gt=start)

    def for_user(self, user):
        """Events the person is attending or that belong to their department."""
        condition = Q(attendees=user)
        if user.department_id:
            condition |= Q(department_id=user.department_id)
        return self.filter(condition).distinct()


class Event(models.Model):
    class EventType(models.TextChoices):
        PRODUCTION = "production", "Production"
        STAFF = "staff", "Staff"
        INFLUENCER = "influencer", "Influencer"
        # Site upkeep and maintenance windows, often overnight.
        SUPPORT = "support", "Support"
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # Who it's for, as the call sheet's "Talent / Crew" column puts it
    # (e.g. "All crew", "BG & Creators").
    talent_crew = models.CharField("talent / crew", max_length=150, blank=True)
    event_type = models.CharField(max_length=15, choices=EventType.choices, default=EventType.PRODUCTION)
    start = models.DateTimeField()
    end = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    location = models.CharField(max_length=255, blank=True)
    department = models.ForeignKey(
        "accounts.Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="events"
    )
    attendees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="events")
    influencers = models.ManyToManyField("influencers.Influencer", blank=True, related_name="events")
    # Shared by the events created together as one block (e.g. Oct 5-30, weekdays,
    # 9 to 5), so the whole block can be removed at once.
    block = models.UUIDField(null=True, blank=True, editable=False, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = EventQuerySet.as_manager()

    class Meta:
        ordering = ["start", "title"]

    def __str__(self):
        return self.title

    def clean(self):
        if self.start and self.end and self.end < self.start:
            raise ValidationError({"end": "The end time can't be before the start time."})


class TimelineItem(models.Model):
    """A phase or milestone on the project-wide Master Timeline. An item that
    starts and ends on the same day is shown as a milestone."""

    name = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_date", "end_date", "name"]

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "The end date can't be before the start date."})


def crew_calls(day):
    """Who's working on a production day, by the schedule: everyone attending an
    event that starts that day, or in the department it's for (help desk support
    shifts aside). Returns
    {person: their first event that day} (timed events before all-day ones)."""
    from accounts.models import User
    from core.models import ProductionSettings

    zone = ProductionSettings.load().zone
    start = datetime.combine(day, time.min, tzinfo=zone)
    events = (
        Event.objects.filter(start__gte=start, start__lt=start + timedelta(days=1))
        .exclude(event_type=Event.EventType.SUPPORT)
        .prefetch_related("attendees")
        .order_by("all_day", "start", "title")
    )
    department_members = {}
    calls = {}
    for event in events:
        people = [person for person in event.attendees.all() if person.is_active]
        if event.department_id:
            if event.department_id not in department_members:
                department_members[event.department_id] = list(
                    User.objects.filter(is_active=True, department_id=event.department_id)
                )
            people += department_members[event.department_id]
        for person in people:
            calls.setdefault(person, event)
    return calls
