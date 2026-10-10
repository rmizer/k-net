from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    """Users sign in with their email address instead of a username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.STAFF)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields["role"] = User.Role.SITE_MANAGER
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        SITE_MANAGER = "site_manager", "Site Manager"
        DIRECTOR = "director", "Director"
        ASSISTANT = "assistant", "Assistant"
        STAFF = "staff", "Staff"

    # Roles each role may assign when creating or editing another account.
    # Site Managers create Directors and Assistants; Directors and Assistants
    # share permissions and can create Assistants and Staff, but not Directors.
    ASSIGNABLE_ROLES = {
        Role.SITE_MANAGER: {Role.SITE_MANAGER, Role.DIRECTOR, Role.ASSISTANT, Role.STAFF},
        Role.DIRECTOR: {Role.ASSISTANT, Role.STAFF},
        Role.ASSISTANT: {Role.ASSISTANT, Role.STAFF},
        Role.STAFF: set(),
    }

    username = None
    email = models.EmailField("email address", unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STAFF)
    phone = models.CharField(max_length=30, blank=True)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="members"
    )
    profile_picture = models.ImageField(upload_to="profile_pictures/", blank=True)
    lodging = models.CharField(max_length=255, blank=True)
    room_number = models.CharField(max_length=20, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)
    # Whether this person is on the active crew (shown on the Staff / Crew page).
    is_active_crew = models.BooleanField(default=False)
    # False only for people who signed up themselves and haven't clicked the
    # link in their verification email yet. Accounts managers create are trusted.
    email_verified = models.BooleanField(default=True)
    # When the person agreed to the privacy statement on the sign-up form.
    privacy_accepted_at = models.DateTimeField(null=True, blank=True)
    # Slack member ID, found by email the first time K-Net messages this person.
    slack_user_id = models.CharField(max_length=20, blank=True)
    # Set when they say they've joined the Slack workspace (or finish that task).
    slack_joined = models.BooleanField(default=False)
    slack_notifications = models.BooleanField(
        default=True, help_text="Send this person a Slack message when they're assigned a task."
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return self.get_full_name() or self.email

    def save(self, *args, **kwargs):
        # Only Site Managers get into the Django admin (the footer's Dev Login).
        self.is_staff = self.role == self.Role.SITE_MANAGER
        self.is_superuser = self.role == self.Role.SITE_MANAGER
        super().save(*args, **kwargs)

    @property
    def is_site_manager(self):
        return self.role == self.Role.SITE_MANAGER

    @property
    def is_manager_level(self):
        """Directors, Assistants and Site Managers (who hold all permissions)."""
        return self.role in (self.Role.SITE_MANAGER, self.Role.DIRECTOR, self.Role.ASSISTANT)

    def can_assign_role(self, role):
        return role in self.ASSIGNABLE_ROLES.get(self.role, set())


class RemovalRequest(models.Model):
    """A Director or Assistant asking a Site Manager to remove someone. Only
    Site Managers can delete (deactivate) accounts."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Removed"
        DISMISSED = "dismissed", "Dismissed"

    person = models.ForeignKey(User, on_delete=models.CASCADE, related_name="removal_requests")
    requested_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Remove {self.person}"
