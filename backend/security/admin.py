from django.contrib import admin

from .models import IncidentReport


@admin.register(IncidentReport)
class IncidentReportAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "severity", "occurred_at", "status", "reported_by"]
    list_filter = ["status", "severity", "category"]
    search_fields = ["title", "description", "location", "people_involved"]
