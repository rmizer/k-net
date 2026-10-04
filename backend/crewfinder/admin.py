from django.contrib import admin

from .models import Tracker, TrackerPing


class TrackerPingInline(admin.TabularInline):
    model = TrackerPing
    extra = 0
    ordering = ["-recorded_at"]
    max_num = 0  # History is read-only here; the app records pings.
    readonly_fields = ["latitude", "longitude", "accuracy_m", "note", "source", "recorded_at"]


@admin.register(Tracker)
class TrackerAdmin(admin.ModelAdmin):
    list_display = ["person", "tracker_type", "label", "identifier", "is_active", "created_at"]
    list_filter = ["tracker_type", "is_active"]
    search_fields = ["person__first_name", "person__last_name", "label", "identifier"]
    inlines = [TrackerPingInline]

    def has_add_permission(self, request):
        # Trackers are added in the app (CrewFinder), which shows the device key once.
        return False
