from unittest import mock

from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import Department, User
from accounts.tests import make_user
from tasks.models import Task

from . import slack

SLACK_SETTINGS = {
    "SLACK_BOT_TOKEN": "xoxb-test",
    "SLACK_ANNOUNCEMENTS_CHANNEL": "#announcements",
    "SLACK_ALERTS_CHANNEL": "#alerts",
    "SITE_URL": "https://knet.example.com",
}


class InlineExecutor:
    """Runs submitted jobs right away instead of on a background thread."""

    def submit(self, fn, *args):
        fn(*args)


@override_settings(**SLACK_SETTINGS)
class SlackNotificationTests(APITestCase):
    def setUp(self):
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.client.force_authenticate(self.director)
        self.calls = []
        self.slack_users = {"staff@test.com": "U123"}
        for target, value in [
            ("_executor", InlineExecutor()),
            # The worker closes its database connection; keep the test's open.
            ("connection", mock.Mock()),
            ("call", self.fake_call),
        ]:
            patcher = mock.patch.object(slack, target, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def fake_call(self, method, payload, http_method="POST"):
        self.calls.append((method, payload))
        if method == "users.lookupByEmail":
            if payload["email"] not in self.slack_users:
                raise slack.SlackError("users.lookupByEmail: users_not_found")
            return {"ok": True, "user": {"id": self.slack_users[payload["email"]]}}
        return {"ok": True}

    def messages(self):
        return [payload for method, payload in self.calls if method == "chat.postMessage"]

    def post(self, url, data):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def patch(self, url, data):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(url, data, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def test_announcement_posts_to_channel(self):
        self.post("/api/announcements/", {"title": "Call time <7am>", "body": "Bring layers."})
        [message] = self.messages()
        self.assertEqual(message["channel"], "#announcements")
        self.assertIn("Call time &lt;7am&gt;", message["text"])
        self.assertIn("Bring layers.", message["text"])
        self.assertIn("<https://knet.example.com/|", message["text"])

    def test_alert_posts_to_alerts_channel(self):
        self.post("/api/alerts/", {"message": "Lightning on set", "level": "urgent"})
        [message] = self.messages()
        self.assertEqual(message["channel"], "#alerts")
        self.assertIn("URGENT", message["text"])

    def test_task_assignment_sends_direct_message(self):
        self.post("/api/tasks/", {"title": "Load the truck", "assigned_to": self.staff.pk, "priority": "high"})
        [message] = self.messages()
        self.assertEqual(message["channel"], "U123")
        self.assertIn("Load the truck", message["text"])
        self.assertIn("High priority", message["text"])
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.slack_user_id, "U123")

    def test_saved_slack_id_skips_lookup(self):
        self.staff.slack_user_id = "U999"
        self.staff.save()
        self.post("/api/tasks/", {"title": "Load the truck", "assigned_to": self.staff.pk})
        self.assertEqual([method for method, _ in self.calls], ["chat.postMessage"])
        self.assertEqual(self.messages()[0]["channel"], "U999")

    def test_no_message_when_person_turned_slack_off(self):
        self.staff.slack_notifications = False
        self.staff.save()
        self.post("/api/tasks/", {"title": "Load the truck", "assigned_to": self.staff.pk})
        self.assertEqual(self.calls, [])

    def test_no_message_for_department_or_own_tasks(self):
        tech = Department.objects.create(name="Tech")
        self.post("/api/tasks/", {"title": "Mine", "assigned_to": self.director.pk})
        self.post("/api/tasks/", {"title": "Department", "department": tech.pk})
        self.assertEqual(self.calls, [])

    def test_person_not_in_slack_is_skipped(self):
        other = make_user("other@test.com", User.Role.STAFF)
        self.post("/api/tasks/", {"title": "Load the truck", "assigned_to": other.pk})
        self.assertEqual(self.messages(), [])

    def test_only_reassignment_sends_a_message(self):
        task = Task.objects.create(title="Load the truck", assigned_to=self.director)
        self.patch(f"/api/tasks/{task.pk}/", {"priority": "high"})
        self.assertEqual(self.calls, [])
        self.patch(f"/api/tasks/{task.pk}/", {"assigned_to": self.staff.pk})
        self.assertEqual(len(self.messages()), 1)
        self.patch(f"/api/tasks/{task.pk}/", {"title": "Load the van"})
        self.assertEqual(len(self.messages()), 1)

    def test_slack_failure_does_not_break_the_request(self):
        def failing_call(method, payload, http_method="POST"):
            raise slack.SlackError("chat.postMessage: channel_not_found")

        with mock.patch.object(slack, "call", failing_call), self.assertLogs("notifications.slack", "ERROR"):
            self.post("/api/announcements/", {"title": "Wrap party"})

    @override_settings(SLACK_BOT_TOKEN="")
    def test_nothing_sent_without_a_token(self):
        self.post("/api/announcements/", {"title": "Wrap party"})
        self.post("/api/tasks/", {"title": "Load the truck", "assigned_to": self.staff.pk})
        self.assertEqual(self.calls, [])


class SlackProfileTests(APITestCase):
    def setUp(self):
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.client.force_authenticate(self.staff)

    def test_profile_reports_whether_slack_is_set_up(self):
        self.assertFalse(self.client.get("/api/auth/me/").data["slack_available"])
        with override_settings(SLACK_BOT_TOKEN="xoxb-test"):
            self.assertTrue(self.client.get("/api/auth/me/").data["slack_available"])

    def test_person_can_turn_slack_messages_off(self):
        response = self.client.patch("/api/auth/me/", {"slack_notifications": False}, format="json")
        self.assertFalse(response.data["slack_notifications"])
        self.staff.refresh_from_db()
        self.assertFalse(self.staff.slack_notifications)

    def test_directory_does_not_expose_slack_fields(self):
        data = self.client.get(f"/api/users/{self.staff.pk}/").data
        self.assertNotIn("slack_notifications", data)
        self.assertNotIn("slack_user_id", data)
