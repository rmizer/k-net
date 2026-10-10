import secrets

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from notifications import slack

from .models import Department, User


class DepartmentSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Department
        fields = ["id", "name", "member_count"]

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
    ACCOUNT_FIELDS = ("email_verified", "date_joined", "last_login")

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
            "email_verified",
            "date_joined",
            "last_login",
            "password",
        ]
        read_only_fields = ["profile_picture", "email_verified", "date_joined", "last_login"]
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
        # Account activity is for Site Managers (and the person themselves).
        if not (viewer and (viewer.is_site_manager or viewer.pk == instance.pk)):
            for field in self.ACCOUNT_FIELDS:
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
        if not unchanged and viewer and self.instance is not None and self.instance.pk == viewer.pk:
            raise serializers.ValidationError("You can't change your own role.")
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
        from tasks.onboarding import add_starter_tasks

        password = validated_data.pop("password", None)
        temporary_password = None
        if not password:
            temporary_password = secrets.token_urlsafe(9)
            password = temporary_password
        user = User.objects.create_user(password=password, **validated_data)
        user._temporary_password = temporary_password
        add_starter_tasks(user)
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
    # Whether the server has Slack set up, so the app only offers the setting then.
    slack_available = serializers.SerializerMethodField()
    slack_invite_url = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = [f for f in UserSerializer.Meta.fields if f != "password"] + [
            "slack_joined",
            "slack_notifications",
            "assignable_roles",
            "slack_available",
            "slack_invite_url",
        ]
        read_only_fields = ["email", "role", "department", "is_active_crew", "profile_picture"]

    def get_assignable_roles(self, user):
        return [role for role in User.Role.values if user.can_assign_role(role)]

    def get_slack_available(self, user):
        return slack.is_enabled()

    def get_slack_invite_url(self, user):
        return settings.SLACK_INVITE_URL


class ProfilePictureSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(required=True)

    class Meta:
        model = User
        fields = ["profile_picture"]


class SignupSerializer(serializers.Serializer):
    """The public sign-up form. Everyone who signs up starts as Staff."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    phone = serializers.CharField(max_length=30)
    accept_privacy = serializers.BooleanField()
    # Hidden from people on the form; bots that fill in every field get caught.
    website = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, email):
        email = User.objects.normalize_email(email).lower()
        existing = User.objects.filter(email__iexact=email).first()
        # Signing up again before verifying just sends a fresh link.
        if existing is not None and (existing.email_verified or not existing.is_active):
            raise serializers.ValidationError("An account with this email already exists. Try logging in.")
        return email

    def validate_accept_privacy(self, accepted):
        if not accepted:
            raise serializers.ValidationError("Please confirm you've read the privacy statement.")
        return accepted

    def validate(self, attrs):
        candidate = User(email=attrs["email"], first_name=attrs["first_name"], last_name=attrs["last_name"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as err:
            raise serializers.ValidationError({"password": list(err.messages)}) from err
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)
