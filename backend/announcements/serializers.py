from rest_framework import serializers

from .models import Alert, Announcement, CallSheet
from .sanitize import clean_call_sheet


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Announcement
        fields = ["id", "title", "body", "pinned", "created_by_name", "created_at", "updated_at"]


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ["id", "message", "level", "expires_at", "created_at"]


class CallSheetSummarySerializer(serializers.ModelSerializer):
    """For the Staff Hub link: no sheet HTML."""

    published_by_name = serializers.CharField(source="published_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = CallSheet
        fields = ["id", "title", "day", "published_by_name", "published_at"]


class CallSheetSerializer(CallSheetSummarySerializer):
    class Meta(CallSheetSummarySerializer.Meta):
        fields = CallSheetSummarySerializer.Meta.fields + ["html"]

    MAX_HTML = 2_000_000

    def validate_html(self, html):
        if len(html) > self.MAX_HTML:
            raise serializers.ValidationError("This call sheet is too large to publish.")
        html = clean_call_sheet(html)
        if not html.strip():
            raise serializers.ValidationError("The call sheet is empty.")
        return html
