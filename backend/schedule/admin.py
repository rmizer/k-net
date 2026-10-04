from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "start", "end", "department", "location"]
    list_filter = ["event_type", "department"]
    search_fields = ["title", "description", "location"]
    filter_horizontal = ["attendees"]
