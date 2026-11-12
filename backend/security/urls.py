from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("incident-reports", views.IncidentReportViewSet, basename="incident-report")
router.register("incident-attachments", views.IncidentAttachmentViewSet, basename="incident-attachment")

urlpatterns = router.urls
