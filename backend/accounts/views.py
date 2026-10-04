from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Department, User
from .permissions import ReadOnlyOrManagerLevel
from .serializers import (
    DepartmentSerializer,
    LoginSerializer,
    ProfilePictureSerializer,
    ProfileSerializer,
    UserSerializer,
)


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
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"detail": "Invalid email or password."}, status=status.HTTP_400_BAD_REQUEST
            )
        login(request, user)
        return Response(ProfileSerializer(user, context={"request": request}).data)


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
        serializer.save()
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

    @action(detail=False, permission_classes=[IsAuthenticated])
    def crew(self, request):
        """Active crew only, for the Staff / Crew page."""
        users = self.get_queryset().filter(is_active_crew=True)
        return Response(self.get_serializer(users, many=True).data)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [ReadOnlyOrManagerLevel]
