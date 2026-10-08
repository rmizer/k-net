from django.contrib import admin

from .models import SupportRequest


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "kind", "subject", "user", "emailed", "created_at"]
    list_filter = ["kind", "emailed"]
    search_fields = ["subject", "message", "user__email", "user__first_name", "user__last_name"]
    readonly_fields = ["created_at"]
