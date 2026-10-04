from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("announcements", views.AnnouncementViewSet)
router.register("alerts", views.AlertViewSet, basename="alert")

urlpatterns = router.urls
