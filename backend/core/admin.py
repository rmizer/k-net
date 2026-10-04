from django.contrib import admin

from .models import ProductionSettings


@admin.register(ProductionSettings)
class ProductionSettingsAdmin(admin.ModelAdmin):
    list_display = ["name", "location_name", "time_zone", "units"]

    def has_add_permission(self, request):
        return not ProductionSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
