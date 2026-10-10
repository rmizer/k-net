from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import Department, User
from accounts.tests import make_user

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


class DepartmentTaskVisibilityTests(APITestCase):
    def test_staff_see_their_department_tasks_but_not_teammates_personal_ones(self):
        tech = Department.objects.create(name="Tech")
        staff = make_user("staff@test.com", User.Role.STAFF, department=tech)
        teammate = make_user("mate@test.com", User.Role.STAFF, department=tech)
        Task.objects.create(title="Whole department", department=tech)
        Task.objects.create(title="Teammate only", assigned_to=teammate, department=tech)
        Task.objects.create(title="Mine", assigned_to=staff)
        Task.objects.create(title="Other department", department=Department.objects.create(name="Wardrobe"))
        self.client.force_authenticate(staff)
        titles = {t["title"] for t in self.client.get("/api/tasks/?mine=1").data}
        self.assertEqual(titles, {"Whole department", "Mine"})
        dashboard = {t["title"] for t in self.client.get("/api/dashboard/").data["my_tasks"]}
        self.assertEqual(dashboard, {"Whole department", "Mine"})
