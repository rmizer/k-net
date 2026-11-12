from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("inventory-items", views.InventoryItemViewSet, basename="inventory-item")

urlpatterns = router.urls
