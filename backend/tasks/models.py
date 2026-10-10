from django.conf import settings
from django.db import models
from django.utils import timezone


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To do"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"

    class Key(models.TextChoices):
        """Marks tasks K-Net creates itself, so finishing one can update the account."""

        NONE = "", "None"
        JOIN_SLACK = "join_slack", "Join the K-Net Slack"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # A task can go to one person, to a whole department, or both.
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )
    department = models.ForeignKey(
        "accounts.Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.TODO)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_tasks"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    key = models.CharField(max_length=40, choices=Key.choices, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["status", models.F("due_date").asc(nulls_last=True), "-created_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.status == self.Status.DONE and self.completed_at is None:
            self.completed_at = timezone.now()
        elif self.status != self.Status.DONE:
            self.completed_at = None
        super().save(*args, **kwargs)
        # Finishing "Join the K-Net Slack" also hides the Slack band on their Staff Hub.
        if self.key == self.Key.JOIN_SLACK and self.status == self.Status.DONE and self.assigned_to_id:
            type(self.assigned_to).objects.filter(pk=self.assigned_to_id, slack_joined=False).update(
                slack_joined=True
            )

    @property
    def is_overdue(self):
        return (
            self.status != self.Status.DONE
            and self.due_date is not None
            and self.due_date < timezone.localdate()
        )
