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
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=15, choices=EventType.choices, default=EventType.PRODUCTION)
    start = models.DateTimeField()
    end = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    location = models.CharField(max_length=255, blank=True)
    department = models.ForeignKey(
        "accounts.Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="events"
    )
    attendees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="events")
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
