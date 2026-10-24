import shutil
import tempfile

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from accounts.models import Department, User

from .models import Document

PASSWORD = "a-strong-test-password-1"


def make_user(email, role):
    return User.objects.create_user(email=email, password=PASSWORD, first_name="Dana", last_name="D", role=role)


def upload(name="receipt.pdf", content=b"%PDF-1.4 test"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


class DocumentApiTests(APITestCase):
    def setUp(self):
        # Keep test uploads out of the real private folder.
        folder = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, folder, ignore_errors=True)
        field = Document._meta.get_field("file")
        original = field.storage
        field.storage = FileSystemStorage(location=folder)
        self.addCleanup(setattr, field, "storage", original)

        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.other = make_user("other@test.com", User.Role.STAFF)

    def post_receipt(self, user, **extra):
        self.client.force_authenticate(user)
        data = {"title": "Gaff tape", "category": "receipt", "amount": "23.50", "vendor": "Home Depot", "file": upload(), **extra}
        return self.client.post("/api/documents/", data, format="multipart")

    def test_staff_submission_starts_as_submitted(self):
        response = self.post_receipt(self.staff, status="processed")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["category"], response.data["status"]), ("receipt", "submitted"))
        self.assertTrue(response.data["is_mine"])
        self.assertNotIn("file", response.data)

    def test_staff_can_submit_other_paperwork(self):
        response = self.post_receipt(self.staff, title="Car insurance", category="vehicle", amount="")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["category"], "vehicle")
        self.client.force_authenticate(self.staff)
        self.assertEqual([d["title"] for d in self.client.get("/api/documents/?mine=1").data], ["Car insurance"])

    def test_director_opening_a_document_marks_it_viewed(self):
        document_id = self.post_receipt(self.staff, category="vehicle", amount="").data["id"]
        self.client.force_authenticate(self.director)
        self.client.get(f"/api/documents/{document_id}/file/")
        self.assertEqual(Document.objects.get(pk=document_id).status, "viewed")
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.delete(f"/api/documents/{document_id}/").status_code, 403)

    def test_receipt_needs_an_amount(self):
        response = self.post_receipt(self.staff, amount="")
        self.assertEqual(response.status_code, 400)
        self.assertIn("amount", response.data)

    def test_staff_see_only_their_own_receipts(self):
        Document.objects.create(title="Policy", category="insurance", file="x.pdf")
        self.post_receipt(self.other)
        self.post_receipt(self.staff, title="Mine")
        self.client.force_authenticate(self.staff)
        self.assertEqual([d["title"] for d in self.client.get("/api/documents/").data], ["Mine"])

    def test_director_sees_everything_and_filters_by_category(self):
        Document.objects.create(title="Policy", category="insurance", file="x.pdf")
        self.post_receipt(self.staff)
        self.client.force_authenticate(self.director)
        self.assertEqual(len(self.client.get("/api/documents/").data), 2)
        titles = [d["title"] for d in self.client.get("/api/documents/?category=insurance").data]
        self.assertEqual(titles, ["Policy"])

    def test_director_opening_a_receipt_marks_it_viewed(self):
        receipt_id = self.post_receipt(self.staff).data["id"]
        self.client.force_authenticate(self.director)
        response = self.client.get(f"/api/documents/{receipt_id}/file/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-1.4 test")
        receipt = Document.objects.get(pk=receipt_id)
        self.assertEqual(receipt.status, "viewed")
        self.assertIsNotNone(receipt.status_changed_at)

    def test_staff_can_change_receipt_only_until_viewed(self):
        receipt_id = self.post_receipt(self.staff).data["id"]
        response = self.client.patch(f"/api/documents/{receipt_id}/", {"amount": "25.00"})
        self.assertEqual(response.status_code, 200)
        Document.objects.filter(pk=receipt_id).update(status="viewed")
        self.assertEqual(self.client.patch(f"/api/documents/{receipt_id}/", {"amount": "1"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/documents/{receipt_id}/").status_code, 403)

    def test_staff_cannot_set_status(self):
        receipt_id = self.post_receipt(self.staff).data["id"]
        self.client.patch(f"/api/documents/{receipt_id}/", {"status": "processed"})
        self.assertEqual(Document.objects.get(pk=receipt_id).status, "submitted")

    def test_director_moves_receipt_along(self):
        receipt_id = self.post_receipt(self.staff).data["id"]
        self.client.force_authenticate(self.director)
        response = self.client.patch(f"/api/documents/{receipt_id}/", {"status": "processed"})
        self.assertEqual(response.data["status_display"], "Processed")

    def test_staff_cannot_reach_others_files(self):
        receipt_id = self.post_receipt(self.other).data["id"]
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get(f"/api/documents/{receipt_id}/file/").status_code, 404)

    def test_finance_sees_receipts_but_not_other_paperwork(self):
        finance = Department.objects.get(page=Department.Page.FINANCE)  # made by a migration
        bookkeeper = make_user("books@test.com", User.Role.STAFF)
        bookkeeper.department = finance
        bookkeeper.save()
        receipt_id = self.post_receipt(self.staff).data["id"]
        self.post_receipt(self.staff, title="Car insurance", category="vehicle", amount="")
        self.client.force_authenticate(bookkeeper)
        self.assertEqual([d["id"] for d in self.client.get("/api/documents/").data], [receipt_id])
        self.assertEqual(self.client.get(f"/api/documents/{receipt_id}/file/").status_code, 200)
        self.assertEqual(Document.objects.get(pk=receipt_id).status, "viewed")
        # Seeing a receipt isn't changing it.
        self.assertEqual(self.client.delete(f"/api/documents/{receipt_id}/").status_code, 403)

    def test_disallowed_file_type_rejected(self):
        response = self.post_receipt(self.staff, file=upload("run.exe", b"MZ"))
        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.data)

    def test_deleting_removes_the_file(self):
        receipt_id = self.post_receipt(self.staff).data["id"]
        document = Document.objects.get(pk=receipt_id)
        storage, name = document.file.storage, document.file.name
        self.assertEqual(self.client.delete(f"/api/documents/{receipt_id}/").status_code, 204)
        self.assertFalse(storage.exists(name))
