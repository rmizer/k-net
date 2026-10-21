from unittest import mock

from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.tests import make_user

from .models import SupportRequest


class SupportRequestTests(APITestCase):
    def setUp(self):
        cache.clear()  # Reset the rate limit between tests.
        self.staff = make_user("staff@test.com", User.Role.STAFF, phone="813-555-0100")
        self.client.force_authenticate(self.staff)

    def send(self, **data):
        return self.client.post(
            "/api/support/",
            {"kind": "bug", "subject": "Map won't load", "message": "Blank map on Locations.", **data},
            format="json",
            HTTP_USER_AGENT="TestBrowser/1.0",
        )

    def test_bug_report_is_saved_and_emailed_to_support(self):
        response = self.send(page="Locations", expected="A map of our locations")
        self.assertEqual(response.status_code, 201, response.data)
        saved = SupportRequest.objects.get()
        self.assertEqual(saved.user, self.staff)
        self.assertTrue(saved.emailed)
        [email] = mail.outbox
        self.assertEqual(email.to, ["support.knet@gmail.com"])
        self.assertEqual(email.reply_to, ["staff@test.com"])
        self.assertEqual(email.subject, "[K-Net Bug report] Map won't load")
        for text in ["Blank map on Locations.", "Where it happened: Locations", "A map of our locations",
                     "(813) 555-0100", "TestBrowser/1.0", f"#{saved.pk}"]:
            self.assertIn(text, email.body)

    def test_every_kind_is_accepted(self):
        for kind in ["bug", "feature", "question", "feedback"]:
            self.assertEqual(self.send(kind=kind).status_code, 201, kind)
        self.assertEqual(len(mail.outbox), 4)
        self.assertIn("[K-Net Feature request]", mail.outbox[1].subject)

    def test_subject_message_and_kind_required(self):
        response = self.send(kind="", subject="", message="")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"kind", "subject", "message"})
        self.assertEqual(self.send(kind="complaint").status_code, 400)

    def test_must_be_signed_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.send().status_code, 403)

    def test_email_failure_still_saves(self):
        with mock.patch("support.views.send_support_email", side_effect=OSError("SMTP down")), \
                self.assertLogs("support.views", "ERROR"):
            response = self.send()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(SupportRequest.objects.get().emailed)

    def test_rate_limited(self):
        for _ in range(20):
            self.send()
        self.assertEqual(self.send().status_code, 429)
