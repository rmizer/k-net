from django.contrib import admin

from .models import Influencer, InfluencerNote, TravelArrangement


class NoteInline(admin.TabularInline):
    model = InfluencerNote
    extra = 0
    readonly_fields = ["author", "created_at"]


class TravelInline(admin.StackedInline):
    model = TravelArrangement
    extra = 0


@admin.register(Influencer)
class InfluencerAdmin(admin.ModelAdmin):
    list_display = ["name", "handle", "platform", "agent_name", "is_active"]
    list_filter = ["platform", "is_active"]
    search_fields = ["name", "handle", "agent_name"]
    inlines = [NoteInline, TravelInline]
