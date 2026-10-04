from django.conf import settings
from django.db import models


class Resource(models.Model):
    """A vendor or service the production can call on: caterers, rentals,
    transportation, utilities, stores and so on."""

    class Category(models.TextChoices):
        CATERING = "catering", "Catering"
        EQUIPMENT = "equipment", "Film equipment"
        RENTALS = "rentals", "Rentals"
        TRANSPORTATION = "transportation", "Transportation"
        UTILITIES = "utilities", "Utilities"
        TECHNICAL = "technical", "Technical"
        STORES = "stores", "Stores"
        PERMITS = "permits", "Permits & film office"
        MEDICAL = "medical", "Medical & safety"
        LODGING = "lodging", "Lodging"
        OTHER = "other", "Other"

    company_name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    contact_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True, help_text="Services offered, hours, account numbers, etc.")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name
