from django.utils import timezone
from rest_framework import serializers

from schedule.models import Event

from .models import Influencer, InfluencerNote, TravelArrangement


class InfluencerNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = InfluencerNote
        fields = ["id", "influencer", "body", "author_name", "created_at", "updated_at"]
        extra_kwargs = {"body": {"error_messages": {"blank": "Write a note first."}}}

    def get_author_name(self, note):
        return note.author.get_full_name() if note.author else None


class TravelArrangementSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = TravelArrangement
        fields = [
            "id",
            "influencer",
            "kind",
            "kind_display",
            "provider",
            "reference",
            "confirmation",
            "depart_location",
            "arrive_location",
            "starts_at",
            "ends_at",
            "notes",
        ]

    def validate(self, attrs):
        starts = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts and ends and ends < starts:
            raise serializers.ValidationError({"ends_at": "This can't be before the start."})
        return attrs


class InfluencerEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ["id", "title", "start", "end", "all_day", "location"]


class InfluencerListSerializer(serializers.ModelSerializer):
    platform_display = serializers.CharField(source="get_platform_display", read_only=True)
    show_name = serializers.CharField(source="show.name", read_only=True, default=None)

    class Meta:
        model = Influencer
        fields = [
            "id",
            "name",
            "handle",
            "platform",
            "platform_display",
            "photo",
            "show",
            "show_name",
            "season",
            "week",
            "is_active",
        ]
        read_only_fields = ["photo"]
        extra_kwargs = {
            "season": {"error_messages": {"invalid": "Enter a whole number."}},
            "week": {"error_messages": {"invalid": "Enter a whole number."}},
        }


class InfluencerRowSerializer(InfluencerListSerializer):
    """A row in the roster table: the summary plus contact details and counts
    (annotated by the view)."""

    travel_count = serializers.IntegerField(read_only=True)
    next_travel_at = serializers.DateTimeField(read_only=True, allow_null=True)
    next_event_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta(InfluencerListSerializer.Meta):
        fields = InfluencerListSerializer.Meta.fields + [
            "phone",
            "email",
            "agent_name",
            "travel_count",
            "next_travel_at",
            "next_event_at",
        ]


class InfluencerSerializer(InfluencerListSerializer):
    """Full profile, with notes, travel and upcoming schedule."""

    notes = InfluencerNoteSerializer(many=True, read_only=True)
    travel = TravelArrangementSerializer(many=True, read_only=True)
    upcoming_events = serializers.SerializerMethodField()

    class Meta(InfluencerListSerializer.Meta):
        fields = InfluencerListSerializer.Meta.fields + [
            "phone",
            "email",
            "address",
            "agent_name",
            "agent_phone",
            "agent_email",
            "travel_needs",
            "lodging_needs",
            "needs",
            "notes",
            "travel",
            "upcoming_events",
        ]

    def get_upcoming_events(self, influencer):
        events = influencer.events.filter(end__gte=timezone.now()).order_by("start")[:20]
        return InfluencerEventSerializer(events, many=True).data

    def validate_name(self, name):
        name = name.strip()
        existing = Influencer.objects.filter(name__iexact=name)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("An influencer with this name is already on the roster.")
        return name

    def validate_handle(self, handle):
        return handle.strip().lstrip("@")


class InfluencerPhotoSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(required=True)

    class Meta:
        model = Influencer
        fields = ["photo"]
