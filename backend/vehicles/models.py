"""Vehicles: the party bus, shuttle bus, rental trucks and anything else the
production drives, with where each one is and its paperwork."""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Vehicle(models.Model):
    class Kind(models.TextChoices):
        PARTY_BUS = "party_bus", "Party bus"
        SHUTTLE_BUS = "shuttle_bus", "Shuttle bus"
        VAN = "van", "Van / passenger van"
        MOVING_TRUCK = "moving_truck", "Moving truck (U-Haul, Penske…)"
        BOX_TRUCK = "box_truck", "Box truck / grip truck"
        PICKUP = "pickup", "Pickup truck"
        CAR = "car", "Car / SUV"
        TRAILER = "trailer", "Trailer"
        CART = "cart", "Golf cart / utility cart"
        OTHER = "other", "Other"

    class Ownership(models.TextChoices):
        RENTED = "rented", "Rented"
        OWNED = "owned", "Owned"
        LEASED = "leased", "Leased"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        OUT_OF_SERVICE = "out_of_service", "Out of service"
        RETURNED = "returned", "Returned"

    name = models.CharField(max_length=150, help_text='What the crew calls it, e.g. "Party bus" or "U-Haul #2".')
    kind = models.CharField("type", max_length=15, choices=Kind.choices, default=Kind.OTHER)
    description = models.TextField(help_text="What it looks like and what it's used for.")
    make_model = models.CharField("make and model", max_length=150, blank=True)
    year = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1950), MaxValueValidator(2100)]
    )
    color = models.CharField(max_length=60, blank=True)
    vin = models.CharField("VIN", max_length=17, blank=True, help_text="The 17-character vehicle identification number.")
    license_plate = models.CharField(max_length=20)
    plate_state = models.CharField("plate state", max_length=30, blank=True)

    ownership = models.CharField(max_length=10, choices=Ownership.choices, default=Ownership.RENTED)
    rented_from = models.CharField(max_length=255, blank=True, help_text="Company and pickup location.")
    rental_reference = models.CharField("rental agreement / reservation #", max_length=80, blank=True)
    rented_on = models.DateField("picked up on", null=True, blank=True)
    return_by = models.DateTimeField("due back", null=True, blank=True)
    return_to = models.CharField("return location", max_length=255, blank=True)

    storage_location = models.CharField(max_length=255, help_text="Where it's parked when it's not in use.")
    keys_location = models.CharField("where the keys are", max_length=255, blank=True)
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="main driver",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="vehicles_driven",
    )
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ACTIVE)

    # Receipts (gas, tolls, rental charges) and paperwork (registration, insurance).
    documents = models.ManyToManyField("documents.Document", blank=True, related_name="vehicles")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "pk"]

    def __str__(self):
        return self.name
