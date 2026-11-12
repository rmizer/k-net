import shutil
import tempfile

from django.core import mail
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import Department, User
from core.models import ProductionSettings

from .models import IncidentAttachment


def make_user(email, role=User.Role.STAFF, **fields):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role, **fields)


def photo(name="fence.jpg"):
    return SimpleUploadedFile(name, b"\xff\xd8\xff fake jpeg", content_type="image/jpeg")


@override_settings(SITE_URL="https://knet.example.com")
class IncidentExtrasTests(APITestCase):
    def setUp(self):
        # Keep test uploads out of the real private folder.
        folder = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, folder, ignore_errors=True)
        field = IncidentAttachment._meta.get_field("file")
        original = field.storage
        field.storage = FileSystemStorage(location=folder)
        self.addCleanup(setattr, field, "storage", original)

        ProductionSettings.objects.update_or_create(pk=1, defaults={"time_zone": "America/New_York"})
        security = Department.objects.create(name="Security", page=Department.Page.SECURITY)
        tech = Department.objects.create(name="Tech", page=Department.Page.TECH)
        self.head = make_user("head@test.com", department=security, is_department_head=True, head_of_department=security)
        self.guard = make_user("guard@test.com", department=security)
        self.guard2 = make_user("guard2@test.com", department=security)
        self.techie = make_user("techie@test.com", department=tech)
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.site_manager = make_user("sm@test.com", User.Role.SITE_MANAGER)

    def file(self, severity="medium", user=None):
        self.client.force_authenticate(user or self.guard)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/incident-reports/",
                {
                    "title": "Fan climbed the back fence",
                    "category": "trespass",
                    "severity": severity,
                    "occurred_at": "2026-12-03T03:15:00Z",
                    "location": "Back fence by the pool",
                    "description": "Walked out by security.",
                },
                format="json",
            )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def patch(self, report, data):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.patch(f"/api/incident-reports/{report['id']}/", data, format="json")

    # Alerts

    def test_medium_report_sends_no_alert(self):
        report = self.file("medium")
        self.assertFalse(report["alerted"])
        self.assertEqual(len(mail.outbox), 0)

    def test_high_report_emails_managers_and_security_head_once(self):
        report = self.file("high")
        self.assertTrue(report["alerted"])
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(sorted(message.bcc), ["director@test.com", "head@test.com", "sm@test.com"])
        self.assertIn("HIGH security incident: Fan climbed the back fence", message.subject)
        self.assertIn(f"https://knet.example.com/departments/security/incidents/{report['id']}", message.body)
        # The time is in the production's time zone.
        self.assertIn("Wed Dec 2, 10:15 PM EST", message.body)
        # Details stay in K-Net.
        self.assertNotIn("Walked out", message.body)

        self.patch(report, {"location": "Side gate"})
        self.assertEqual(len(mail.outbox), 1)

    def test_raising_to_critical_alerts_again(self):
        report = self.file("high")
        self.patch(report, {"severity": "critical"})
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn("CRITICAL", mail.outbox[1].subject)
        self.patch(report, {"severity": "high"})
        self.patch(report, {"severity": "critical"})
        self.assertEqual(len(mail.outbox), 2)

    def test_raising_medium_to_high_alerts(self):
        report = self.file("medium")
        self.patch(report, {"severity": "high"})
        self.assertEqual(len(mail.outbox), 1)

    def test_reporter_is_not_alerted_about_their_own_report(self):
        self.file("critical", user=self.head)
        self.assertNotIn("head@test.com", mail.outbox[0].bcc)

    # Attachments

    def upload(self, report, file=None, user=None, caption="Footprints by the fence"):
        if user:
            self.client.force_authenticate(user)
        return self.client.post(
            f"/api/incident-reports/{report['id']}/attachments/",
            {"file": file or photo(), "caption": caption},
            format="multipart",
        )

    def test_reporter_adds_a_photo_and_the_team_can_open_it(self):
        report = self.file()
        response = self.upload(report)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["kind"], "image")
        self.assertEqual(response.data["caption"], "Footprints by the fence")

        detail = self.client.get(f"/api/incident-reports/{report['id']}/").data
        self.assertEqual(len(detail["attachments"]), 1)

        url = response.data["url"].removeprefix("/api")
        self.client.force_authenticate(self.guard2)
        opened = self.client.get(f"/api{url}")
        self.assertEqual(opened.status_code, 200)
        self.assertEqual(b"".join(opened.streaming_content), b"\xff\xd8\xff fake jpeg")

        self.client.force_authenticate(self.techie)
        self.assertEqual(self.client.get(f"/api{url}").status_code, 403)

    def test_videos_and_pdfs_are_allowed_but_not_other_files(self):
        report = self.file()
        video = SimpleUploadedFile("cam.mov", b"video", content_type="video/quicktime")
        self.assertEqual(self.upload(report, video).data["kind"], "video")
        script = SimpleUploadedFile("evil.exe", b"MZ", content_type="application/octet-stream")
        response = self.upload(report, script)
        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.data)

    def test_only_reporter_or_reviewers_add_and_remove(self):
        report = self.file()
        self.assertEqual(self.upload(report, user=self.guard2).status_code, 403)
        attachment = self.upload(report, user=self.guard).data

        self.client.force_authenticate(self.head)
        self.patch(report, {"status": "investigating"})
        # Once it's being handled, the reporter can't add or remove.
        self.client.force_authenticate(self.guard)
        self.assertEqual(self.upload(report).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/incident-attachments/{attachment['id']}/").status_code, 403)

        self.client.force_authenticate(self.head)
        self.assertEqual(self.client.delete(f"/api/incident-attachments/{attachment['id']}/").status_code, 204)
        self.assertFalse(IncidentAttachment.objects.exists())
