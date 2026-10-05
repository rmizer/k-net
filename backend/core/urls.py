from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("weather/", views.WeatherView.as_view(), name="weather"),
    path("production/", views.ProductionSettingsView.as_view(), name="production"),
    path("production/location/", views.ProductionLocationView.as_view(), name="production-location"),
    path("staff-manager/staff/", views.StaffOverviewView.as_view(), name="staff-overview"),
]
