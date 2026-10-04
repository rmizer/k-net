from rest_framework import serializers

from .models import Alert, Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Announcement
        fields = ["id", "title", "body", "pinned", "created_by_name", "created_at", "updated_at"]


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ["id", "message", "level", "expires_at", "created_at"]
