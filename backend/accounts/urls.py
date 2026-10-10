from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet)
router.register("departments", views.DepartmentViewSet)
router.register("removal-requests", views.RemovalRequestViewSet, basename="removal-request")

urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/signup/", views.SignupView.as_view(), name="auth-signup"),
    path("auth/verify-email/", views.VerifyEmailView.as_view(), name="auth-verify-email"),
    path("auth/resend-verification/", views.ResendVerificationView.as_view(), name="auth-resend-verification"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
    path("auth/me/picture/", views.ProfilePictureView.as_view(), name="auth-me-picture"),
    path("", include(router.urls)),
]
