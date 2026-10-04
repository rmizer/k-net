from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("trackers", views.TrackerViewSet)

urlpatterns = [
    # Listed before the router so "ping" isn't read as a tracker id.
    path("trackers/ping/", views.TrackerPingView.as_view(), name="tracker-ping"),
    path("crewfinder/", views.CrewFinderView.as_view(), name="crewfinder"),
    *router.urls,
]
