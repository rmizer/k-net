from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Department, User


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])

    EMERGENCY_FIELDS = ("emergency_contact_name", "emergency_contact_phone")

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "role_display",
            "department",
            "department_name",
            "profile_picture",
            "lodging",
            "emergency_contact_name",
            "emergency_contact_phone",
            "is_active_crew",
            "password",
        ]
        read_only_fields = ["profile_picture"]

    def _viewer(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        viewer = self._viewer()
        # Emergency contacts are visible only to Directors / Assistants (and Site
        # Managers), plus the person themselves.
        if not (viewer and (viewer.is_manager_level or viewer.pk == instance.pk)):
            for field in self.EMERGENCY_FIELDS:
                data.pop(field, None)
        return data

    def validate_role(self, role):
        viewer = self._viewer()
        unchanged = self.instance is not None and self.instance.role == role
        if not unchanged and not (viewer and viewer.can_assign_role(role)):
            raise serializers.ValidationError("You don't have permission to assign this role.")
        return role

    def validate(self, attrs):
        viewer = self._viewer()
        # Managers can't edit accounts above their own level (e.g. a Director
        # editing another Director or a Site Manager).
        if self.instance is not None and viewer and self.instance.pk != viewer.pk:
            if not viewer.can_assign_role(self.instance.role):
                raise serializers.ValidationError("You don't have permission to edit this account.")
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ProfileSerializer(UserSerializer):
    """The signed-in user's own account. Role, department and crew status are
    managed by Directors / Assistants, so they're read-only here."""

    class Meta(UserSerializer.Meta):
        fields = [f for f in UserSerializer.Meta.fields if f != "password"]
        read_only_fields = ["email", "role", "department", "is_active_crew", "profile_picture"]


class ProfilePictureSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(required=True)

    class Meta:
        model = User
        fields = ["profile_picture"]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)
