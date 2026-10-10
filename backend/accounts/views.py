import logging

from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from tasks.models import Task
from tasks.onboarding import add_starter_tasks

from .emails import send_verification_email
from .models import Department, User
from .permissions import IsSiteManager, ReadOnlyOrManagerLevel
from .serializers import (
    DepartmentSerializer,
    LoginSerializer,
    ProfilePictureSerializer,
    ProfileSerializer,
    SignupSerializer,
    UserSerializer,
)
from .tokens import email_verification_token

logger = logging.getLogger(__name__)


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    """Sets the CSRF cookie so the React app can make POST requests."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["email"].lower(),
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"detail": "Invalid email or password."}, status=status.HTTP_400_BAD_REQUEST
            )
        if not user.email_verified:
            return Response(
                {
                    "detail": "Please verify your email first. Check your inbox for the link we sent.",
                    "code": "email_unverified",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        return Response(ProfileSerializer(user, context={"request": request}).data)


class SignupView(APIView):
    """Creates a Staff account that can't sign in until the email is verified."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        response = Response({"email": data["email"]}, status=status.HTTP_201_CREATED)
        if data.get("website"):
            return response  # A bot filled in the hidden field; pretend it worked.

        with transaction.atomic():
            user = User.objects.filter(email__iexact=data["email"]).first() or User(
                email=data["email"], role=User.Role.STAFF
            )
            user.first_name = data["first_name"]
            user.last_name = data["last_name"]
            user.phone = data["phone"]
            user.email_verified = False
            user.privacy_accepted_at = timezone.now()
            user.set_password(data["password"])
            user.save()
            add_starter_tasks(user)
        try:
            send_verification_email(user)
        except Exception:
            logger.exception("Couldn't send the verification email to %s", user.email)
            return Response(
                {"detail": "Your account was created, but we couldn't send the verification email. "
                 "Use \"Resend email\" on the next page to try again."},
                status=status.HTTP_201_CREATED,
            )
        return response


class VerifyEmailView(APIView):
    """Confirms the link from the sign-up email, then signs the person in."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verification"

    def post(self, request):
        try:
            pk = force_str(urlsafe_base64_decode(request.data.get("uid", "")))
            user = User.objects.get(pk=pk, is_active=True)
        except (ValueError, TypeError, User.DoesNotExist):
            user = None
        if user is None or not email_verification_token.check_token(user, request.data.get("token", "")):
            return Response(
                {"detail": "This link has expired or was already used. Try logging in, or ask for a new link."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        login(request, user)
        return Response(ProfileSerializer(user, context={"request": request}).data)


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verification"

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True, email_verified=False).first()
        if user is not None:
            try:
                send_verification_email(user)
            except Exception:
                logger.exception("Couldn't resend the verification email to %s", user.email)
                return Response(
                    {"detail": "We couldn't send the email just now. Please try again in a few minutes."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        # The same answer either way, so this can't be used to find out who has an account.
        return Response({"detail": "If that address is waiting to be verified, we've sent a new link."})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """The signed-in user's own profile. Returns null when signed out so the
    app can check the session without an error response."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return super().get_permissions()

    def get(self, request):
        if not request.user.is_authenticated:
            return Response(None)
        return Response(ProfileSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        serializer = ProfileSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if user.slack_joined:
            # Saying "I've joined" on the Staff Hub also ticks off the task.
            for task in Task.objects.filter(
                assigned_to=user, key=Task.Key.JOIN_SLACK
            ).exclude(status=Task.Status.DONE):
                task.status = Task.Status.DONE
                task.save()
        return Response(serializer.data)


class ProfilePictureView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ProfilePictureSerializer(request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProfileSerializer(request.user, context={"request": request}).data)


class UserViewSet(viewsets.ModelViewSet):
    """Staff accounts. Everyone signed in can view the directory; Directors,
    Assistants and Site Managers can add and edit accounts within the roles
    they're allowed to assign."""

    queryset = User.objects.select_related("department").filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk or not self.request.user.can_assign_role(instance.role):
            raise PermissionDenied("You don't have permission to remove this account.")
        # Deactivate instead of deleting so records tied to the person are kept.
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=["post"], permission_classes=[IsSiteManager])
    def verify(self, request, pk=None):
        """Site Managers can verify a sign-up by hand, e.g. when the email never arrives."""
        user = self.get_object()
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return Response(self.get_serializer(user).data)

    @action(detail=False, permission_classes=[IsAuthenticated])
    def crew(self, request):
        """Active crew only, for the Staff / Crew page."""
        users = self.get_queryset().filter(is_active_crew=True)
        return Response(self.get_serializer(users, many=True).data)


class DepartmentViewSet(viewsets.ModelViewSet):
    """Everyone can read; Directors, Assistants and Site Managers add, rename and
    delete departments. Deleting one leaves its members and tasks unassigned."""

    queryset = Department.objects.annotate(
        member_count=Count("members", filter=Q(members__is_active=True))
    )
    serializer_class = DepartmentSerializer
    permission_classes = [ReadOnlyOrManagerLevel]
