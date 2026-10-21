from django.contrib import admin

from .models import MeetingNote


@admin.register(MeetingNote)
class MeetingNoteAdmin(admin.ModelAdmin):
    list_display = ["__str__", "meeting_at", "created_by", "updated_at"]
    filter_horizontal = ["attendees"]
