from rest_framework.test import APITestCase

from accounts.models import Department, User

from .models import IncidentReport


def make_user(email, role=User.Role.STAFF, **fields):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role, **fields)


class IncidentReportTests(APITestCase):
    def setUp(self):
        self.security = Department.objects.create(name="Security", page=Department.Page.SECURITY)
        self.tech = Department.objects.create(name="Tech", page=Department.Page.TECH)
        self.head = make_user(
            "head@test.com", department=self.security, is_department_head=True, head_of_department=self.security
        )
        self.guard = make_user("guard@test.com", department=self.security)
        self.guard2 = make_user("guard2@test.com", department=self.security)
        self.techie = make_user("techie@test.com", department=self.tech)
        self.tech_head = make_user(
            "techhead@test.com", department=self.tech, is_department_head=True, head_of_department=self.tech
        )
        self.director = make_user("director@test.com", User.Role.DIRECTOR)

    def file(self, user=None, **changes):
        self.client.force_authenticate(user or self.guard)
        data = {
            "title": "Fan climbed the back fence",
            "category": "trespass",
            "severity": "high",
            "occurred_at": "2026-12-02T03:15:00Z",
            "location": "Back fence by the pool",
            "description": "A fan climbed the fence during the live stream and was walked out.",
            **changes,
        }
        return self.client.post("/api/incident-reports/", data, format="json")

    def test_guard_files_a_report(self):
        response = self.file(police_called=True, police_report_number="24-1187")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "open")
        self.assertEqual(response.data["reported_by_name"], "guard")
        self.assertEqual(response.data["police_report_number"], "24-1187")
        self.assertTrue(response.data["can_edit"])

    def test_required_fields(self):
        response = self.file(title="", location="", description="", occurred_at=None)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"title", "location", "description", "occurred_at"})

    def test_report_number_dropped_without_police(self):
        response = self.file(police_called=False, police_report_number="123")
        self.assertEqual(response.data["police_report_number"], "")

    def test_who_can_see_reports(self):
        self.file()
        for user, code in [
            (self.guard2, 200),
            (self.head, 200),
            (self.director, 200),
            (self.techie, 403),
            (self.tech_head, 403),
        ]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/incident-reports/").status_code, code, user.email)

    def test_reporter_edits_own_open_report_but_not_its_status(self):
        report = self.file().data
        url = f"/api/incident-reports/{report['id']}/"
        self.assertEqual(self.client.patch(url, {"location": "Side gate"}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(url, {"status": "resolved"}, format="json").status_code, 403)
        # Sending the status unchanged (as the form does) is fine.
        self.assertEqual(self.client.patch(url, {"status": "open", "witnesses": "Chico"}, format="json").status_code, 200)
        self.assertEqual(self.client.delete(url).status_code, 403)

        self.client.force_authenticate(self.guard2)
        self.assertEqual(self.client.patch(url, {"location": "Elsewhere"}, format="json").status_code, 403)

    def test_head_reviews_and_closes(self):
        report = self.file().data
        url = f"/api/incident-reports/{report['id']}/"
        self.client.force_authenticate(self.head)
        response = self.client.patch(
            url, {"status": "resolved", "resolution": "Fence raised; extra guard at night."}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status_display"], "Resolved")

        # Once it's being handled, the reporter can't change it any more.
        self.client.force_authenticate(self.guard)
        self.assertFalse(self.client.get(url).data["can_edit"])
        self.assertEqual(self.client.patch(url, {"location": "x"}, format="json").status_code, 403)

        self.client.force_authenticate(self.director)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(IncidentReport.objects.exists())

    def test_staff_cannot_set_status_when_filing(self):
        self.assertEqual(self.file(status="resolved").status_code, 403)
        self.assertEqual(self.file(self.director, status="investigating").status_code, 201)
