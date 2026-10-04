from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("events", views.EventViewSet, basename="event")

urlpatterns = router.urls
