from django.conf import settings
from django.db import models


class Location(models.Model):
    """A place the production uses: crew hotels, airports, shooting locations and so on."""

    class Kind(models.TextChoices):
        LODGING = "lodging", "Lodging"
        AIRPORT = "airport", "Airport"
        SHOOTING = "shooting", "Shooting location"
        PRODUCTION = "production", "Production base"
        OTHER = "other", "Other"

    name = models.CharField(max_length=200)
    kind = models.CharField("type", max_length=15, choices=Kind.choices, default=Kind.SHOOTING)
    custom_type = models.CharField(
        max_length=60, blank=True, help_text="Your own label for Other, e.g. Hospital or Restaurant."
    )
    address = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    website = models.URLField(blank=True)
    contact_name = models.CharField("on-site contact", max_length=150, blank=True)
    notes = models.TextField(blank=True, help_text="Parking, access, load-in, Wi-Fi, etc.")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["kind", "name"]

    def __str__(self):
        return self.name

    @property
    def type_label(self):
        if self.kind == self.Kind.OTHER and self.custom_type:
            return self.custom_type
        return self.get_kind_display()
