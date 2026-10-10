"""Tasks every new account starts with."""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import Task


def join_slack_description():
    return (
        f"Join the K-Net Slack workspace: {settings.SLACK_INVITE_URL}\n\n"
        "Slack is where the crew talks day to day. Sign up with the same email you use for K-Net "
        "so your task messages reach you. Mark this done once you're in."
    )


def add_starter_tasks(user):
    """Called when someone signs up or a manager adds them. Safe to call twice."""
    if not settings.SLACK_INVITE_URL or user.slack_joined:
        return
    Task.objects.get_or_create(
        assigned_to=user,
        key=Task.Key.JOIN_SLACK,
        defaults={
            "title": "Join the K-Net Slack",
            "description": join_slack_description(),
            "priority": Task.Priority.HIGH,
            "due_date": timezone.localdate() + timedelta(days=2),
        },
    )
