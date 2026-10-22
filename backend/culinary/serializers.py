from django.db import transaction
from rest_framework import serializers

from .models import Ingredient, MenuItem, ShoppingItem, ShoppingList


def meal_label(menu_item):
    """What a shopping item from this menu item is for, e.g. "Chili · Dinner, Oct 23"."""
    when = f"{menu_item.date:%b} {menu_item.date.day}"
    return f"{menu_item.name} · {menu_item.get_meal_display()}, {when}"


def sync_shopping_items(ingredient):
    """Carry an ingredient's changes to the shopping list lines made from it."""
    ingredient.shopping_items.update(
        name=ingredient.name,
        quantity=ingredient.quantity,
        category=ingredient.category,
        meal=meal_label(ingredient.menu_item),
    )


def drop_shopping_items(ingredients):
    """An ingredient is leaving the menu: take it off the lists, unless it's already
    been bought (checked off), in which case the line stays."""
    ShoppingItem.objects.filter(ingredient__in=ingredients, checked=False).delete()


class IngredientSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    on_lists = serializers.SerializerMethodField()

    class Meta:
        model = Ingredient
        fields = ["id", "name", "quantity", "category", "on_lists"]

    def get_on_lists(self, ingredient):
        """The shopping lists this ingredient is already on."""
        return sorted({item.shopping_list_id for item in ingredient.shopping_items.all()})


class MenuItemSerializer(serializers.ModelSerializer):
    """A menu item with its ingredient list, written in one go: ingredients sent
    with an id are updated, without one added, and any left out removed."""

    ingredients = IngredientSerializer(many=True, required=False)
    meal_display = serializers.CharField(source="get_meal_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "name",
            "date",
            "meal",
            "meal_display",
            "notes",
            "ingredients",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"name": {"error_messages": {"blank": "Give the menu item a name."}}}

    @transaction.atomic
    def create(self, validated_data):
        ingredients = validated_data.pop("ingredients", [])
        menu_item = MenuItem.objects.create(**validated_data)
        self._save_ingredients(menu_item, ingredients)
        return menu_item

    @transaction.atomic
    def update(self, instance, validated_data):
        ingredients = validated_data.pop("ingredients", None)
        instance = super().update(instance, validated_data)
        if ingredients is not None:
            self._save_ingredients(instance, ingredients)
        else:
            for ingredient in instance.ingredients.all():
                sync_shopping_items(ingredient)
        return instance

    def _save_ingredients(self, menu_item, rows):
        existing = {ingredient.pk: ingredient for ingredient in menu_item.ingredients.all()}
        kept = set()
        for position, row in enumerate(rows):
            row = {**row, "position": position}
            ingredient = existing.get(row.pop("id", None))
            if ingredient is None:
                ingredient = Ingredient.objects.create(menu_item=menu_item, **row)
            else:
                for field, value in row.items():
                    setattr(ingredient, field, value)
                ingredient.save()
            kept.add(ingredient.pk)
            sync_shopping_items(ingredient)
        removed = [ingredient for pk, ingredient in existing.items() if pk not in kept]
        if removed:
            drop_shopping_items(removed)
            Ingredient.objects.filter(pk__in=[ingredient.pk for ingredient in removed]).delete()


class ShoppingItemSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = ShoppingItem
        fields = [
            "id",
            "shopping_list",
            "name",
            "quantity",
            "category",
            "category_display",
            "meal",
            "ingredient",
            "checked",
        ]
        read_only_fields = ["ingredient"]
        extra_kwargs = {"name": {"error_messages": {"blank": "Name the item."}}}


class ShoppingListSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()
    checked_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = ShoppingList
        fields = [
            "id",
            "store",
            "needed_by",
            "notes",
            "item_count",
            "checked_count",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"store": {"error_messages": {"blank": "Which store is this list for?"}}}

    def get_item_count(self, shopping_list):
        return len(shopping_list.items.all())

    def get_checked_count(self, shopping_list):
        return sum(1 for item in shopping_list.items.all() if item.checked)


class ShoppingListDetailSerializer(ShoppingListSerializer):
    items = ShoppingItemSerializer(many=True, read_only=True)

    class Meta(ShoppingListSerializer.Meta):
        fields = [*ShoppingListSerializer.Meta.fields, "items"]
