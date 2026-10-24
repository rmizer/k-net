from decimal import Decimal

from django.core.validators import FileExtensionValidator
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from documents.models import ALLOWED_EXTENSIONS, Document

from .models import AutoDraft, Deposit, Invoice, Paycheck, PaymentMethod, PayRate, Payment, looks_like_amex

MAX_UPLOAD_MB = 20


def _file_field():
    return serializers.FileField(
        write_only=True, required=False, validators=[FileExtensionValidator(ALLOWED_EXTENSIONS)]
    )


def _check_size(file):
    if file and file.size > MAX_UPLOAD_MB * 1024 * 1024:
        raise serializers.ValidationError(f"Files can be up to {MAX_UPLOAD_MB} MB.")
    return file


def _file_document(owner, file, title, category, user):
    """Files `file` under Documents, replacing the owner's current one."""
    if owner.document_id:
        document = owner.document
        document.file.delete(save=False)
        document.title = title
    else:
        document = Document(title=title, category=category, uploaded_by=user)
    document.file = file
    document.save()
    return document


class PaymentMethodSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    label = serializers.CharField(source="__str__", read_only=True)
    uses = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMethod
        fields = [
            "id",
            "name",
            "kind",
            "kind_display",
            "label",
            "institution",
            "last_digits",
            "holder",
            "notes",
            "is_active",
            "uses",
        ]
        extra_kwargs = {"name": {"error_messages": {"blank": "Give this payment method a name."}}}

    def get_uses(self, method):
        """How many records point at this method (shown before deleting it)."""
        return sum(
            model.objects.filter(**{field: method}).count()
            for model, field in [
                (Payment, "payment_method"),
                (Invoice, "payment_method"),
                (AutoDraft, "payment_method"),
                (Paycheck, "payment_method"),
                (Deposit, "deposited_into"),
            ]
        )

    def validate_last_digits(self, value):
        return value.strip()

    def validate(self, attrs):
        # American Express cards are known by their last five digits; others by four.
        get = lambda field: attrs.get(field, getattr(self.instance, field, ""))
        digits = get("last_digits")
        if digits:
            amex = get("kind") == PaymentMethod.Kind.CARD and looks_like_amex(get("institution"), get("name"))
            if amex and len(digits) != 5:
                raise serializers.ValidationError({"last_digits": "American Express cards: enter the last five digits."})
            if not amex and len(digits) != 4:
                raise serializers.ValidationError({"last_digits": "Enter the last four digits."})
        return attrs


class _MethodNameMixin(serializers.Serializer):
    payment_method_label = serializers.CharField(source="payment_method.__str__", read_only=True, default=None)


class InvoiceSerializer(_MethodNameMixin, serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    file = _file_field()
    document_id = serializers.IntegerField(source="document.id", read_only=True, default=None)
    file_name = serializers.CharField(source="document.file_name", read_only=True, default=None)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "vendor",
            "number",
            "description",
            "amount",
            "issued_on",
            "due_on",
            "status",
            "status_display",
            "is_overdue",
            "paid_on",
            "payment_method",
            "payment_method_label",
            "file",
            "document_id",
            "file_name",
            "archived",
            "created_at",
        ]
        extra_kwargs = {"vendor": {"error_messages": {"blank": "Who is the invoice from?"}}}

    def validate_file(self, file):
        return _check_size(file)

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", Invoice.Status.UNPAID))
        if status == Invoice.Status.PAID and not attrs.get("paid_on", getattr(self.instance, "paid_on", None)):
            attrs["paid_on"] = timezone.localdate()
        if status != Invoice.Status.PAID:
            attrs["paid_on"] = None
        issued = attrs.get("issued_on", getattr(self.instance, "issued_on", None))
        due = attrs.get("due_on", getattr(self.instance, "due_on", None))
        if issued and due and due < issued:
            raise serializers.ValidationError({"due_on": "The due date can't be before the invoice date."})
        return attrs

    def save(self, **kwargs):
        file = self.validated_data.pop("file", None)
        invoice = super().save(**kwargs)
        if file:
            title = f"Invoice {invoice.number}: {invoice.vendor}" if invoice.number else f"Invoice: {invoice.vendor}"
            user = self.context["request"].user
            invoice.document = _file_document(invoice, file, title, Document.Category.INVOICE, user)
            invoice.save(update_fields=["document"])
        return invoice


class PayInvoiceSerializer(serializers.Serializer):
    paid_on = serializers.DateField(required=False)
    payment_method = serializers.PrimaryKeyRelatedField(
        queryset=PaymentMethod.objects.all(), required=False, allow_null=True
    )
    reference = serializers.CharField(required=False, allow_blank=True, max_length=100)


class AutoDraftSerializer(_MethodNameMixin, serializers.ModelSerializer):
    frequency_display = serializers.CharField(source="get_frequency_display", read_only=True)

    class Meta:
        model = AutoDraft
        fields = [
            "id",
            "payee",
            "description",
            "amount",
            "frequency",
            "frequency_display",
            "next_on",
            "payment_method",
            "payment_method_label",
            "is_active",
        ]
        extra_kwargs = {"payee": {"error_messages": {"blank": "Who is the draft paid to?"}}}


class PaymentSerializer(_MethodNameMixin, serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    invoice_label = serializers.CharField(source="invoice.__str__", read_only=True, default=None)
    paycheck_person = serializers.IntegerField(source="paycheck.person_id", read_only=True, default=None)

    class Meta:
        model = Payment
        fields = [
            "id",
            "paid_on",
            "payee",
            "amount",
            "kind",
            "kind_display",
            "description",
            "reference",
            "payment_method",
            "payment_method_label",
            "invoice",
            "invoice_label",
            "paycheck",
            "paycheck_person",
            "auto_draft",
        ]
        read_only_fields = ["invoice", "paycheck", "auto_draft"]
        extra_kwargs = {"payee": {"error_messages": {"blank": "Who was paid?"}}}


class DepositSerializer(serializers.ModelSerializer):
    deposited_into_label = serializers.CharField(source="deposited_into.__str__", read_only=True, default=None)
    file = _file_field()
    document_id = serializers.IntegerField(source="document.id", read_only=True, default=None)
    file_name = serializers.CharField(source="document.file_name", read_only=True, default=None)

    class Meta:
        model = Deposit
        fields = [
            "id",
            "received_on",
            "source",
            "amount",
            "description",
            "deposited_into",
            "deposited_into_label",
            "file",
            "document_id",
            "file_name",
        ]
        extra_kwargs = {"source": {"error_messages": {"blank": "Who did the money come from?"}}}

    def validate_file(self, file):
        return _check_size(file)

    def save(self, **kwargs):
        file = self.validated_data.pop("file", None)
        deposit = super().save(**kwargs)
        if file:
            title = f"Deposit: {deposit.source}, {deposit.received_on:%b} {deposit.received_on.day}"
            user = self.context["request"].user
            deposit.document = _file_document(deposit, file, title, Document.Category.OTHER, user)
            deposit.save(update_fields=["document"])
        return deposit


# Payroll


class ReceiptSummarySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    paycheck = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "vendor",
            "amount",
            "purchase_date",
            "status",
            "status_display",
            "paycheck",
            "created_at",
        ]

    def get_paycheck(self, receipt):
        paychecks = list(receipt.paychecks.all())
        return paychecks[0].pk if paychecks else None


class PaycheckSerializer(_MethodNameMixin, serializers.ModelSerializer):
    person_name = serializers.CharField(source="person.get_full_name", read_only=True)
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    wages = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    reimbursements = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    rate = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    unit = serializers.ChoiceField(choices=PayRate.Unit.choices, required=False)
    receipts = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Document.objects.filter(category=Document.Category.RECEIPT)
    )
    receipt_details = ReceiptSummarySerializer(source="receipts", many=True, read_only=True)

    class Meta:
        model = Paycheck
        fields = [
            "id",
            "person",
            "person_name",
            "period_start",
            "period_end",
            "pay_date",
            "unit",
            "unit_display",
            "quantity",
            "rate",
            "adjustment",
            "receipts",
            "receipt_details",
            "wages",
            "reimbursements",
            "total",
            "status",
            "status_display",
            "paid_on",
            "payment_method",
            "payment_method_label",
            "notes",
        ]
        read_only_fields = ["status", "paid_on"]

    def validate(self, attrs):
        if self.instance and self.instance.status == Paycheck.Status.PAID:
            changed = set(attrs) - {"notes"}
            if changed:
                raise serializers.ValidationError("This paycheck has been paid, so only its notes can change.")
        person = attrs.get("person", getattr(self.instance, "person", None))
        start = attrs.get("period_start", getattr(self.instance, "period_start", None))
        end = attrs.get("period_end", getattr(self.instance, "period_end", None))
        if start and end and end < start:
            raise serializers.ValidationError({"period_end": "The period can't end before it starts."})

        # Default to the person's pay rate.
        if not self.instance and ("rate" not in attrs or "unit" not in attrs):
            pay_rate = PayRate.objects.filter(person=person).first()
            if not pay_rate:
                raise serializers.ValidationError({"rate": "Set a pay rate for this person, or enter one here."})
            attrs.setdefault("rate", pay_rate.rate)
            attrs.setdefault("unit", pay_rate.unit)

        for receipt in attrs.get("receipts", []):
            if receipt.uploaded_by_id != person.pk:
                raise serializers.ValidationError({"receipts": f"“{receipt.title}” was submitted by someone else."})
            others = receipt.paychecks.exclude(pk=getattr(self.instance, "pk", None))
            if others.exists():
                raise serializers.ValidationError({"receipts": f"“{receipt.title}” is already on another paycheck."})
        return attrs

    def save(self, **kwargs):
        before = set(self.instance.receipts.values_list("pk", flat=True)) if self.instance else set()
        paycheck = super().save(**kwargs)
        after = set(paycheck.receipts.values_list("pk", flat=True))
        # Receipts on a paycheck count as Processed (added to pay); taking one off sends it back.
        for receipt in Document.objects.filter(pk__in=after - before):
            receipt.set_status(Document.Status.PROCESSED)
            receipt.save(update_fields=["status", "status_changed_at", "updated_at"])
        for receipt in Document.objects.filter(pk__in=before - after):
            receipt.set_status(Document.Status.IN_PROCESS)
            receipt.save(update_fields=["status", "status_changed_at", "updated_at"])
        return paycheck


class PayRateSerializer(serializers.ModelSerializer):
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)

    class Meta:
        model = PayRate
        fields = ["unit", "unit_display", "rate", "notes"]


class PayrollPersonSerializer(serializers.ModelSerializer):
    """A row in the staff pay table."""

    name = serializers.CharField(source="get_full_name")
    role_display = serializers.CharField(source="get_role_display")
    department_name = serializers.CharField(source="department.name", default=None)
    pay_rate = serializers.SerializerMethodField()
    paid_to_date = serializers.SerializerMethodField()
    last_paid_on = serializers.SerializerMethodField()
    next_paycheck = serializers.SerializerMethodField()
    unreimbursed = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "role",
            "role_display",
            "department_name",
            "is_active_crew",
            "pay_rate",
            "paid_to_date",
            "last_paid_on",
            "next_paycheck",
            "unreimbursed",
        ]

    def _paychecks(self, person):
        return list(person.paychecks.all())

    def get_pay_rate(self, person):
        rate = getattr(person, "pay_rate", None)
        return PayRateSerializer(rate).data if rate else None

    def get_paid_to_date(self, person):
        paid = [p.total for p in self._paychecks(person) if p.status == Paycheck.Status.PAID]
        return str(sum(paid, Decimal("0.00")))

    def get_last_paid_on(self, person):
        dates = [p.paid_on for p in self._paychecks(person) if p.paid_on]
        return max(dates) if dates else None

    def get_next_paycheck(self, person):
        scheduled = sorted(
            (p for p in self._paychecks(person) if p.status == Paycheck.Status.SCHEDULED), key=lambda p: p.pay_date
        )
        if not scheduled:
            return None
        return {"id": scheduled[0].pk, "pay_date": scheduled[0].pay_date, "total": str(scheduled[0].total)}

    def get_unreimbursed(self, person):
        receipts = [r for r in self.context["receipts"].get(person.pk, []) if not r.paychecks.all()]
        total = sum((r.amount or Decimal("0") for r in receipts), Decimal("0.00"))
        return {"count": len(receipts), "total": str(total)}


def receipts_by_person(people):
    """Every receipt from these people, keyed by uploader, with paychecks prefetched."""
    receipts = Document.objects.filter(uploaded_by__in=people, category=Document.Category.RECEIPT).prefetch_related(
        "paychecks"
    )
    grouped = {}
    for receipt in receipts:
        grouped.setdefault(receipt.uploaded_by_id, []).append(receipt)
    return grouped
