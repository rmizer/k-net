"""The Security department page: incident reports."""

from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models

from documents.models import private_storage

IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic"]
VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm"]
ATTACHMENT_EXTENSIONS = [*IMAGE_EXTENSIONS, *VIDEO_EXTENSIONS, "pdf"]

# Phone videos run large; anything bigger should be trimmed or shared another way.
MAX_ATTACHMENT_MB = 200


class IncidentReport(models.Model):
    """Something that breached or threatened security on the production, filed by
    the Security team and reviewed by the Security head or a manager."""

    class Category(models.TextChoices):
        BREACH = "breach", "Security breach / unauthorized access"
        TRESPASS = "trespass", "Trespassing"
        FAN = "fan", "Fan or stalker"
        THREAT = "threat", "Threat or harassment"
        ALTERCATION = "altercation", "Fight or altercation"
        THEFT = "theft", "Theft or missing property"
        DAMAGE = "damage", "Property damage"
        MEDICAL = "medical", "Injury or medical"
        HAZARD = "hazard", "Fire or safety hazard"
        OTHER = "other", "Other"

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        INVESTIGATING = "investigating", "Investigating"
        RESOLVED = "resolved", "Resolved"

    title = models.CharField("summary", max_length=200)
    category = models.CharField(max_length=15, choices=Category.choices, default=Category.OTHER)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
    occurred_at = models.DateTimeField("when it happened")
    location = models.CharField("where", max_length=200)
    description = models.TextField("what happened")
    people_involved = models.TextField(blank=True, help_text="Names or descriptions of the people involved.")
    witnesses = models.TextField(blank=True)
    actions_taken = models.TextField(blank=True, help_text="What Security did at the time.")
    police_called = models.BooleanField(default=False)
    police_report_number = models.CharField(max_length=60, blank=True)

    status = models.CharField(max_length=15, choices=Status.choices, default=Status.OPEN)
    resolution = models.TextField("resolution and follow-up", blank=True)

    # The highest severity managers were alerted about, so re-saving doesn't alert twice.
    alerted_severity = models.CharField(max_length=10, choices=Severity.choices, blank=True)

    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="incident_reports"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurred_at", "-pk"]

    def __str__(self):
        return self.title

    ALERT_SEVERITIES = [Severity.HIGH, Severity.CRITICAL]

    def needs_alert(self):
        """High and Critical reports alert managers once, and again if raised to Critical."""
        if self.severity not in self.ALERT_SEVERITIES:
            return False
        if not self.alerted_severity:
            return True
        return self.ALERT_SEVERITIES.index(self.severity) > self.ALERT_SEVERITIES.index(self.alerted_severity)


class IncidentAttachment(models.Model):
    """A photo, video or PDF on an incident report. Stored privately and streamed
    only to the people who can read the report."""

    report = models.ForeignKey(IncidentReport, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(
        upload_to="incidents/%Y/%m/",
        storage=private_storage,
        validators=[FileExtensionValidator(ATTACHMENT_EXTENSIONS)],
    )
    caption = models.CharField(max_length=200, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "pk"]

    def __str__(self):
        return self.file_name

    @property
    def file_name(self):
        return self.file.name.rsplit("/", 1)[-1]

    @property
    def kind(self):
        extension = self.file_name.rsplit(".", 1)[-1].lower()
        if extension in IMAGE_EXTENSIONS:
            return "image"
        if extension in VIDEO_EXTENSIONS:
            return "video"
        return "file"
