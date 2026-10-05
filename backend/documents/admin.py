from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "uploaded_by", "status", "amount", "created_at"]
    list_filter = ["category", "status"]
    search_fields = ["title", "vendor", "notes"]
