from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FoodAllergiesView, MenuItemViewSet, ShoppingItemViewSet, ShoppingListViewSet

router = DefaultRouter()
router.register("menu-items", MenuItemViewSet, basename="menu-item")
router.register("shopping-lists", ShoppingListViewSet, basename="shopping-list")
router.register("shopping-items", ShoppingItemViewSet, basename="shopping-item")

urlpatterns = [
    path("food-allergies/", FoodAllergiesView.as_view(), name="food-allergies"),
    *router.urls,
]
