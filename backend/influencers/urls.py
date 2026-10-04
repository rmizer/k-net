from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("influencers", views.InfluencerViewSet)
router.register("influencer-notes", views.InfluencerNoteViewSet)
router.register("influencer-travel", views.TravelArrangementViewSet)

urlpatterns = router.urls
