from django.conf import settings
from django.db import models


class MeetingNote(models.Model):
    """Minutes from one meeting. Site Managers, Directors and Assistants take
    and read them; Staff can't."""

    title = models.CharField(max_length=200, blank=True, help_text="Optional, e.g. 'Production meeting'.")
    meeting_at = models.DateTimeField("meeting date and time")
    attendees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="meetings_attended")
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-meeting_at"]

    def __str__(self):
        return self.title or f"Meeting on {self.meeting_at:%b %d, %Y}"
