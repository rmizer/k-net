import re
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


def format_phone(number):
    """US numbers as (123) 456-7890, however they were typed: 1234567890,
    123.456.7890, +1 123 456 7890... Anything else (international, extensions)
    is kept as entered."""
    number = (number or "").strip()
    digits = re.sub(r"\D", "", number)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10 or re.search(r"[^\d\s().+\-]", number):
        return number
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


class Department(models.Model):
    class Page(models.TextChoices):
        """The department page (Departments menu) a department belongs to. Film
        Crew and Audio share one; departments with no page (e.g. Web Support)
        don't get one."""

        NONE = "", "No department page"
        PRODUCTION = "production", "Production"
        OPERATIONS = "operations", "Operations"
        FINANCE = "finance", "Finance"
        MARKETING = "marketing", "Marketing"
        TRANSPORTATION = "transportation", "Transportation"
        CULINARY = "culinary", "Culinary"
        TECH = "tech", "Tech"
        FILM_AUDIO = "film-audio", "Film & Audio Crew"
        SECURITY = "security", "Security"

    name = models.CharField(max_length=100, unique=True)
    page = models.CharField("department page", max_length=20, choices=Page.choices, blank=True, default="")

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
    # Their job title on the production (e.g. "Executive Producer"), which can
    # differ from the site role that decides what they can open.
    title = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="members"
    )
    # Department heads can be put on a show. The department they head is kept
    # separately from the one they work in; if it's deleted they stay a head,
    # with no department listed.
    is_department_head = models.BooleanField(default=False)
    head_of_department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="heads"
    )
    profile_picture = models.ImageField(upload_to="profile_pictures/", blank=True)
    lodging = models.CharField(max_length=255, blank=True)
    room_number = models.CharField(max_length=20, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)
    # Shown like emergency contacts (to managers and the person themselves);
    # food allergies also go to the Culinary team's Food allergies page.
    allergies = models.TextField("general allergies", blank=True, help_text="Medications, insects, latex, pollen, etc.")
    food_allergies = models.TextField(blank=True, help_text="Every food allergy or intolerance, for the Culinary team.")
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
    # A new email waiting for its confirmation link to be clicked, and when the
    # person last changed their own email (allowed once every EMAIL_CHANGE_INTERVAL).
    pending_email = models.EmailField(blank=True)
    email_changed_at = models.DateTimeField(null=True, blank=True)

    EMAIL_CHANGE_INTERVAL = timedelta(days=14)

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
        self.phone = format_phone(self.phone)
        self.emergency_contact_phone = format_phone(self.emergency_contact_phone)
        super().save(*args, **kwargs)

    @property
    def is_site_manager(self):
        return self.role == self.Role.SITE_MANAGER

    @property
    def is_manager_level(self):
        """Directors, Assistants and Site Managers (who hold all permissions)."""
        return self.role in (self.Role.SITE_MANAGER, self.Role.DIRECTOR, self.Role.ASSISTANT)

    @property
    def is_director_level(self):
        """Directors and Site Managers (not Assistants): they run shows."""
        return self.role in (self.Role.SITE_MANAGER, self.Role.DIRECTOR)

    def can_assign_role(self, role):
        return role in self.ASSIGNABLE_ROLES.get(self.role, set())

    @property
    def next_email_change(self):
        """When this person may change their own email again, or None if they can now."""
        if self.email_changed_at is None:
            return None
        allowed = self.email_changed_at + self.EMAIL_CHANGE_INTERVAL
        return allowed if allowed > timezone.now() else None


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
