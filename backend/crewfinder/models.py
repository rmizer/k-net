import hashlib
import secrets

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


class Tracker(models.Model):
    """A location tracker assigned to a crew member. Only Site Managers add them.

    Apple doesn't offer an API for AirTag locations, so trackers report in
    through a secret key: any device or bridge service that knows a tracker's
    key can post its location (see TrackerPingView).
    """

    class TrackerType(models.TextChoices):
        AIRTAG = "airtag", "Apple AirTag"
        TILE = "tile", "Tile"
        SMARTTAG = "smarttag", "Samsung SmartTag"
        GPS = "gps", "GPS tracker"
        PHONE = "phone", "Phone"
        OTHER = "other", "Other"

    person = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trackers")
    tracker_type = models.CharField(max_length=15, choices=TrackerType.choices, default=TrackerType.AIRTAG)
    label = models.CharField(max_length=100, blank=True, help_text="e.g. “Badge AirTag” or the device name.")
    identifier = models.CharField(max_length=150, blank=True, help_text="Serial number or device ID, if known.")
    # Only a hash of the key is stored; the key itself is shown once when created.
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["person__first_name", "person__last_name"]

    def __str__(self):
        return f"{self.get_tracker_type_display()} for {self.person}"

    def issue_token(self):
        """Sets a new secret key and returns it. Save the tracker afterwards."""
        token = secrets.token_urlsafe(24)
        self.token_hash = hash_token(token)
        return token

    @classmethod
    def for_token(cls, token):
        return cls.objects.filter(token_hash=hash_token(token), is_active=True).select_related("person").first()

    @property
    def latest_ping(self):
        return self.pings.first()


class TrackerPing(models.Model):
    class Source(models.TextChoices):
        DEVICE = "device", "Device"
        MANUAL = "manual", "Set by a Site Manager"

    tracker = models.ForeignKey(Tracker, on_delete=models.CASCADE, related_name="pings")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, validators=[MinValueValidator(-90), MaxValueValidator(90)]
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, validators=[MinValueValidator(-180), MaxValueValidator(180)]
    )
    accuracy_m = models.PositiveIntegerField(null=True, blank=True, help_text="Accuracy radius in meters.")
    note = models.CharField(max_length=150, blank=True, help_text="Optional, e.g. “Stage B”.")
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.DEVICE)
    recorded_at = models.DateTimeField()

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["tracker", "-recorded_at"])]

    def __str__(self):
        return f"{self.tracker} at {self.recorded_at:%Y-%m-%d %H:%M}"
