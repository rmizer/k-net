from django.contrib import admin

from .models import Challenge, SupplyItem


class SupplyItemInline(admin.TabularInline):
    model = SupplyItem
    extra = 0


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ["name", "date", "show", "week", "status", "updated_at"]
    list_filter = ["status", "show"]
    search_fields = ["name", "description"]
    filter_horizontal = ["participants"]
    inlines = [SupplyItemInline]
