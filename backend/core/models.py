import secrets
from zoneinfo import ZoneInfo, available_timezones

from django.core.exceptions import ValidationError
from django.db import models


def validate_time_zone(value):
    if value not in available_timezones():
        raise ValidationError(f"{value} is not a recognized time zone.")


class ProductionSettings(models.Model):
    """Production-wide settings. There is only ever one row (pk=1)."""

    class Units(models.TextChoices):
        IMPERIAL = "imperial", "Imperial (°F, mph)"
        METRIC = "metric", "Metric (°C, km/h)"

    name = models.CharField(max_length=150, default="K-Net Production")
    location_name = models.CharField(
        max_length=255, blank=True, help_text="Shown with the weather, e.g. 'Atlanta, Georgia, United States'."
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    # Decides what "today" means across the app (daily rundown, overdue tasks, etc.).
    time_zone = models.CharField(max_length=64, default="UTC", validators=[validate_time_zone])
    units = models.CharField(max_length=10, choices=Units.choices, default=Units.IMPERIAL)

    class Meta:
        verbose_name = "production settings"
        verbose_name_plural = "production settings"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass  # The settings row can be edited but never removed.

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def has_location(self):
        return self.latitude is not None and self.longitude is not None

    @property
    def zone(self):
        return ZoneInfo(self.time_zone)


def new_investor_token():
    return secrets.token_urlsafe(24)


class InvestorPage(models.Model):
    """The private investor page. There is only ever one row (pk=1). It isn't
    behind a login: anyone with the link (which includes the secret token) can
    view it, and replacing the token stops old links from working."""

    token = models.CharField(max_length=64, unique=True, default=new_investor_token)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "investor page"

    def __str__(self):
        return "Investor page"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def rotate_token(self):
        self.token = new_investor_token()
        self.save(update_fields=["token", "updated_at"])
