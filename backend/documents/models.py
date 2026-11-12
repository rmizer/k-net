from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone


def private_storage():
    """Documents live outside MEDIA_ROOT so they're never served publicly; the API
    streams them to signed-in users who are allowed to see them. (A callable keeps
    the machine-specific path out of migrations.)"""
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)

ALLOWED_EXTENSIONS = [
    "pdf", "jpg", "jpeg", "png", "gif", "webp", "heic",
    "doc", "docx", "xls", "xlsx", "csv", "txt",
]  # fmt: skip


class Document(models.Model):
    class Category(models.TextChoices):
        INSURANCE = "insurance", "Insurance"
        PERMIT = "permit", "Permits"
        CONTRACT = "contract", "Contracts"
        VEHICLE = "vehicle", "Vehicle documents"
        INVOICE = "invoice", "Invoices"
        VOUCHER = "voucher", "Vouchers"
        HIRING = "hiring", "Hiring (resumes & references)"
        AGREEMENT = "agreement", "Agreements (NDAs, privacy, disclaimers)"
        RECEIPT = "receipt", "Receipts"
        OTHER = "other", "Miscellaneous"

    class Status(models.TextChoices):
        """Where a receipt is in reimbursement."""

        SUBMITTED = "submitted", "Submitted"
        VIEWED = "viewed", "Viewed"
        IN_PROCESS = "in_process", "In process"
        PROCESSED = "processed", "Processed"

    class AgreementType(models.TextChoices):
        NDA = "nda", "NDA"
        PRIVACY = "privacy", "Privacy agreement"
        DISCLAIMER = "disclaimer", "Legal disclaimer"
        RELEASE = "release", "Appearance / talent release"
        OTHER = "other", "Other agreement"

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=15, choices=Category.choices, default=Category.OTHER)
    file = models.FileField(
        upload_to="documents/%Y/%m/",
        storage=private_storage,
        validators=[FileExtensionValidator(ALLOWED_EXTENSIONS)],
    )
    notes = models.TextField(blank=True)

    # Hiring files and agreements: who they're about (someone with an account,
    # or a candidate's name before they have one), and which agreement it is.
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="hr_documents"
    )
    person_name = models.CharField("candidate name", max_length=150, blank=True)
    agreement_type = models.CharField(max_length=15, choices=AgreementType.choices, blank=True)
    expires_on = models.DateField(null=True, blank=True, help_text="For insurance, permits, registrations, etc.")

    # Receipts only.
    vendor = models.CharField(max_length=150, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.SUBMITTED)
    status_changed_at = models.DateTimeField(null=True, blank=True)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    HR_CATEGORIES = ("hiring", "agreement")

    @property
    def is_hr(self):
        return self.category in self.HR_CATEGORIES

    @property
    def is_receipt(self):
        return self.category == self.Category.RECEIPT

    @property
    def file_name(self):
        return Path(self.file.name).name if self.file else ""

    def set_status(self, status):
        if status != self.status:
            self.status = status
            self.status_changed_at = timezone.now()
