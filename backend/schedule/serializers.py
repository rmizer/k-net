import uuid
from datetime import datetime, time, timedelta

from django.db import transaction
from rest_framework import serializers

from accounts.models import Department, User
from core.models import ProductionSettings

from .models import Event, TimelineItem


class EventSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "description",
            "event_type",
            "start",
            "end",
            "all_day",
            "location",
            "department",
            "department_name",
            "attendees",
            "influencers",
            "block",
            "is_mine",
        ]
        read_only_fields = ["block"]

    def get_is_mine(self, event):
        """Whether the signed-in user is attending or it's their department's event,
        so the schedule can highlight it."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.department_id and event.department_id == user.department_id:
            return True
        return any(attendee.pk == user.pk for attendee in event.attendees.all())

    def validate(self, attrs):
        start = attrs.get("start", getattr(self.instance, "start", None))
        end = attrs.get("end", getattr(self.instance, "end", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end": "The end time can't be before the start time."})
        return attrs


class DateRangeSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError("The end date can't be before the start date.")
        return attrs


class BlockScheduleSerializer(serializers.Serializer):
    """One schedule item repeated over date ranges, on chosen weekdays, at the
    same time each day: e.g. Oct 5-9 and Oct 12-16, 9 AM to 5 PM, or Oct 5-30,
    weekdays only. Times are production time; an end time at or before the start
    runs past midnight."""

    MAX_EVENTS = 366

    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    event_type = serializers.ChoiceField(choices=Event.EventType.choices, default=Event.EventType.STAFF)
    location = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True, default=None
    )
    attendees = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), many=True, required=False, default=list
    )
    ranges = DateRangeSerializer(many=True, allow_empty=False)
    # Monday is 0, as in Python's date.weekday().
    weekdays = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6), allow_empty=False
    )
    all_day = serializers.BooleanField(default=False)
    start_time = serializers.TimeField(required=False, allow_null=True, default=None)
    end_time = serializers.TimeField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        if not attrs["all_day"]:
            errors = {}
            if attrs["start_time"] is None:
                errors["start_time"] = "Pick a start time."
            if attrs["end_time"] is None:
                errors["end_time"] = "Pick an end time."
            if errors:
                raise serializers.ValidationError(errors)
        if not attrs["attendees"] and not attrs["department"]:
            raise serializers.ValidationError("Choose at least one person or a department.")

        days = set()
        for date_range in attrs["ranges"]:
            day = date_range["start_date"]
            # Stops once there are too many, so a huge range isn't walked day by day.
            while day <= date_range["end_date"] and len(days) <= self.MAX_EVENTS:
                if day.weekday() in attrs["weekdays"]:
                    days.add(day)
                day += timedelta(days=1)
        days = sorted(days)
        if not days:
            raise serializers.ValidationError({"weekdays": "None of the chosen days fall in those dates."})
        if len(days) > self.MAX_EVENTS:
            raise serializers.ValidationError(
                {"ranges": f"That's {len(days)} days. A block can cover at most {self.MAX_EVENTS}."}
            )
        attrs["days"] = days
        return attrs

    def create(self, validated_data):
        zone = ProductionSettings.load().zone
        block = uuid.uuid4()
        attendees = validated_data["attendees"]
        events = []
        for day in validated_data["days"]:
            if validated_data["all_day"]:
                start = datetime.combine(day, time.min, tzinfo=zone)
                end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
            else:
                start_time, end_time = validated_data["start_time"], validated_data["end_time"]
                start = datetime.combine(day, start_time, tzinfo=zone)
                end_day = day + timedelta(days=1) if end_time <= start_time else day
                end = datetime.combine(end_day, end_time, tzinfo=zone)
            events.append(
                Event(
                    title=validated_data["title"],
                    description=validated_data["description"],
                    event_type=validated_data["event_type"],
                    location=validated_data["location"],
                    department=validated_data["department"],
                    start=start,
                    end=end,
                    all_day=validated_data["all_day"],
                    block=block,
                    created_by=validated_data.get("created_by"),
                )
            )
        with transaction.atomic():
            created = Event.objects.bulk_create(events)
            if attendees:
                Through = Event.attendees.through
                Through.objects.bulk_create(
                    [Through(event_id=event.pk, user_id=person.pk) for event in created for person in attendees]
                )
        return created


class TimelineItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = TimelineItem
        fields = ["id", "name", "start_date", "end_date", "description", "created_by_name", "updated_at"]
        extra_kwargs = {"name": {"error_messages": {"blank": "Give this a name."}}}

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "The end date can't be before the start date."})
        return attrs
