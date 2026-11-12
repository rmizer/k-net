"""The company inventory: supplies and equipment, by department."""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class InventoryItemQuerySet(models.QuerySet):
    def active(self):
        return self.filter(deleted_at__isnull=True)

    def deleted(self):
        return self.filter(deleted_at__isnull=False)


class InventoryItem(models.Model):
    class ItemType(models.TextChoices):
        """What kind of thing it is, across departments (Culinary has food and cookware)."""

        FOOD = "food", "Food"
        COOKWARE = "cookware", "Cookware & serving"
        DISPOSABLES = "disposables", "Disposables"
        CLEANING = "cleaning", "Cleaning supplies"
        EQUIPMENT = "equipment", "Equipment & gear"
        TOOLS = "tools", "Tools & rigging"
        OFFICE = "office", "Office supplies"
        ENTERTAINMENT = "entertainment", "Entertainment"
        OTHER = "other", "Other"

    class QuantityUnit(models.TextChoices):
        UNITS = "units", "Unit(s)"
        PACKAGES = "packages", "Packages"
        BOXES = "boxes", "Boxes"
        CASES = "cases", "Cases"
        CONTAINERS = "containers", "Containers"
        BAGS = "bags", "Bags"
        BUNCHES = "bunches", "Bunches"
        BOTTLES = "bottles", "Bottles"
        CANS = "cans", "Cans"
        JARS = "jars", "Jars"
        ROLLS = "rolls", "Rolls"
        PACKS = "packs", "Packs"
        PAIRS = "pairs", "Pairs"
        SETS = "sets", "Sets"
        DOZEN = "dozen", "Dozen"
        GROSS = "gross", "Gross (144)"

    class SizeUnit(models.TextChoices):
        # Imperial / US
        OZ = "oz", "oz (ounces)"
        LB = "lb", "lb (pounds)"
        FL_OZ = "fl_oz", "fl oz (fluid ounces)"
        CUP = "cup", "cups"
        PT = "pt", "pt (pints)"
        QT = "qt", "qt (quarts)"
        GAL = "gal", "gal (gallons)"
        IN = "in", "in (inches)"
        FT = "ft", "ft (feet)"
        YD = "yd", "yd (yards)"
        # Metric
        MG = "mg", "mg (milligrams)"
        G = "g", "g (grams)"
        KG = "kg", "kg (kilograms)"
        ML = "ml", "mL (milliliters)"
        L = "l", "L (liters)"
        MM = "mm", "mm (millimeters)"
        CM = "cm", "cm (centimeters)"
        M = "m", "m (meters)"

    name = models.CharField("item name", max_length=200)
    # No department means "Other".
    department = models.ForeignKey(
        "accounts.Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="inventory_items"
    )
    item_type = models.CharField("item type", max_length=15, choices=ItemType.choices, default=ItemType.OTHER)
    purchased_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField("expiration", null=True, blank=True)
    receipt = models.ForeignKey(
        "documents.Document",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inventory_items",
        limit_choices_to={"category": "receipt"},
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, validators=[MinValueValidator(0)])
    quantity_unit = models.CharField(max_length=12, choices=QuantityUnit.choices, default=QuantityUnit.UNITS)
    # Optional count of the individual things, e.g. 2 bunches = 12 bananas.
    piece_count = models.PositiveIntegerField("individual count", null=True, blank=True)
    piece_label = models.CharField("individual items", max_length=60, blank=True, help_text='e.g. "bananas".')
    size = models.DecimalField(
        "item size", max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    size_unit = models.CharField(max_length=6, choices=SizeUnit.choices, blank=True)
    storage_location = models.CharField(max_length=255)
    details = models.TextField("additional details", blank=True)

    # Equipment details, for cameras, computers, drives and the like.
    brand = models.CharField("brand / manufacturer", max_length=100, blank=True)
    model_number = models.CharField(max_length=100, blank=True)
    serial_numbers = models.TextField(blank=True, help_text="One per line when there are several.")
    asset_tag = models.CharField(max_length=60, blank=True, help_text="The company's own tag or label number.")
    warranty_expires = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Deleting moves an item to Recently deleted; restoring clears these.
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    objects = InventoryItemQuerySet.as_manager()

    class Meta:
        ordering = ["name", "pk"]

    def __str__(self):
        return self.name

    def soft_delete(self, user):
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at"])

    def restore(self):
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["deleted_at", "deleted_by", "updated_at"])
