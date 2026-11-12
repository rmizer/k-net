import shutil
import tempfile

from django.core import mail
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import CredentialRequest, Department, User
from documents.models import Document


def make_user(email, role=User.Role.STAFF, **fields):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role, **fields)


def upload(name="resume.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 test", content_type="application/pdf")


@override_settings(SITE_URL="https://knet.example.com")
class HumanResourcesTests(APITestCase):
    def setUp(self):
        folder = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, folder, ignore_errors=True)
        field = Document._meta.get_field("file")
        original = field.storage
        field.storage = FileSystemStorage(location=folder)
        self.addCleanup(setattr, field, "storage", original)

        self.hr = Department.objects.create(name="Human Resources", page=Department.Page.HUMAN_RESOURCES)
        tech = Department.objects.create(name="Tech", page=Department.Page.TECH)
        self.hr_lead = make_user("hr@test.com", User.Role.ASSISTANT, department=self.hr)
        self.hr_clerk = make_user("clerk@test.com", department=self.hr)
        self.tech_head = make_user("techhead@test.com", department=tech, is_department_head=True, head_of_department=tech)
        self.staff = make_user("staff@test.com", department=tech)
        self.site_manager = make_user("sm@test.com", User.Role.SITE_MANAGER)
        self.new_hire = make_user("newhire@test.com")

    # The HR page

    def test_hr_page_is_private(self):
        for user, code in [(self.hr_lead, 200), (self.hr_clerk, 200), (self.site_manager, 200), (self.tech_head, 403), (self.staff, 403)]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/department-pages/human-resources/").status_code, code, user.email)

    # Hiring files and agreements

    def file(self, user, **fields):
        self.client.force_authenticate(user)
        data = {"title": "Signed NDA", "category": "agreement", "agreement_type": "nda", "file": upload("nda.pdf"), **fields}
        return self.client.post("/api/documents/", data, format="multipart")

    def test_agreement_for_a_person(self):
        response = self.file(self.hr_lead, person=self.new_hire.pk)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["person_display"], "newhire")
        self.assertEqual(response.data["agreement_type_display"], "NDA")
        listed = self.client.get(f"/api/documents/?person={self.new_hire.pk}").data
        self.assertEqual([doc["id"] for doc in listed], [response.data["id"]])

    def test_resume_for_a_candidate_without_an_account(self):
        response = self.file(self.hr_lead, title="Resume", category="hiring", agreement_type="nda", person_name="Pat Lee")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["person_display"], response.data["agreement_type"]), ("Pat Lee", ""))

    def test_upload_form_sends_blank_fields(self):
        # The upload dialog sends every field, blank when unused.
        blanks = {"notes": "", "expires_on": "", "vendor": "", "amount": "", "purchase_date": ""}
        response = self.file(
            self.hr_lead, title="Resume", category="hiring", person="", person_name="Pat Lee", agreement_type="", **blanks
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["person_display"], "Pat Lee")
        permit = self.file(self.hr_lead, title="Permit", category="permit", person="", person_name="", agreement_type="", **blanks)
        self.assertEqual(permit.status_code, 201, permit.data)

    def test_hr_files_need_a_person_and_agreements_a_type(self):
        self.assertIn("person", self.file(self.hr_lead).data)
        self.assertIn("agreement_type", self.file(self.hr_lead, person=self.new_hire.pk, agreement_type="").data)

    def test_hr_team_sees_hr_files_others_dont(self):
        nda = self.file(self.hr_lead, person=self.new_hire.pk).data
        self.client.force_authenticate(self.hr_clerk)
        self.assertIn(nda["id"], [doc["id"] for doc in self.client.get("/api/documents/").data])
        self.assertEqual(self.client.patch(f"/api/documents/{nda['id']}/", {"notes": "Countersigned"}).status_code, 200)
        for outsider in (self.staff, self.tech_head):
            self.client.force_authenticate(outsider)
            self.assertNotIn(nda["id"], [doc["id"] for doc in self.client.get("/api/documents/").data])

    # Credential requests

    def test_hr_requests_a_new_login_and_site_managers_are_emailed(self):
        self.client.force_authenticate(self.hr_lead)
        response = self.client.post(
            "/api/credential-requests/",
            {"kind": "new_login", "name": "Pat Lee", "email": "pat@example.com", "details": "Starts Dec 1, Culinary"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["who"], "Pat Lee")
        self.assertEqual(mail.outbox[0].to, ["sm@test.com"])
        self.assertIn("New login for someone: Pat Lee", mail.outbox[0].subject)
        self.assertIn("https://knet.example.com/site-manager", mail.outbox[0].body)

        self.client.force_authenticate(self.site_manager)
        pending = self.client.get("/api/credential-requests/?status=pending").data
        self.assertEqual([row["id"] for row in pending], [response.data["id"]])
        done = self.client.post(f"/api/credential-requests/{response.data['id']}/done/")
        self.assertEqual(done.data["status"], "done")
        self.assertEqual(done.data["resolved_by_name"], "sm")

    def test_credential_request_validation(self):
        self.client.force_authenticate(self.hr_lead)
        self.assertIn("person", self.client.post("/api/credential-requests/", {"kind": "password_reset"}, format="json").data)
        response = self.client.post("/api/credential-requests/", {"kind": "new_login"}, format="json")
        self.assertEqual(set(response.data), {"name", "email"})
        response = self.client.post(
            "/api/credential-requests/", {"kind": "email_change", "person": self.new_hire.pk}, format="json"
        )
        self.assertIn("email", response.data)

    def test_only_site_managers_resolve_and_requesters_see_their_own(self):
        self.client.force_authenticate(self.hr_lead)
        mine = self.client.post(
            "/api/credential-requests/", {"kind": "password_reset", "person": self.new_hire.pk}, format="json"
        ).data
        self.assertEqual(self.client.post(f"/api/credential-requests/{mine['id']}/done/").status_code, 403)
        director = make_user("director@test.com", User.Role.DIRECTOR)
        self.client.force_authenticate(director)
        self.assertEqual(self.client.get("/api/credential-requests/").data, [])
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/credential-requests/").status_code, 403)
        self.assertEqual(CredentialRequest.objects.count(), 1)
