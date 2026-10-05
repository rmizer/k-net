from datetime import date

from rest_framework.test import APITestCase

from accounts.models import User

from .models import TimelineItem

PASSWORD = "a-strong-test-password-1"


def make_user(email, role):
    return User.objects.create_user(email=email, password=PASSWORD, first_name="Dana", last_name="D", role=role)


class TimelineApiTests(APITestCase):
    def setUp(self):
        self.assistant = make_user("assistant@test.com", User.Role.ASSISTANT)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.item = TimelineItem.objects.create(
            name="Principal photography", start_date=date(2026, 10, 1), end_date=date(2026, 10, 20)
        )

    def test_everyone_can_view(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual([i["name"] for i in self.client.get("/api/timeline/").data], ["Principal photography"])

    def test_staff_cannot_change(self):
        self.client.force_authenticate(self.staff)
        item = {"name": "X", "start_date": "2026-10-01", "end_date": "2026-10-02"}
        self.assertEqual(self.client.post("/api/timeline/", item).status_code, 403)
        self.assertEqual(self.client.patch(f"/api/timeline/{self.item.pk}/", {"name": "Y"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/timeline/{self.item.pk}/").status_code, 403)

    def test_assistant_adds_and_edits(self):
        self.client.force_authenticate(self.assistant)
        item = {"name": "Episode 1 airs", "start_date": "2026-10-09", "end_date": "2026-10-09"}
        response = self.client.post("/api/timeline/", item)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created_by_name"], "Dana D")
        response = self.client.patch(f"/api/timeline/{self.item.pk}/", {"end_date": "2026-10-25"})
        self.assertEqual(response.data["end_date"], "2026-10-25")

    def test_end_before_start_rejected(self):
        self.client.force_authenticate(self.assistant)
        response = self.client.patch(f"/api/timeline/{self.item.pk}/", {"end_date": "2026-09-01"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_date", response.data)
