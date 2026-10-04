from rest_framework import serializers

from .models import Event


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
            "is_mine",
        ]

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
