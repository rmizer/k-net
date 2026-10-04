from django.contrib import admin

from .models import Resource


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ["company_name", "category", "contact_name", "phone", "updated_at"]
    list_filter = ["category"]
    search_fields = ["company_name", "contact_name", "address", "notes"]
