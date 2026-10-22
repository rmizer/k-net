from rest_framework import serializers

from accounts.models import User


class PagePersonSerializer(serializers.ModelSerializer):
    """A person as a department page shows them: contact details, no account settings."""

    name = serializers.CharField(source="get_full_name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    is_head = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "first_name",
            "last_name",
            "title",
            "role",
            "role_display",
            "department",
            "department_name",
            "phone",
            "email",
            "profile_picture",
            "is_active_crew",
            "is_head",
        ]

    def get_is_head(self, person):
        return person.pk in self.context.get("head_ids", ())
