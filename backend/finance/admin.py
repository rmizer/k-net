from django.contrib import admin

from .models import AutoDraft, Deposit, Invoice, Paycheck, PaymentMethod, PayRate, Payment


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "institution", "last4", "is_active"]
    list_filter = ["kind", "is_active"]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["vendor", "number", "amount", "due_on", "status", "archived"]
    list_filter = ["status", "archived"]
    search_fields = ["vendor", "number", "description"]


@admin.register(AutoDraft)
class AutoDraftAdmin(admin.ModelAdmin):
    list_display = ["payee", "amount", "frequency", "next_on", "is_active"]


@admin.register(PayRate)
class PayRateAdmin(admin.ModelAdmin):
    list_display = ["person", "rate", "unit"]


@admin.register(Paycheck)
class PaycheckAdmin(admin.ModelAdmin):
    list_display = ["person", "pay_date", "period_start", "period_end", "status"]
    list_filter = ["status", "pay_date"]
    filter_horizontal = ["receipts"]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["paid_on", "payee", "amount", "kind"]
    list_filter = ["kind"]
    search_fields = ["payee", "description", "reference"]


@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    list_display = ["received_on", "source", "amount", "deposited_into"]
    search_fields = ["source", "description"]
