import shutil
import tempfile
from datetime import date, timedelta
from decimal import Decimal

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from documents.models import Document

from .models import AutoDraft, Invoice, Paycheck, PaymentMethod, PayRate, Payment

PASSWORD = "a-strong-test-password-1"


def make_user(email, role, first="Dana"):
    return User.objects.create_user(email=email, password=PASSWORD, first_name=first, last_name="D", role=role)


class FinanceTestCase(APITestCase):
    def setUp(self):
        # Keep uploads out of the real private folder.
        folder = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, folder, ignore_errors=True)
        field = Document._meta.get_field("file")
        original = field.storage
        field.storage = FileSystemStorage(location=folder)
        self.addCleanup(setattr, field, "storage", original)

        self.director = make_user("director@test.com", User.Role.DIRECTOR, "Coach")
        self.staff = make_user("staff@test.com", User.Role.STAFF, "Jimmy")
        self.card = PaymentMethod.objects.create(name="Production Amex", kind="card", last4="1004")
        self.client.force_authenticate(self.director)

    def receipt(self, person, amount="20.00", **extra):
        return Document.objects.create(
            title="Tape", category="receipt", file="r.pdf", uploaded_by=person, amount=Decimal(amount), **extra
        )


class PermissionTests(FinanceTestCase):
    def test_staff_are_kept_out(self):
        self.client.force_authenticate(self.staff)
        for path in ["payment-methods", "invoices", "auto-drafts", "payments", "deposits", "paychecks", "payroll",
                     "overview", "calendar"]:
            self.assertEqual(self.client.get(f"/api/finance/{path}/").status_code, 403, path)


class PaymentMethodTests(FinanceTestCase):
    def test_last4_must_be_four_digits(self):
        response = self.client.post("/api/finance/payment-methods/", {"name": "Chase", "kind": "bank", "last4": "12"})
        self.assertEqual(response.status_code, 400)

    def test_uses_counts_what_points_at_it(self):
        Payment.objects.create(paid_on=date(2026, 10, 1), payee="X", amount=1, payment_method=self.card)
        data = self.client.get(f"/api/finance/payment-methods/{self.card.pk}/").data
        self.assertEqual((data["uses"], data["label"]), (1, "Production Amex ending 1004"))


class InvoiceTests(FinanceTestCase):
    def test_upload_files_it_under_documents(self):
        response = self.client.post(
            "/api/finance/invoices/",
            {"vendor": "Puff 'n Stuff", "number": "4471", "amount": "812.50",
             "file": SimpleUploadedFile("inv.pdf", b"%PDF")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        document = Document.objects.get(pk=response.data["document_id"])
        self.assertEqual((document.category, document.title), ("invoice", "Invoice 4471: Puff 'n Stuff"))

    def test_paying_records_an_outgoing_payment_and_undo_reverts(self):
        invoice = Invoice.objects.create(vendor="Moving Picture", number="88", amount=Decimal("1500.00"))
        response = self.client.post(
            f"/api/finance/invoices/{invoice.pk}/pay/", {"payment_method": self.card.pk, "reference": "ACH 1"}
        )
        self.assertEqual(response.data["status"], "paid")
        payment = Payment.objects.get()
        self.assertEqual((payment.kind, payment.amount, payment.invoice), ("vendor", Decimal("1500.00"), invoice))
        self.assertEqual(self.client.post(f"/api/finance/invoices/{invoice.pk}/pay/").status_code, 400)

        self.client.delete(f"/api/finance/payments/{payment.pk}/")
        invoice.refresh_from_db()
        self.assertEqual((invoice.status, invoice.paid_on), ("unpaid", None))

    def test_due_before_issue_rejected(self):
        data = {"vendor": "X", "amount": "1", "issued_on": "2026-10-05", "due_on": "2026-10-01"}
        self.assertEqual(self.client.post("/api/finance/invoices/", data).status_code, 400)


class AutoDraftTests(FinanceTestCase):
    def test_recording_pays_and_moves_to_next_month(self):
        draft = AutoDraft.objects.create(payee="Insurer", amount=Decimal("300"), frequency="monthly",
                                         next_on=date(2027, 1, 31))
        response = self.client.post(f"/api/finance/auto-drafts/{draft.pk}/record/")
        self.assertEqual(response.data["next_on"], "2027-02-28")
        self.assertEqual(Payment.objects.get().kind, "draft")

    def test_dates_between(self):
        draft = AutoDraft(frequency="weekly", next_on=date(2026, 10, 2))
        self.assertEqual(draft.dates_between(date(2026, 10, 5), date(2026, 10, 20)),
                         [date(2026, 10, 9), date(2026, 10, 16)])


class PayrollTests(FinanceTestCase):
    def paycheck_data(self, **extra):
        return {"person": self.staff.pk, "period_start": "2026-09-28", "period_end": "2026-10-04",
                "pay_date": "2026-10-09", "quantity": "5", **extra}

    def test_paycheck_uses_pay_rate_and_needs_one(self):
        response = self.client.post("/api/finance/paychecks/", self.paycheck_data())
        self.assertEqual(response.status_code, 400)
        self.assertIn("rate", response.data)
        PayRate.objects.create(person=self.staff, unit="day", rate=Decimal("350"))
        response = self.client.post("/api/finance/paychecks/", self.paycheck_data())
        self.assertEqual((response.data["rate"], response.data["wages"]), ("350.00", "1750.00"))

    def test_receipts_are_reimbursed_and_marked_processed(self):
        PayRate.objects.create(person=self.staff, unit="day", rate=Decimal("100"))
        tape, water = self.receipt(self.staff, "46.18"), self.receipt(self.staff, "23.40")
        response = self.client.post(
            "/api/finance/paychecks/", self.paycheck_data(receipts=[tape.pk, water.pk], adjustment="-10")
        )
        self.assertEqual(response.data["total"], "559.58")  # 500 + 69.58 - 10
        tape.refresh_from_db()
        self.assertEqual(tape.status, "processed")

        # Taking a receipt off sends it back to In process.
        self.client.patch(f"/api/finance/paychecks/{response.data['id']}/", {"receipts": [water.pk]})
        tape.refresh_from_db()
        self.assertEqual(tape.status, "in_process")

    def test_receipts_must_be_the_persons_and_unused(self):
        PayRate.objects.create(person=self.staff, unit="day", rate=Decimal("100"))
        someone_elses = self.receipt(self.director)
        response = self.client.post("/api/finance/paychecks/", self.paycheck_data(receipts=[someone_elses.pk]))
        self.assertEqual(response.status_code, 400)
        mine = self.receipt(self.staff)
        self.client.post("/api/finance/paychecks/", self.paycheck_data(receipts=[mine.pk]))
        response = self.client.post("/api/finance/paychecks/", self.paycheck_data(receipts=[mine.pk]))
        self.assertIn("already on another paycheck", str(response.data))

    def test_paying_records_payroll_and_locks_the_paycheck(self):
        PayRate.objects.create(person=self.staff, unit="day", rate=Decimal("100"))
        paycheck_id = self.client.post("/api/finance/paychecks/", self.paycheck_data()).data["id"]
        self.client.post(f"/api/finance/paychecks/{paycheck_id}/pay/", {"paid_on": "2026-10-09"})
        payment = Payment.objects.get()
        self.assertEqual((payment.kind, payment.amount, payment.payee), ("payroll", Decimal("500.00"), "Jimmy D"))
        self.assertEqual(self.client.patch(f"/api/finance/paychecks/{paycheck_id}/", {"quantity": "9"}).status_code,
                         400)
        self.assertEqual(self.client.delete(f"/api/finance/paychecks/{paycheck_id}/").status_code, 400)

    def test_pay_table_and_person_page(self):
        self.client.put(f"/api/finance/payroll/{self.staff.pk}/rate/", {"unit": "hour", "rate": "42.50"})
        self.receipt(self.staff, "15.00")
        row = next(p for p in self.client.get("/api/finance/payroll/").data if p["id"] == self.staff.pk)
        self.assertEqual(row["pay_rate"]["rate"], "42.50")
        self.assertEqual(row["unreimbursed"], {"count": 1, "total": "15.00"})
        page = self.client.get(f"/api/finance/payroll/{self.staff.pk}/").data
        self.assertEqual(len(page["receipts"]), 1)
        self.assertEqual(page["paychecks"], [])


class OverviewAndCalendarTests(FinanceTestCase):
    def test_overview_totals(self):
        today = timezone.localdate()
        Invoice.objects.create(vendor="A", amount=Decimal("100"), due_on=today + timedelta(days=2))
        Invoice.objects.create(vendor="B", amount=Decimal("50"), due_on=today + timedelta(days=20))
        Invoice.objects.create(vendor="C", amount=Decimal("75"), due_on=today, archived=True)
        PayRate.objects.create(person=self.staff, unit="day", rate=Decimal("100"))
        Paycheck.objects.create(person=self.staff, period_start=today, period_end=today, pay_date=today,
                                quantity=2, rate=Decimal("100"))
        data = self.client.get("/api/finance/overview/").data
        self.assertEqual(data["due_this_week"], Decimal("100"))
        self.assertEqual(len(data["invoices_due"]), 2)
        self.assertEqual(data["next_payroll"]["total"], Decimal("200.00"))

    def test_calendar_items(self):
        Invoice.objects.create(vendor="A", amount=Decimal("100"), due_on=date(2026, 10, 15))
        AutoDraft.objects.create(payee="Insurer", amount=Decimal("300"), frequency="biweekly",
                                 next_on=date(2026, 10, 2))
        items = self.client.get("/api/finance/calendar/?start=2026-10-01&end=2026-10-31").data
        self.assertEqual([(str(i["date"]), i["kind"]) for i in items],
                         [("2026-10-02", "draft"), ("2026-10-15", "invoice"), ("2026-10-16", "draft"),
                          ("2026-10-30", "draft")])
        self.assertEqual(self.client.get("/api/finance/calendar/?start=2026-10-01&end=2027-10-01").status_code, 400)
