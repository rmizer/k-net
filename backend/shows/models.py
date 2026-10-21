from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Show(models.Model):
    """A show the production runs, or one Directors are brainstorming."""

    class Status(models.TextChoices):
        PLANNING = "planning", "Planning"
        PRE_PRODUCTION = "pre_production", "Pre-production"
        PRODUCTION = "production", "Production"

    name = models.CharField(max_length=150, unique=True)
    description = models.TextField()
    start_date = models.DateField("production start date", null=True, blank=True)
    shooting_location = models.CharField(max_length=150, blank=True, help_text="City and state.")
    status = models.CharField(max_length=20, choices=Status.choices, blank=True)
    seasons = models.PositiveSmallIntegerField(
        "number of seasons", null=True, blank=True, validators=[MinValueValidator(1)]
    )
    weeks_per_season = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])

    director = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="shows_directed"
    )
    other_directors = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="shows_codirected")
    department_heads = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="shows_heading")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
