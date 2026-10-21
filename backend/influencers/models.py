from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Influencer(models.Model):
    """An influencer / content creator on the project."""

    class Platform(models.TextChoices):
        INSTAGRAM = "instagram", "Instagram"
        TIKTOK = "tiktok", "TikTok"
        YOUTUBE = "youtube", "YouTube"
        KICK = "kick", "Kick"
        TWITCH = "twitch", "Twitch"
        OTHER = "other", "Other"

    name = models.CharField(max_length=150, unique=True)
    handle = models.CharField(max_length=100, blank=True, help_text="Social handle, without the @.")
    platform = models.CharField(max_length=15, choices=Platform.choices, blank=True)
    photo = models.ImageField(upload_to="influencers/", blank=True)

    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)

    agent_name = models.CharField("agent or contact name", max_length=150, blank=True)
    agent_phone = models.CharField("agent or contact phone", max_length=30, blank=True)
    agent_email = models.EmailField("agent or contact email", blank=True)

    travel_needs = models.TextField(blank=True, help_text="Home airport, seating, ground transport, companions, etc.")
    lodging_needs = models.TextField(blank=True, help_text="Room type, nights, accessibility, roommates, etc.")
    needs = models.TextField("other needs", blank=True, help_text="Dietary, equipment, wardrobe, etc.")

    # The show and the week they're currently in (their latest week on the show).
    show = models.ForeignKey(
        "shows.Show", null=True, blank=True, on_delete=models.SET_NULL, related_name="influencers"
    )
    season = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    week = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])

    is_active = models.BooleanField(default=True, help_text="Currently on the project.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class InfluencerNote(models.Model):
    influencer = models.ForeignKey(Influencer, on_delete=models.CASCADE, related_name="notes")
    body = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note on {self.influencer}"


class TravelArrangement(models.Model):
    class Kind(models.TextChoices):
        FLIGHT = "flight", "Flight"
        GROUND = "ground", "Ground transport"
        HOTEL = "hotel", "Hotel"
        RAIL = "rail", "Train"
        OTHER = "other", "Other"

    influencer = models.ForeignKey(Influencer, on_delete=models.CASCADE, related_name="travel")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.FLIGHT)
    provider = models.CharField(max_length=150, blank=True, help_text="Airline, car service, hotel…")
    reference = models.CharField(max_length=100, blank=True, help_text="Flight number, room, booking…")
    confirmation = models.CharField(max_length=100, blank=True)
    depart_location = models.CharField("from", max_length=150, blank=True)
    arrive_location = models.CharField("to", max_length=150, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True, help_text="Departure or check-in.")
    ends_at = models.DateTimeField(null=True, blank=True, help_text="Arrival or check-out.")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = [models.F("starts_at").asc(nulls_last=True), "created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} for {self.influencer}"
