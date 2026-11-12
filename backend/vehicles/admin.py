from django.contrib import admin

from .models import Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "license_plate", "ownership", "return_by", "storage_location", "status"]
    list_filter = ["status", "kind", "ownership"]
    search_fields = ["name", "license_plate", "vin", "make_model", "rented_from", "rental_reference"]
    filter_horizontal = ["documents"]
