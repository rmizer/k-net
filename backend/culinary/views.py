from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Department, User
from departments import access
from influencers.models import Influencer

from .models import MenuItem, ShoppingItem, ShoppingList
from .serializers import (
    MenuItemSerializer,
    ShoppingItemSerializer,
    ShoppingListDetailSerializer,
    ShoppingListSerializer,
    drop_shopping_items,
    meal_label,
)

CULINARY = Department.Page.CULINARY


def on_culinary_team(user):
    return access.can_edit(user, CULINARY) or (
        bool(user.department_id) and user.department.page == CULINARY
    )


class CulinaryPagePermission(BasePermission):
    """Anyone who can open the Culinary page can look; the Culinary head(s) and
    Site Managers, Directors and Assistants make changes. The view can let the
    whole Culinary team through for small things, like checking items off."""

    message = "Only the Culinary head, Directors, Assistants and Site Managers can change this."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and access.can_view(user, CULINARY)):
            self.message = "The Culinary page is for the Culinary team."
            return False
        if request.method in SAFE_METHODS or access.can_edit(user, CULINARY):
            return True
        return getattr(view, "team_can_write", False) and on_culinary_team(user)


class MenuItemViewSet(viewsets.ModelViewSet):
    """Menu items, by day. ?start=YYYY-MM-DD&end=YYYY-MM-DD limits to those dates."""

    serializer_class = MenuItemSerializer
    permission_classes = [CulinaryPagePermission]

    def get_queryset(self):
        items = MenuItem.objects.select_related("created_by").prefetch_related("ingredients__shopping_items")
        start = parse_date(self.request.query_params.get("start") or "")
        end = parse_date(self.request.query_params.get("end") or "")
        if start:
            items = items.filter(date__gte=start)
        if end:
            items = items.filter(date__lte=end)
        return items

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        drop_shopping_items(instance.ingredients.all())
        instance.delete()

    @action(detail=True, methods=["post"], url_path="add-to-list")
    @transaction.atomic
    def add_to_list(self, request, pk=None):
        """Put this menu item's ingredients on a shopping list: an existing one
        ({"shopping_list": id}) or a new one ({"store": ..., "needed_by": ...}).
        Ingredients already on that list aren't added twice."""
        menu_item = self.get_object()
        if request.data.get("shopping_list"):
            shopping_list = ShoppingList.objects.filter(pk=request.data["shopping_list"]).first()
            if shopping_list is None:
                raise ValidationError({"shopping_list": "No such shopping list."})
        else:
            new_list = ShoppingListSerializer(data=request.data)
            new_list.is_valid(raise_exception=True)
            shopping_list = new_list.save(created_by=request.user)
        already = set(shopping_list.items.exclude(ingredient=None).values_list("ingredient_id", flat=True))
        added = [
            ShoppingItem(
                shopping_list=shopping_list,
                name=ingredient.name,
                quantity=ingredient.quantity,
                category=ingredient.category,
                meal=meal_label(menu_item),
                ingredient=ingredient,
            )
            for ingredient in menu_item.ingredients.all()
            if ingredient.pk not in already
        ]
        ShoppingItem.objects.bulk_create(added)
        shopping_list = ShoppingList.objects.prefetch_related("items").get(pk=shopping_list.pk)
        return Response(
            {"added": len(added), "shopping_list": ShoppingListDetailSerializer(shopping_list).data},
            status=status.HTTP_201_CREATED,
        )


class ShoppingListViewSet(viewsets.ModelViewSet):
    """Shopping lists. Several can be open at once."""

    permission_classes = [CulinaryPagePermission]

    def get_queryset(self):
        return ShoppingList.objects.select_related("created_by").prefetch_related("items")

    def get_serializer_class(self):
        return ShoppingListSerializer if self.action == "list" else ShoppingListDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ShoppingItemViewSet(viewsets.ModelViewSet):
    """Lines on shopping lists. ?shopping_list=<id> limits to one list. The whole
    Culinary team can check items off while they shop."""

    serializer_class = ShoppingItemSerializer
    permission_classes = [CulinaryPagePermission]
    team_can_write = True

    def get_queryset(self):
        items = ShoppingItem.objects.all()
        if self.request.query_params.get("shopping_list"):
            items = items.filter(shopping_list_id=self.request.query_params["shopping_list"])
        return items

    def _require_editor(self):
        if not access.can_edit(self.request.user, CULINARY):
            raise PermissionDenied(CulinaryPagePermission.message)

    def perform_create(self, serializer):
        self._require_editor()
        serializer.save()

    def perform_update(self, serializer):
        if set(self.request.data) - {"checked"}:
            self._require_editor()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_editor()
        instance.delete()


class FoodAllergiesView(APIView):
    """Everyone on the project with a food allergy: active staff and crew (the
    Directory) and active influencers. Read-only, for whoever can open Culinary."""

    permission_classes = [CulinaryPagePermission]

    def get(self, request):
        people = [
            {
                "kind": "staff",
                "id": person.pk,
                "name": person.get_full_name() or person.email,
                "role_display": person.get_role_display(),
                "title": person.title,
                "department_name": person.department.name if person.department else None,
                "is_active_crew": person.is_active_crew,
                "show_name": None,
                "food_allergies": person.food_allergies.strip(),
            }
            for person in User.objects.filter(is_active=True).exclude(food_allergies="").select_related("department")
            if person.food_allergies.strip()
        ] + [
            {
                "kind": "influencer",
                "id": influencer.pk,
                "name": influencer.name,
                "role_display": "Influencer",
                "title": "",
                "department_name": None,
                "is_active_crew": False,
                "show_name": influencer.show.name if influencer.show else None,
                "food_allergies": influencer.food_allergies.strip(),
            }
            for influencer in Influencer.objects.filter(is_active=True).exclude(food_allergies="").select_related("show")
            if influencer.food_allergies.strip()
        ]
        people.sort(key=lambda row: row["name"].lower())
        return Response(
            {
                "people": people,
                # How many people are on the project, so the page can say how many listed none.
                "total": User.objects.filter(is_active=True).count() + Influencer.objects.filter(is_active=True).count(),
            }
        )
