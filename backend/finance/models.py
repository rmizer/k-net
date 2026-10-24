"""Money in and out of the production. The Finance department, Directors, Assistants and Site Managers only.

Amounts are dollars (two decimal places). Card and account numbers are never
stored, only their last four digits (five for American Express).
"""

import re
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone

from documents.models import Document

POSITIVE = [MinValueValidator(Decimal("0.01"))]


def money_field(**kwargs):
    return models.DecimalField(max_digits=12, decimal_places=2, **kwargs)


def looks_like_amex(*names):
    return any(re.search(r"\bamex\b|american express", name or "", re.IGNORECASE) for name in names)


class PaymentMethod(models.Model):
    """A company card, bank account or digital account (PayPal, Venmo, Zelle…)."""

    class Kind(models.TextChoices):
        CARD = "card", "Company card"
        BANK = "bank", "Bank account"
        DIGITAL = "digital", "Digital account"

    name = models.CharField(max_length=100, help_text="e.g. Production Amex")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    institution = models.CharField(max_length=100, blank=True, help_text="Bank, card network or service.")
    # Four digits, or five for American Express (their cards have 15 digits and
    # are known by the last five). Only these: K-Net never stores card numbers.
    last_digits = models.CharField(
        "last digits",
        max_length=5,
        blank=True,
        validators=[RegexValidator(r"^\d{4,5}$", "Enter the last four digits (five for American Express).")],
    )
    holder = models.CharField("held by", max_length=150, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["kind", "name"]

    def __str__(self):
        return f"{self.name} ending {self.last_digits}" if self.last_digits else self.name


class Invoice(models.Model):
    """A bill from a vendor that the production owes."""

    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        SCHEDULED = "scheduled", "Payment scheduled"
        PAID = "paid", "Paid"

    vendor = models.CharField(max_length=150)
    number = models.CharField("invoice number", max_length=60, blank=True)
    description = models.TextField(blank=True)
    amount = money_field(validators=POSITIVE)
    issued_on = models.DateField(null=True, blank=True)
    due_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UNPAID)
    paid_on = models.DateField(null=True, blank=True)
    payment_method = models.ForeignKey(PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL)
    # The invoice itself, filed under Documents > Invoices.
    document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = [models.F("due_on").asc(nulls_last=True), "-created_at"]

    def __str__(self):
        return f"{self.vendor} {self.number}".strip()

    @property
    def is_overdue(self):
        return self.status != self.Status.PAID and self.due_on is not None and self.due_on < timezone.localdate()


class AutoDraft(models.Model):
    """A recurring payment that comes out automatically (insurance, rentals, subscriptions)."""

    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        BIWEEKLY = "biweekly", "Every two weeks"
        MONTHLY = "monthly", "Monthly"

    payee = models.CharField(max_length=150)
    description = models.CharField(max_length=255, blank=True)
    amount = money_field(validators=POSITIVE)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.MONTHLY)
    next_on = models.DateField("next draft")
    payment_method = models.ForeignKey(PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["next_on", "payee"]

    def __str__(self):
        return self.payee

    def following(self, day):
        """The draft date after `day`."""
        if self.frequency == self.Frequency.WEEKLY:
            return day + timedelta(weeks=1)
        if self.frequency == self.Frequency.BIWEEKLY:
            return day + timedelta(weeks=2)
        month = day.month % 12 + 1
        year = day.year + (day.month == 12)
        # Keep the same day of the month where it exists (Jan 31 -> Feb 28).
        for candidate in (day.day, 30, 29, 28):
            try:
                return day.replace(year=year, month=month, day=candidate)
            except ValueError:
                continue
        raise AssertionError("unreachable")

    def dates_between(self, start, end):
        """Every draft date from `start` to `end`, inclusive."""
        day, dates = self.next_on, []
        while day <= end and len(dates) < 60:
            if day >= start:
                dates.append(day)
            day = self.following(day)
        return dates


class PayRate(models.Model):
    """What a person is paid."""

    class Unit(models.TextChoices):
        DAY = "day", "Per day"
        HOUR = "hour", "Per hour"
        WEEK = "week", "Per week"

    person = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pay_rate")
    unit = models.CharField(max_length=5, choices=Unit.choices, default=Unit.DAY)
    rate = money_field(validators=POSITIVE)
    notes = models.CharField(max_length=255, blank=True, help_text="e.g. Direct deposit, kit fee included.")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.person}: {self.rate} {self.get_unit_display().lower()}"


class Paycheck(models.Model):
    """One person's pay for one period, plus any receipts being reimbursed."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        PAID = "paid", "Paid"

    person = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="paychecks")
    period_start = models.DateField()
    period_end = models.DateField()
    pay_date = models.DateField()
    unit = models.CharField(max_length=5, choices=PayRate.Unit.choices, default=PayRate.Unit.DAY)
    quantity = models.DecimalField(
        "days, hours or weeks worked", max_digits=7, decimal_places=2, validators=[MinValueValidator(0)]
    )
    rate = money_field(validators=[MinValueValidator(0)])
    adjustment = money_field(default=Decimal("0"), help_text="Bonus (positive) or deduction (negative).")
    receipts = models.ManyToManyField(Document, blank=True, related_name="paychecks")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SCHEDULED)
    paid_on = models.DateField(null=True, blank=True)
    payment_method = models.ForeignKey(PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-pay_date", "person__first_name"]

    def __str__(self):
        return f"{self.person} {self.pay_date}"

    @property
    def wages(self):
        return (self.quantity * self.rate).quantize(Decimal("0.01"))

    @property
    def reimbursements(self):
        return sum((receipt.amount or Decimal("0") for receipt in self.receipts.all()), Decimal("0.00"))

    @property
    def total(self):
        return self.wages + self.adjustment + self.reimbursements


class Payment(models.Model):
    """Money that has gone out (Outgoing)."""

    class Kind(models.TextChoices):
        VENDOR = "vendor", "Vendor"
        PAYROLL = "payroll", "Payroll"
        DRAFT = "draft", "Auto draft"
        OTHER = "other", "Other"

    paid_on = models.DateField()
    payee = models.CharField(max_length=150)
    amount = money_field(validators=POSITIVE)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.OTHER)
    description = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=100, blank=True, help_text="Check number, confirmation, etc.")
    payment_method = models.ForeignKey(PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL)
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments")
    paycheck = models.ForeignKey(
        Paycheck, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments"
    )
    auto_draft = models.ForeignKey(
        AutoDraft, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_on", "-created_at"]

    def __str__(self):
        return f"{self.payee} {self.amount}"


class Deposit(models.Model):
    """Money that has come in (Incoming)."""

    received_on = models.DateField()
    source = models.CharField(max_length=150, help_text="Who it came from.")
    amount = money_field(validators=POSITIVE)
    description = models.CharField(max_length=255, blank=True)
    deposited_into = models.ForeignKey(PaymentMethod, null=True, blank=True, on_delete=models.SET_NULL)
    document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_on", "-created_at"]

    def __str__(self):
        return f"{self.source} {self.amount}"
