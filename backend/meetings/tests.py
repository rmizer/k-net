from rest_framework.test import APITestCase

from accounts.models import User

from .models import MeetingNote


def make_user(email, role):
    return User.objects.create_user(email=email, first_name="Sam", last_name=role, role=role)


class MeetingNoteTests(APITestCase):
    def setUp(self):
        self.assistant = make_user("assistant@test.com", User.Role.ASSISTANT)
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)

    def test_managers_take_and_edit_notes(self):
        self.client.force_authenticate(self.assistant)
        response = self.client.post(
            "/api/meeting-notes/",
            {"title": "Production meeting", "meeting_at": "2026-10-21T14:00:00Z",
             "attendees": [self.director.pk, self.staff.pk], "notes": "Bus #2 leaves at 10:30."},
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["created_by_name"], "Sam assistant")
        self.assertEqual(len(response.data["attendee_names"]), 2)

        self.client.force_authenticate(self.director)
        note = response.data["id"]
        response = self.client.patch(f"/api/meeting-notes/{note}/", {"notes": "Bus #2 leaves at 10:45."})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated_by_name"], "Sam director")

    def test_staff_cannot_see_notes(self):
        MeetingNote.objects.create(meeting_at="2026-10-21T14:00:00Z", notes="Private")
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/meeting-notes/").status_code, 403)
        self.assertEqual(
            self.client.post("/api/meeting-notes/", {"meeting_at": "2026-10-21T14:00:00Z"}).status_code, 403
        )
