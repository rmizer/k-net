from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("meeting-notes", views.MeetingNoteViewSet)

urlpatterns = router.urls
