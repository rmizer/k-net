from rest_framework import serializers

from .models import IncidentAttachment, IncidentReport

# Only the Security head(s) and managers set these.
REVIEW_FIELDS = {"status", "resolution"}


class IncidentAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    file_name = serializers.CharField(read_only=True)
    kind = serializers.CharField(read_only=True)
    size = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = IncidentAttachment
        fields = ["id", "url", "file_name", "kind", "size", "caption", "uploaded_by", "uploaded_by_name", "created_at"]
        read_only_fields = ["uploaded_by"]

    def get_url(self, attachment):
        return f"/api/incident-attachments/{attachment.pk}/file/"

    def get_size(self, attachment):
        try:
            return attachment.file.size
        except (FileNotFoundError, OSError):
            return None


class IncidentReportSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.get_full_name", read_only=True, default=None)
    can_edit = serializers.SerializerMethodField()
    attachments = IncidentAttachmentSerializer(many=True, read_only=True)
    alerted = serializers.SerializerMethodField()

    class Meta:
        model = IncidentReport
        fields = [
            "id",
            "title",
            "category",
            "category_display",
            "severity",
            "severity_display",
            "occurred_at",
            "location",
            "description",
            "people_involved",
            "witnesses",
            "actions_taken",
            "police_called",
            "police_report_number",
            "status",
            "status_display",
            "resolution",
            "reported_by",
            "reported_by_name",
            "can_edit",
            "attachments",
            "alerted",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["reported_by"]
        extra_kwargs = {
            "title": {"error_messages": {"blank": "Sum up the incident in a few words."}},
            "location": {"error_messages": {"blank": "Where did it happen?"}},
            "description": {"error_messages": {"blank": "Describe what happened."}},
            "occurred_at": {
                "error_messages": {"null": "When did it happen?", "invalid": "When did it happen?"}
            },
        }

    def get_alerted(self, report):
        """Managers were alerted about it (High and Critical reports)."""
        return bool(report.alerted_severity)

    def get_can_edit(self, report):
        view = self.context.get("view")
        return bool(view and view.can_change(report))

    def validate(self, attrs):
        if not attrs.get("police_called", getattr(self.instance, "police_called", False)):
            attrs["police_report_number"] = ""
        return attrs
