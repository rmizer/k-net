from django.urls import path

from . import views

urlpatterns = [
    path("support/", views.SupportRequestView.as_view(), name="support-request"),
]
