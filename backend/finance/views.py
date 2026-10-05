from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsManagerLevel
from documents.models import Document

from .models import AutoDraft, Deposit, Invoice, Paycheck, PaymentMethod, PayRate, Payment
from .serializers import (
    AutoDraftSerializer,
    DepositSerializer,
    InvoiceSerializer,
    PaycheckSerializer,
    PayInvoiceSerializer,
    PaymentMethodSerializer,
    PaymentSerializer,
    PayRateSerializer,
    PayrollPersonSerializer,
    ReceiptSummarySerializer,
    receipts_by_person,
)

UPLOAD_PARSERS = [MultiPartParser, FormParser, JSONParser]


class FinanceViewSet(viewsets.ModelViewSet):
    """Finance is for Directors, Assistants and Site Managers only."""

    permission_classes = [IsManagerLevel]


def _pay_details(request):
    details = PayInvoiceSerializer(data=request.data)
    details.is_valid(raise_exception=True)
    data = details.validated_data
    return data.get("paid_on") or timezone.localdate(), data.get("payment_method"), data.get("reference", "")


class PaymentMethodViewSet(FinanceViewSet):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer


class InvoiceViewSet(FinanceViewSet):
    queryset = Invoice.objects.select_related("payment_method", "document")
    serializer_class = InvoiceSerializer
    parser_classes = UPLOAD_PARSERS

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        """Mark paid and record the payment under Outgoing."""
        invoice = self.get_object()
        if invoice.status == Invoice.Status.PAID:
            raise ValidationError("This invoice is already paid.")
        paid_on, method, reference = _pay_details(request)
        with transaction.atomic():
            Payment.objects.create(
                paid_on=paid_on,
                payee=invoice.vendor,
                amount=invoice.amount,
                kind=Payment.Kind.VENDOR,
                description=f"Invoice {invoice.number}".strip() if invoice.number else "Invoice",
                reference=reference,
                payment_method=method or invoice.payment_method,
                invoice=invoice,
                created_by=request.user,
            )
            invoice.status, invoice.paid_on = Invoice.Status.PAID, paid_on
            invoice.payment_method = method or invoice.payment_method
            invoice.save()
        return Response(self.get_serializer(invoice).data)


class AutoDraftViewSet(FinanceViewSet):
    queryset = AutoDraft.objects.select_related("payment_method")
    serializer_class = AutoDraftSerializer

    @action(detail=True, methods=["post"])
    def record(self, request, pk=None):
        """The draft went through: record it under Outgoing and move to the next date."""
        draft = self.get_object()
        paid_on, method, reference = _pay_details(request)
        with transaction.atomic():
            Payment.objects.create(
                paid_on=paid_on,
                payee=draft.payee,
                amount=draft.amount,
                kind=Payment.Kind.DRAFT,
                description=draft.description,
                reference=reference,
                payment_method=method or draft.payment_method,
                auto_draft=draft,
                created_by=request.user,
            )
            draft.next_on = draft.following(draft.next_on)
            draft.save(update_fields=["next_on"])
        return Response(self.get_serializer(draft).data)


class PaymentViewSet(FinanceViewSet):
    queryset = Payment.objects.select_related("payment_method", "invoice", "paycheck")
    serializer_class = PaymentSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, payment):
        # Undoing a payment puts what it paid back to unpaid.
        with transaction.atomic():
            if payment.invoice_id:
                Invoice.objects.filter(pk=payment.invoice_id).update(status=Invoice.Status.UNPAID, paid_on=None)
            if payment.paycheck_id:
                Paycheck.objects.filter(pk=payment.paycheck_id).update(status=Paycheck.Status.SCHEDULED, paid_on=None)
            payment.delete()


class DepositViewSet(FinanceViewSet):
    queryset = Deposit.objects.select_related("deposited_into", "document")
    serializer_class = DepositSerializer
    parser_classes = UPLOAD_PARSERS

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


def _paychecks():
    return Paycheck.objects.select_related("person", "payment_method").prefetch_related(
        Prefetch("receipts", queryset=Document.objects.prefetch_related("paychecks"))
    )


class PaycheckViewSet(FinanceViewSet):
    serializer_class = PaycheckSerializer

    def get_queryset(self):
        person = self.request.query_params.get("person")
        return _paychecks().filter(person_id=person) if person else _paychecks()

    def perform_destroy(self, paycheck):
        if paycheck.status == Paycheck.Status.PAID:
            raise ValidationError("A paid paycheck can't be deleted. Remove its payment under Outgoing first.")
        for receipt in paycheck.receipts.all():
            receipt.set_status(Document.Status.IN_PROCESS)
            receipt.save(update_fields=["status", "status_changed_at", "updated_at"])
        paycheck.delete()

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        paycheck = self.get_object()
        if paycheck.status == Paycheck.Status.PAID:
            raise ValidationError("This paycheck is already paid.")
        paid_on, method, reference = _pay_details(request)
        with transaction.atomic():
            Payment.objects.create(
                paid_on=paid_on,
                payee=paycheck.person.get_full_name(),
                amount=paycheck.total,
                kind=Payment.Kind.PAYROLL,
                description=f"Pay for {paycheck.period_start:%b} {paycheck.period_start.day} to "
                f"{paycheck.period_end:%b} {paycheck.period_end.day}",
                reference=reference,
                payment_method=method or paycheck.payment_method,
                paycheck=paycheck,
                created_by=request.user,
            )
            paycheck.status, paycheck.paid_on = Paycheck.Status.PAID, paid_on
            paycheck.payment_method = method or paycheck.payment_method
            paycheck.save()
        return Response(self.get_serializer(paycheck).data)


def _payroll_people():
    return (
        User.objects.exclude(role=User.Role.SITE_MANAGER)
        .filter(is_active=True)
        .select_related("department", "pay_rate")
        .prefetch_related(Prefetch("paychecks", queryset=Paycheck.objects.prefetch_related("receipts")))
        .order_by("first_name", "last_name")
    )


class PayrollViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """The staff pay table, a page per person, and setting pay rates."""

    permission_classes = [IsManagerLevel]
    serializer_class = PayrollPersonSerializer

    def get_queryset(self):
        return _payroll_people()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["receipts"] = receipts_by_person(self.get_queryset())
        return context

    def retrieve(self, request, pk=None):
        person = get_object_or_404(self.get_queryset(), pk=pk)
        context = self.get_serializer_context()
        data = self.get_serializer(person, context=context).data
        data["paychecks"] = PaycheckSerializer(_paychecks().filter(person=person), many=True, context=context).data
        data["receipts"] = ReceiptSummarySerializer(context["receipts"].get(person.pk, []), many=True).data
        return Response(data)

    @action(detail=True, methods=["put"])
    def rate(self, request, pk=None):
        person = get_object_or_404(self.get_queryset(), pk=pk)
        instance = PayRate.objects.filter(person=person).first()
        serializer = PayRateSerializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(person=person)
        return Response(serializer.data, status=status.HTTP_200_OK)


def _sum(queryset):
    return queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


class OverviewView(APIView):
    """Everything the Finance overview shows."""

    permission_classes = [IsManagerLevel]

    def get(self, request):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        open_invoices = Invoice.objects.exclude(status=Invoice.Status.PAID).filter(archived=False)
        upcoming = Paycheck.objects.filter(status=Paycheck.Status.SCHEDULED).select_related("person")
        receipts = (
            Document.objects.filter(category=Document.Category.RECEIPT)
            .exclude(status=Document.Status.PROCESSED)
            .select_related("uploaded_by")
            .order_by("created_at")
        )
        context = {"request": request}

        next_pay_date = upcoming.order_by("pay_date").values_list("pay_date", flat=True).first()
        next_payroll = [p for p in upcoming if p.pay_date == next_pay_date]
        week_out = today + timedelta(days=7)

        return Response(
            {
                "today": today,
                "invoices_due": InvoiceSerializer(
                    open_invoices.select_related("payment_method", "document"), many=True, context=context
                ).data,
                "due_this_week": _sum(open_invoices.filter(due_on__lte=week_out)),
                "next_payroll": {
                    "pay_date": next_pay_date,
                    "count": len(next_payroll),
                    "total": sum((p.total for p in next_payroll), Decimal("0.00")),
                }
                if next_pay_date
                else None,
                "upcoming_paychecks": PaycheckSerializer(
                    upcoming.order_by("pay_date"), many=True, context=context
                ).data,
                "receipts": [
                    {
                        "id": r.pk,
                        "title": r.title,
                        "person": r.uploaded_by.get_full_name() if r.uploaded_by else None,
                        "person_id": r.uploaded_by_id,
                        "amount": r.amount,
                        "status": r.status,
                        "status_display": r.get_status_display(),
                        "submitted_on": timezone.localdate(r.created_at),
                    }
                    for r in receipts
                ],
                "auto_drafts": AutoDraftSerializer(AutoDraft.objects.filter(is_active=True), many=True).data,
                "month": {
                    "incoming": _sum(Deposit.objects.filter(received_on__gte=month_start, received_on__lte=today)),
                    "outgoing": _sum(Payment.objects.filter(paid_on__gte=month_start, paid_on__lte=today)),
                },
            }
        )


class CalendarView(APIView):
    """Money dates between ?start= and ?end= (inclusive): what's due, what's scheduled,
    and what already went in or out."""

    permission_classes = [IsManagerLevel]

    def get(self, request):
        start = parse_date(request.query_params.get("start", ""))
        end = parse_date(request.query_params.get("end", ""))
        if not (start and end) or end < start or (end - start).days > 62:
            raise ValidationError("Send start and end dates (YYYY-MM-DD), at most 62 days apart.")
        items = []

        def add(day, kind, title, amount, done, link):
            items.append({"date": day, "kind": kind, "title": title, "amount": amount, "done": done, "link": link})

        for invoice in Invoice.objects.filter(due_on__range=(start, end), archived=False):
            done = invoice.status == Invoice.Status.PAID
            add(invoice.due_on, "invoice", f"{invoice.vendor} invoice due", invoice.amount, done, "/finance/invoices")

        paydays = {}
        for paycheck in Paycheck.objects.filter(pay_date__range=(start, end)).prefetch_related("receipts"):
            day = paydays.setdefault(paycheck.pay_date, {"count": 0, "total": Decimal("0"), "paid": True})
            day["count"] += 1
            day["total"] += paycheck.total
            day["paid"] &= paycheck.status == Paycheck.Status.PAID
        for day, info in paydays.items():
            people = f"{info['count']} {'person' if info['count'] == 1 else 'people'}"
            add(day, "payroll", f"Payroll ({people})", info["total"], info["paid"], "/finance/payroll")

        for draft in AutoDraft.objects.filter(is_active=True):
            for day in draft.dates_between(start, end):
                add(day, "draft", f"Auto draft: {draft.payee}", draft.amount, False, "/finance/outgoing")
        for draft_payment in Payment.objects.filter(kind=Payment.Kind.DRAFT, paid_on__range=(start, end)):
            title = f"Auto draft: {draft_payment.payee}"
            add(draft_payment.paid_on, "draft", title, draft_payment.amount, True, "/finance/outgoing")

        for deposit in Deposit.objects.filter(received_on__range=(start, end)):
            add(deposit.received_on, "deposit", f"From {deposit.source}", deposit.amount, True, "/finance/incoming")

        items.sort(key=lambda item: (item["date"], item["kind"], item["title"]))
        return Response(items)
