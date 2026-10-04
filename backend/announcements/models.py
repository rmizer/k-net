from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Announcement(models.Model):
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    pinned = models.BooleanField(default=False, help_text="Pinned announcements stay at the top.")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pinned", "-created_at"]

    def __str__(self):
        return self.title


class AlertQuerySet(models.QuerySet):
    def active(self):
        return self.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))


class Alert(models.Model):
    class Level(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        URGENT = "urgent", "Urgent"

    message = models.CharField(max_length=255)
    level = models.CharField(max_length=10, choices=Level.choices, default=Level.INFO)
    expires_at = models.DateTimeField(
        null=True, blank=True, help_text="Leave empty to keep the alert up until it's removed."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AlertQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.message
