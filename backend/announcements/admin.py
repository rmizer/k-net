from django.contrib import admin

from .models import Alert, Announcement, CallSheet


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ["title", "pinned", "created_by", "created_at"]
    list_filter = ["pinned"]
    search_fields = ["title", "body"]


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ["message", "level", "expires_at", "created_at"]
    list_filter = ["level"]


@admin.register(CallSheet)
class CallSheetAdmin(admin.ModelAdmin):
    list_display = ["title", "day", "published_by", "published_at"]
    readonly_fields = ["html"]
