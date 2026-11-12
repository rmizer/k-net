"""The Challenge Planner: each week's challenges and what they need."""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Check(models.TextChoices):
    """A safety checklist item."""

    TODO = "todo", "To do"
    DONE = "done", "Done"
    NOT_NEEDED = "not_needed", "Not needed"


class Challenge(models.Model):
    class Status(models.TextChoices):
        PLANNING = "planning", "In planning"
        PLANNED = "planned", "Planned"
        COMPLETE = "complete", "Complete"

    class Location(models.TextChoices):
        BACKYARD = "backyard", "Backyard"
        POOL = "pool", "Pool area"
        INDOORS = "indoors", "Indoors"
        KITCHEN = "kitchen", "Kitchen"
        OFF_SITE = "off_site", "Off-site"
        OTHER = "other", "Other"

    # Content warnings the stream may need to show, in display order.
    CONTENT_WARNINGS = {
        "eating_insects": "Eating insects",
        "gross_food": "Gross-out food",
        "vomiting": "Vomiting",
        "mess": "Mud, slime and mess",
        "physical_contact": "Wrestling / physical contact",
        "injury_risk": "Risk of minor injury",
        "phobias": "Phobias (bugs, heights, tight spaces)",
        "flashing_lights": "Flashing lights",
    }

    # Safety checklist: nothing can be To do once a challenge is Planned or Complete.
    SAFETY_CHECKS = {
        "waivers": "Waivers signed",
        "allergy_check": "Allergy check done",
        "medic": "Medic booked",
    }

    name = models.CharField(max_length=200)
    date = models.DateField()
    show = models.ForeignKey("shows.Show", null=True, blank=True, on_delete=models.SET_NULL, related_name="challenges")
    week = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    description = models.TextField()
    participants = models.ManyToManyField("influencers.Influencer", blank=True, related_name="challenges")
    rewards = models.TextField(blank=True)

    location = models.CharField("where on site", max_length=10, choices=Location.choices, blank=True)
    location_details = models.CharField(max_length=200, blank=True)
    cleanup_plan = models.TextField("clean-up plan", blank=True)
    cleanup_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="clean-up owner",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="challenge_cleanups",
    )

    waivers = models.CharField("waivers signed", max_length=10, choices=Check.choices, default=Check.TODO)
    allergy_check = models.CharField("allergy check", max_length=10, choices=Check.choices, default=Check.TODO)
    medic = models.CharField("medic booked", max_length=10, choices=Check.choices, default=Check.TODO)

    content_warnings = models.JSONField(default=list, blank=True)
    other_content_warnings = models.CharField(max_length=200, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PLANNING)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name

    @property
    def safety_to_do(self):
        """The safety checklist items still To do."""
        return [label for field, label in self.SAFETY_CHECKS.items() if getattr(self, field) == Check.TODO]


class SupplyItem(models.Model):
    """One line on a challenge's supply list, checked off once it's in hand."""

    class Category(models.TextChoices):
        PROPS = "props", "Props & set"
        TECH = "tech", "Tech & equipment"
        WARDROBE = "wardrobe", "Wardrobe"
        FOOD = "food", "Food & drink"
        PRIZES = "prizes", "Prizes"
        SAFETY = "safety", "Safety & first aid"
        OTHER = "other", "Other"

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="supplies")
    name = models.CharField(max_length=200)
    quantity = models.CharField(max_length=60, blank=True)
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.OTHER)
    note = models.CharField(max_length=200, blank=True, help_text="Where to get it, who is bringing it, etc.")
    checked = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "pk"]

    def __str__(self):
        return self.name
