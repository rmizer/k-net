from django.contrib import admin

from .models import Location


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "address", "phone"]
    list_filter = ["kind"]
    search_fields = ["name", "address", "notes"]
