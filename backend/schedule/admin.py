from django.contrib import admin

from .models import Event, TimelineItem


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "start", "end", "department", "location"]
    list_filter = ["event_type", "department"]
    search_fields = ["title", "description", "location"]
    filter_horizontal = ["attendees", "influencers"]


@admin.register(TimelineItem)
class TimelineItemAdmin(admin.ModelAdmin):
    list_display = ["name", "start_date", "end_date"]
    search_fields = ["name", "description"]
