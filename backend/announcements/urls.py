from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("announcements", views.AnnouncementViewSet)
router.register("alerts", views.AlertViewSet, basename="alert")
router.register("call-sheets", views.CallSheetViewSet, basename="call-sheet")

urlpatterns = router.urls
