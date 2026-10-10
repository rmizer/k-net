from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Task




@override_settings(SLACK_INVITE_URL="https://join.slack.com/t/example/shared_invite/abc")
class JoinSlackTaskTests(APITestCase):
    def setUp(self):
        self.director = User.objects.create_user(
            email="dir@test.com", password="A-strong-test-password-1", first_name="D", last_name="D",
            role=User.Role.DIRECTOR,
        )

    def join_task(self, user):
        return Task.objects.get(assigned_to=user, key=Task.Key.JOIN_SLACK)

    def test_people_added_by_managers_get_the_task(self):
        self.client.force_authenticate(self.director)
        response = self.client.post(
            "/api/users/", {"email": "new@test.com", "first_name": "New", "last_name": "P", "role": "staff"}
        )
        task = self.join_task(User.objects.get(pk=response.data["id"]))
        self.assertEqual(task.title, "Join the K-Net Slack")
        self.assertIn("join.slack.com", task.description)
        self.assertEqual(task.priority, "high")

    def test_sign_ups_get_the_task_once(self):
        data = {
            "first_name": "Sam", "last_name": "S", "email": "sam@test.com", "phone": "555-0100",
            "password": "A-strong-test-password-1!", "accept_privacy": True,
        }
        self.client.post("/api/auth/signup/", data, format="json")
        self.client.post("/api/auth/signup/", data, format="json")  # Signing up again before verifying.
        user = User.objects.get(email="sam@test.com")
        self.assertEqual(Task.objects.filter(assigned_to=user, key=Task.Key.JOIN_SLACK).count(), 1)

    def test_finishing_the_task_marks_them_joined(self):
        from tasks.onboarding import add_starter_tasks

        add_starter_tasks(self.director)
        self.client.force_authenticate(self.director)
        task = self.join_task(self.director)
        self.client.patch(f"/api/tasks/{task.pk}/", {"status": "done"})
        self.director.refresh_from_db()
        self.assertTrue(self.director.slack_joined)

    def test_ive_joined_finishes_the_task(self):
        from tasks.onboarding import add_starter_tasks

        add_starter_tasks(self.director)
        self.client.force_authenticate(self.director)
        response = self.client.patch("/api/auth/me/", {"slack_joined": True})
        self.assertTrue(response.data["slack_joined"])
        self.assertEqual(self.join_task(self.director).status, "done")

    @override_settings(SLACK_INVITE_URL="")
    def test_no_task_without_an_invite_link(self):
        from tasks.onboarding import add_starter_tasks

        add_starter_tasks(self.director)
        self.assertFalse(Task.objects.filter(key=Task.Key.JOIN_SLACK).exists())
