import logging

from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.utils.dateparse import parse_date
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

from notifications import slack
from schedule.models import crew_calls
from tasks.models import Task
from tasks.onboarding import add_starter_tasks

from .emails import (
    send_email_change_email,
    send_email_changed_notice,
    send_removal_request_email,
    send_verification_email,
)
from .models import Department, RemovalRequest, User
from .permissions import IsManagerLevel, IsSiteManager, ReadOnlyOrManagerLevel
from .serializers import (
    DepartmentSerializer,
    EmailChangeSerializer,
    LoginSerializer,
    ProfilePictureSerializer,
    ProfileSerializer,
    RemovalRequestSerializer,
    SignupSerializer,
    UserSerializer,
)
from .tokens import email_change_token, email_verification_token

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
                    "detail": "Please verify your email first. Check your inbox, and your spam folder, "
                    "for the link we sent.",
                    "code": "email_unverified",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        if not serializer.validated_data["remember"]:
            # Logged out when the browser closes, e.g. on a shared device.
            request.session.set_expiry(0)
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


class EmailChangeView(APIView):
    """Someone changing their own email. POST sends a confirmation link to the new
    address (nothing changes until it's clicked); DELETE cancels a pending change.
    Allowed once every two weeks."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verification"

    def post(self, request):
        user = request.user
        serializer = EmailChangeSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        user.pending_email = serializer.validated_data["email"]
        user.save(update_fields=["pending_email"])
        try:
            send_email_change_email(user)
        except Exception:
            logger.exception("Couldn't send the email change link to %s", user.pending_email)
            return Response(
                {"detail": "We couldn't send the confirmation email just now. Please try again in a few minutes."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(ProfileSerializer(user, context={"request": request}).data)

    def delete(self, request):
        user = request.user
        if user.pending_email:
            user.pending_email = ""
            user.save(update_fields=["pending_email"])
        return Response(ProfileSerializer(user, context={"request": request}).data)


class ConfirmEmailChangeView(APIView):
    """The link from the email-change email. Works whether or not the person is
    signed in on this device, and doesn't sign anyone in."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verification"

    def post(self, request):
        try:
            pk = force_str(urlsafe_base64_decode(request.data.get("uid", "")))
            user = User.objects.get(pk=pk, is_active=True)
        except (ValueError, TypeError, User.DoesNotExist):
            user = None
        if (
            user is None
            or not user.pending_email
            or not email_change_token.check_token(user, request.data.get("token", ""))
        ):
            return Response(
                {"detail": "This link has expired or was already used. You can ask for a new one on your Account page."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email__iexact=user.pending_email).exclude(pk=user.pk).exists():
            return Response(
                {"detail": "Another account started using this email in the meantime, so we couldn't change it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_email = user.email
        user.email = user.pending_email
        user.pending_email = ""
        user.email_changed_at = timezone.now()
        user.email_verified = True
        user.slack_user_id = ""  # Found again in Slack under the new address.
        user.save(update_fields=["email", "pending_email", "email_changed_at", "email_verified", "slack_user_id"])
        try:
            send_email_changed_notice(old_email, user)
        except Exception:
            logger.exception("Couldn't send the email-changed notice to %s", old_email)
        return Response({"email": user.email})


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
        # Only Site Managers delete accounts; Directors and Assistants request removal.
        if not self.request.user.is_site_manager:
            raise PermissionDenied("Only Site Managers can delete accounts. Use Request removal instead.")
        if instance.pk == self.request.user.pk:
            raise PermissionDenied("You can't delete your own account.")
        deactivate(instance, by=self.request.user)

    @action(detail=True, methods=["post"], url_path="request-removal", permission_classes=[IsManagerLevel])
    def request_removal(self, request, pk=None):
        """Directors and Assistants ask the Site Managers to remove someone they manage."""
        person = self.get_object()
        if person.pk == request.user.pk or not request.user.can_assign_role(person.role):
            raise PermissionDenied("You can't request removal of this account.")
        reason = str(request.data.get("reason", "")).strip()[:2000]
        removal = RemovalRequest.objects.filter(person=person, status=RemovalRequest.Status.PENDING).first()
        created = removal is None
        if created:
            removal = RemovalRequest.objects.create(person=person, requested_by=request.user, reason=reason)
            try:
                send_removal_request_email(removal)
            except Exception:
                logger.exception("Couldn't email the Site Managers about removal request %s", removal.pk)
        return Response(
            RemovalRequestSerializer(removal).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsSiteManager])
    def verify(self, request, pk=None):
        """Site Managers can verify a sign-up by hand, e.g. when the email never arrives."""
        user = self.get_object()
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return Response(self.get_serializer(user).data)

    @action(detail=False, methods=["post"], url_path="slack-check", permission_classes=[IsSiteManager])
    def slack_check(self, request):
        """Site Managers: match every account to Slack by email now, so the
        Slack column is current before anyone is assigned a task."""
        if not slack.is_enabled():
            return Response({"detail": "Slack isn't set up on the server."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            linked = slack.match_users()
        except slack.SlackError as err:
            logger.warning("Slack check failed: %s", err)
            return Response({"detail": f"Slack said: {err}"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"linked": linked})

    @action(detail=False, permission_classes=[IsAuthenticated])
    def crew(self, request):
        """Who's working, by the schedule, for the Staff / Crew page: today, or
        ?date=YYYY-MM-DD. Each person comes with their call: the time, place and
        title of their first event that day."""
        day = parse_date(request.query_params.get("date") or "") or timezone.localdate()
        calls = crew_calls(day)
        people = sorted(calls, key=lambda person: (calls[person].all_day, calls[person].start, person.first_name))
        data = []
        for person, row in zip(people, self.get_serializer(people, many=True).data):
            event = calls[person]
            row["call"] = {
                "event": event.pk,
                "title": event.title,
                "time": None if event.all_day else timezone.localtime(event.start).strftime("%H:%M"),
                "location": event.location,
            }
            data.append(row)
        return Response({"date": day, "crew": data})


def deactivate(person, by):
    """Deletes an account the K-Net way: it's deactivated (can't sign in, hidden
    everywhere) but its records are kept, and a Site Manager can restore it in
    the admin. Any open removal requests for the person are closed."""
    person.is_active = False
    person.save()
    person.removal_requests.filter(status=RemovalRequest.Status.PENDING).update(
        status=RemovalRequest.Status.APPROVED, resolved_at=timezone.now(), resolved_by=by
    )


class RemovalRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Open removal requests, for Site Managers to act on."""

    serializer_class = RemovalRequestSerializer
    permission_classes = [IsSiteManager]

    def get_queryset(self):
        return RemovalRequest.objects.filter(
            status=RemovalRequest.Status.PENDING, person__is_active=True
        ).select_related("person", "requested_by")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Delete the account."""
        removal = self.get_object()
        if removal.person.pk == request.user.pk:
            raise PermissionDenied("You can't delete your own account.")
        deactivate(removal.person, by=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        removal = self.get_object()
        removal.status = RemovalRequest.Status.DISMISSED
        removal.resolved_at = timezone.now()
        removal.resolved_by = request.user
        removal.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentViewSet(viewsets.ModelViewSet):
    """Everyone can read; Directors, Assistants and Site Managers add, rename and
    delete departments. Deleting one leaves its members and tasks unassigned."""

    queryset = Department.objects.annotate(
        member_count=Count("members", filter=Q(members__is_active=True))
    )
    serializer_class = DepartmentSerializer
    permission_classes = [ReadOnlyOrManagerLevel]
