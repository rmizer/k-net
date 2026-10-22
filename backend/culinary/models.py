"""The Culinary department page: menus and shopping lists."""

from django.conf import settings
from django.db import models


class Category(models.TextChoices):
    """Shopping list sections, in store order."""

    MEAT = "meat", "Meat & seafood"
    PRODUCE = "produce", "Fruit & vegetables"
    DAIRY = "dairy", "Dairy & eggs"
    BAKERY = "bakery", "Bakery"
    DIETARY = "dietary", "Dietary products"
    PANTRY = "pantry", "Pantry"
    FROZEN = "frozen", "Frozen"
    BEVERAGES = "beverages", "Beverages"
    PAPER = "paper", "Paper products"
    TOOLS = "tools", "Tools & equipment"
    OTHER = "other", "Other"


class MenuItem(models.Model):
    class Meal(models.TextChoices):
        BREAKFAST = "breakfast", "Breakfast"
        LUNCH = "lunch", "Lunch"
        DINNER = "dinner", "Dinner"
        SNACK = "snack", "Snack"
        DESSERT = "dessert", "Dessert"
        BEVERAGE = "beverage", "Beverage"

    name = models.CharField(max_length=200)
    date = models.DateField()
    meal = models.CharField("meal / item type", max_length=10, choices=Meal.choices, default=Meal.DINNER)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "meal", "name"]

    def __str__(self):
        return f"{self.name} ({self.date})"


class Ingredient(models.Model):
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name="ingredients")
    name = models.CharField(max_length=200)
    quantity = models.CharField(max_length=60, blank=True, help_text='e.g. "5 lb" or "2 dozen".')
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.OTHER)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "pk"]

    def __str__(self):
        return self.name


class ShoppingList(models.Model):
    store = models.CharField(max_length=150)
    needed_by = models.DateField("shop by", null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = [models.F("needed_by").asc(nulls_last=True), "-created_at"]

    def __str__(self):
        return self.store


class ShoppingItem(models.Model):
    """One line on a shopping list. The same thing for two meals is two lines.
    Items added from a menu item stay linked to its ingredient, so editing the
    menu updates the list."""

    shopping_list = models.ForeignKey(ShoppingList, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=200)
    quantity = models.CharField(max_length=60, blank=True)
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.OTHER)
    meal = models.CharField("for (meal)", max_length=200, blank=True)
    ingredient = models.ForeignKey(
        Ingredient, null=True, blank=True, on_delete=models.SET_NULL, related_name="shopping_items"
    )
    checked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["pk"]

    def __str__(self):
        return self.name
