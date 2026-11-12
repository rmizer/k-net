"""Alerts for High and Critical incident reports.

Site Managers, Directors, Assistants and the Security head(s) get a Slack direct
message (if they have Slack notifications on) and an email. Both are a short
summary and a link: the details stay in K-Net, behind its permissions.
"""

import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import Department, User
from core.models import ProductionSettings
from notifications import slack

logger = logging.getLogger(__name__)

MANAGER_ROLES = [User.Role.SITE_MANAGER, User.Role.DIRECTOR, User.Role.ASSISTANT]


def recipients(report):
    people = User.objects.filter(is_active=True).filter(
        Q(role__in=MANAGER_ROLES) | Q(is_department_head=True, head_of_department__page=Department.Page.SECURITY)
    )
    if report.reported_by_id:
        people = people.exclude(pk=report.reported_by_id)
    return list(people.distinct())


def report_path(report):
    return f"/departments/security/incidents/{report.pk}"


def _when(report):
    """When it happened, in the production's time zone, e.g. "Wed Dec 2, 10:15 PM EST"."""
    when = timezone.localtime(report.occurred_at, ProductionSettings.load().zone)
    hour = int(f"{when:%I}")
    return f"{when:%a %b} {when.day}, {hour}:{when:%M %p %Z}"


def send(report):
    """Alerts about this report if it needs it, and remembers that it did."""
    if not report.needs_alert():
        return False
    people = recipients(report)
    report.alerted_severity = report.severity
    report.save(update_fields=["alerted_severity"])

    severity = report.get_severity_display().upper()
    details = [
        f"{report.get_category_display()} · {_when(report)}",
        f"Where: {report.location}",
    ]
    if report.reported_by:
        details.append(f"Filed by {report.reported_by.get_full_name()}")

    slack_lines = [
        f":rotating_light: *{severity} security incident: {slack.escape(report.title)}*",
        *(slack.escape(line) for line in details),
        slack.app_link(report_path(report), "Open the incident report in K-Net"),
    ]
    slack_recipients = [(p.pk, p.email, p.slack_user_id) for p in people if p.slack_notifications]
    if slack_recipients:
        slack._dispatch(slack._direct_messages, slack_recipients, "\n".join(slack_lines))

    emails = [p.email for p in people if p.email]
    if emails:
        body = "\n".join(
            [
                f"A {severity} security incident was reported on K-Net.",
                "",
                report.title,
                *details,
                "",
                "Open the full report (only the Security team and managers can see it):",
                f"{settings.SITE_URL.rstrip('/')}{report_path(report)}",
            ]
        )
        message = EmailMessage(
            subject=f"[K-Net] {severity} security incident: {report.title}",
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            # Everyone in Bcc, so the list of recipients isn't shared around.
            to=[settings.SUPPORT_EMAIL],
            bcc=emails,
        )
        transaction.on_commit(lambda: _send_email(message))
    return True


def _send_email(message):
    try:
        message.send()
    except Exception:
        # Email being down must never stop a report from being filed.
        logger.exception("Incident alert email failed")
