from django.conf import settings
from django.db import models


class SupportRequest(models.Model):
    """A message from the Contact page. Each one is emailed to the support
    address and kept here too, so nothing is lost if the email fails."""

    class Kind(models.TextChoices):
        BUG = "bug", "Bug report"
        FEATURE = "feature", "Feature request"
        QUESTION = "question", "Tech support question"
        FEEDBACK = "feedback", "Feedback"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    subject = models.CharField(max_length=150)
    message = models.TextField()
    # Bug reports: where it happened and what the person expected instead.
    page = models.CharField(max_length=255, blank=True, help_text="Where in K-Net it happened.")
    expected = models.TextField(blank=True, help_text="What the person expected to happen.")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="support_requests"
    )
    user_agent = models.CharField(max_length=500, blank=True)
    emailed = models.BooleanField(default=False, help_text="Whether the email to support was sent.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"#{self.pk} {self.get_kind_display()}: {self.subject}"
