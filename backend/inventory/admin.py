from django.contrib import admin

from .models import InventoryItem


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ["name", "department", "quantity", "quantity_unit", "storage_location", "expires_on", "deleted_at"]
    list_filter = ["department", "item_type", "quantity_unit"]
    search_fields = ["name", "storage_location", "details", "brand", "model_number", "serial_numbers", "asset_tag"]
