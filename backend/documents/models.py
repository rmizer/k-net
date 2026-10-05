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
        RECEIPT = "receipt", "Receipts"
        OTHER = "other", "Miscellaneous"

    class Status(models.TextChoices):
        """Where a receipt is in reimbursement."""

        SUBMITTED = "submitted", "Submitted"
        VIEWED = "viewed", "Viewed"
        IN_PROCESS = "in_process", "In process"
        PROCESSED = "processed", "Processed"

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=15, choices=Category.choices, default=Category.OTHER)
    file = models.FileField(
        upload_to="documents/%Y/%m/",
        storage=private_storage,
        validators=[FileExtensionValidator(ALLOWED_EXTENSIONS)],
    )
    notes = models.TextField(blank=True)
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
