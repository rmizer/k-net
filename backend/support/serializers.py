from rest_framework import serializers

from .models import SupportRequest


class SupportRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportRequest
        fields = ["id", "kind", "subject", "message", "page", "expected", "created_at"]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            "subject": {"error_messages": {"blank": "Add a short subject."}},
            "message": {"error_messages": {"blank": "Tell us a bit more."}},
        }
