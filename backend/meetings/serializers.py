from rest_framework import serializers

from accounts.models import User

from .models import MeetingNote


class MeetingNoteSerializer(serializers.ModelSerializer):
    attendees = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True, required=False)
    attendee_names = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)
    updated_by_name = serializers.CharField(source="updated_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = MeetingNote
        fields = [
            "id",
            "title",
            "meeting_at",
            "attendees",
            "attendee_names",
            "notes",
            "created_by_name",
            "updated_by_name",
            "created_at",
            "updated_at",
        ]

    def get_attendee_names(self, note):
        return sorted(person.get_full_name() for person in note.attendees.all())
