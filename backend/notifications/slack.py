"""Posts K-Net activity to Slack.

Announcements and alerts go to a channel; task assignments go to the assignee
as a direct message from the K-Net bot. Messages are a short summary plus a
link back to K-Net, so details covered by the app's role permissions stay in
the app.

Everything here is a no-op unless SLACK_BOT_TOKEN is set. Messages are sent on
a background thread after the database commit, and failures are logged rather
than raised, so Slack being slow or down never affects a request.
"""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.db import connection, transaction

logger = logging.getLogger(__name__)

API_URL = "https://slack.com/api/"
TIMEOUT_SECONDS = 10
PREVIEW_LENGTH = 300

ALERT_PREFIXES = {
    "info": ":information_source:",
    "warning": ":warning:",
    "urgent": ":rotating_light: *URGENT*",
}

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="slack")


class SlackError(Exception):
    pass


def is_enabled():
    return bool(settings.SLACK_BOT_TOKEN)


def escape(text):
    """Escapes the characters Slack treats as markup."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def app_link(path, label):
    """A Slack link to a page in K-Net, or just the label if SITE_URL isn't set."""
    if not settings.SITE_URL:
        return label
    return f"<{settings.SITE_URL.rstrip('/')}{path}|{label}>"


def call(method, payload, http_method="POST"):
    """Calls a Slack Web API method and returns its response. Raises SlackError."""
    headers = {"Authorization": f"Bearer {settings.SLACK_BOT_TOKEN}"}
    url = API_URL + method
    data = None
    if http_method == "GET":
        url += "?" + urllib.parse.urlencode(payload)
    else:
        headers["Content-Type"] = "application/json; charset=utf-8"
        data = json.dumps(payload).encode()
    request = urllib.request.Request(url, data=data, headers=headers, method=http_method)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            body = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, ValueError) as err:
        raise SlackError(f"{method}: {err}") from err
    if not body.get("ok"):
        raise SlackError(f"{method}: {body.get('error', 'unknown error')}")
    return body


def post_message(channel, text):
    call("chat.postMessage", {"channel": channel, "text": text, "unfurl_links": False})


def lookup_user_id(email):
    """The Slack member ID for an email address, or None if nobody in the workspace has it."""
    try:
        return call("users.lookupByEmail", {"email": email}, http_method="GET")["user"]["id"]
    except SlackError as err:
        if "users_not_found" in str(err):
            return None
        raise


def _run(job, *args):
    try:
        job(*args)
    except Exception:
        logger.exception("Slack notification failed")
    finally:
        # Each worker thread gets its own database connection; don't leave it open.
        connection.close()


def _dispatch(job, *args):
    """Runs `job` on a background thread once the current transaction commits."""
    if is_enabled():
        transaction.on_commit(lambda: _executor.submit(_run, job, *args))


# Jobs (run on the background thread)


def _post_to_channel(channel, text):
    if channel:
        post_message(channel, text)


def _direct_message(user_id, email, slack_user_id, text):
    from accounts.models import User

    if not slack_user_id:
        slack_user_id = lookup_user_id(email)
        if not slack_user_id:
            logger.info("No Slack account found for %s; skipping direct message.", email)
            return
        User.objects.filter(pk=user_id).update(slack_user_id=slack_user_id)
    post_message(slack_user_id, text)


# Notifications (called from views)


def notify_announcement(announcement):
    lines = [f":mega: *New announcement: {escape(announcement.title)}*"]
    body = announcement.body.strip()
    if body:
        if len(body) > PREVIEW_LENGTH:
            body = body[:PREVIEW_LENGTH].rstrip() + "…"
        lines.append(escape(body))
    lines.append(app_link("/", "View on the K-Net dashboard"))
    _dispatch(_post_to_channel, settings.SLACK_ANNOUNCEMENTS_CHANNEL, "\n".join(lines))


def notify_alert(alert):
    prefix = ALERT_PREFIXES.get(alert.level, ALERT_PREFIXES["info"])
    text = f"{prefix} {escape(alert.message)}\n{app_link('/', 'View on the K-Net dashboard')}"
    _dispatch(_post_to_channel, settings.SLACK_ALERTS_CHANNEL, text)


def notify_task_assigned(task):
    user = task.assigned_to
    if user is None or not user.is_active or not user.slack_notifications:
        return
    lines = [f":clipboard: *You've been assigned a task: {escape(task.title)}*"]
    details = []
    if task.due_date:
        details.append(f"Due {task.due_date:%a %b} {task.due_date.day}")
    if task.priority == task.Priority.HIGH:
        details.append("High priority")
    if task.created_by:
        details.append(f"From {escape(task.created_by.get_full_name())}")
    if details:
        lines.append(" · ".join(details))
    lines.append(app_link("/schedule/tasks", "Open My Tasks in K-Net"))
    _dispatch(_direct_message, user.pk, user.email, user.slack_user_id, "\n".join(lines))
