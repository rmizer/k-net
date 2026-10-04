from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import Tracker, TrackerPing


def _coordinate(value):
    return Decimal(str(round(value, 6)))


class PingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrackerPing
        fields = ["latitude", "longitude", "accuracy_m", "note", "source", "recorded_at"]


class PingInputSerializer(serializers.Serializer):
    """A location report, from a device (with the tracker's key) or a Site Manager."""

    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy_m = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    note = serializers.CharField(max_length=150, required=False, allow_blank=True)
    recorded_at = serializers.DateTimeField(required=False)

    def validate_recorded_at(self, value):
        if value > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError("The time can't be in the future.")
        return value

    def save_for(self, tracker, source):
        data = self.validated_data
        return TrackerPing.objects.create(
            tracker=tracker,
            latitude=_coordinate(data["latitude"]),
            longitude=_coordinate(data["longitude"]),
            accuracy_m=data.get("accuracy_m"),
            note=data.get("note", ""),
            source=source,
            recorded_at=data.get("recorded_at") or timezone.now(),
        )


class TrackerSerializer(serializers.ModelSerializer):
    """Full tracker details, for Site Managers."""

    person_name = serializers.CharField(source="person.get_full_name", read_only=True)
    tracker_type_display = serializers.CharField(source="get_tracker_type_display", read_only=True)
    last_ping = serializers.SerializerMethodField()

    class Meta:
        model = Tracker
        fields = [
            "id",
            "person",
            "person_name",
            "tracker_type",
            "tracker_type_display",
            "label",
            "identifier",
            "is_active",
            "created_at",
            "last_ping",
        ]
        # Explicit default so form posts that omit the box don't create inactive trackers.
        extra_kwargs = {
            "is_active": {"default": True},
            "person": {"error_messages": {"null": "Choose a person.", "required": "Choose a person."}},
        }

    def get_last_ping(self, tracker):
        # List views pass every tracker's latest ping in the context to avoid a query per row.
        latest = self.context.get("latest_pings")
        ping = latest.get(tracker.pk) if latest is not None else tracker.latest_ping
        return PingSerializer(ping).data if ping else None

    def validate_person(self, person):
        if not person.is_active:
            raise serializers.ValidationError("That account has been removed.")
        return person
