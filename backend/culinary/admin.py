from django.contrib import admin

from .models import Ingredient, MenuItem, ShoppingItem, ShoppingList


class IngredientInline(admin.TabularInline):
    model = Ingredient
    extra = 0


class ShoppingItemInline(admin.TabularInline):
    model = ShoppingItem
    extra = 0
    raw_id_fields = ["ingredient"]


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ["name", "date", "meal"]
    list_filter = ["meal"]
    date_hierarchy = "date"
    inlines = [IngredientInline]


@admin.register(ShoppingList)
class ShoppingListAdmin(admin.ModelAdmin):
    list_display = ["store", "needed_by", "created_by"]
    inlines = [ShoppingItemInline]
