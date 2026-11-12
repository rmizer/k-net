from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("challenges", views.ChallengeViewSet, basename="challenge")
router.register("challenge-supplies", views.SupplyItemViewSet, basename="challenge-supply")

urlpatterns = router.urls
