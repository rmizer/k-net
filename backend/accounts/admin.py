from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Department, User


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["last_name", "first_name"]
    list_display = ["email", "first_name", "last_name", "role", "department", "is_active_crew", "is_active"]
    list_filter = ["role", "department", "is_active_crew", "email_verified", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Personal info", {"fields": ["first_name", "last_name", "phone", "profile_picture"]}),
        ("Role & crew", {"fields": ["role", "department", "is_active_crew", "lodging", "room_number"]}),
        ("Emergency contact", {"fields": ["emergency_contact_name", "emergency_contact_phone"]}),
        (
            "Slack",
            {
                "fields": ["slack_notifications", "slack_user_id"],
                "description": "The Slack member ID is found by email automatically. Set it here only "
                "if this person's Slack email is different from their K-Net email.",
            },
        ),
        ("Status", {"fields": ["is_active", "email_verified", "privacy_accepted_at", "last_login", "date_joined"]}),
    ]
    add_fieldsets = [
        (
            None,
            {
                "classes": ["wide"],
                "fields": ["email", "first_name", "last_name", "role", "password1", "password2"],
            },
        ),
    ]
    readonly_fields = ["last_login", "date_joined", "privacy_accepted_at"]
