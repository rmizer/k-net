from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("payment-methods", views.PaymentMethodViewSet)
router.register("invoices", views.InvoiceViewSet)
router.register("auto-drafts", views.AutoDraftViewSet)
router.register("payments", views.PaymentViewSet)
router.register("deposits", views.DepositViewSet)
router.register("paychecks", views.PaycheckViewSet, basename="paycheck")
router.register("payroll", views.PayrollViewSet, basename="payroll")

urlpatterns = [
    path("overview/", views.OverviewView.as_view(), name="finance-overview"),
    path("calendar/", views.CalendarView.as_view(), name="finance-calendar"),
    *router.urls,
]
