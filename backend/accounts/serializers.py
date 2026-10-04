import secrets

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Department, User


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]

    def validate_name(self, name):
        name = name.strip()
        existing = Department.objects.filter(name__iexact=name)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("A department with this name already exists.")
        return name


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
        extra_kwargs = {
            # Uniqueness is checked in validate_email, with clearer messages.
            "email": {"validators": []},
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
        }

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
        # Shown once, right after creating an account without choosing a password.
        temporary_password = getattr(instance, "_temporary_password", None)
        if temporary_password:
            data["temporary_password"] = temporary_password
        return data

    def validate_email(self, email):
        email = User.objects.normalize_email(email).lower()
        existing = User.objects.filter(email__iexact=email)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        match = existing.first()
        if match is not None:
            if not match.is_active:
                raise serializers.ValidationError(
                    "This email belongs to a removed account. A Site Manager can restore it from the admin."
                )
            raise serializers.ValidationError("An account with this email already exists.")
        return email

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
        temporary_password = None
        if not password:
            temporary_password = secrets.token_urlsafe(9)
            password = temporary_password
        user = User.objects.create_user(password=password, **validated_data)
        user._temporary_password = temporary_password
        return user

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

    # Roles this person may give others, so the app only offers those choices.
    assignable_roles = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = [f for f in UserSerializer.Meta.fields if f != "password"] + ["assignable_roles"]
        read_only_fields = ["email", "role", "department", "is_active_crew", "profile_picture"]

    def get_assignable_roles(self, user):
        return [role for role in User.Role.values if user.can_assign_role(role)]


class ProfilePictureSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(required=True)

    class Meta:
        model = User
        fields = ["profile_picture"]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)
