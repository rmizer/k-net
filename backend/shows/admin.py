from django.contrib import admin

from .models import Show


@admin.register(Show)
class ShowAdmin(admin.ModelAdmin):
    list_display = ["name", "status", "director", "start_date"]
    filter_horizontal = ["other_directors", "department_heads"]
