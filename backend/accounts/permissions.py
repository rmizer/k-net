from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsSiteManager(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_site_manager)


class IsManagerLevel(BasePermission):
    """Directors, Assistants and Site Managers."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_manager_level
        )


class ReadOnlyOrDirectorLevel(BasePermission):
    """Any signed-in user can read; only Directors and Site Managers can write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or request.user.is_director_level


class ReadOnlyOrManagerLevel(BasePermission):
    """Any signed-in user can read; only manager-level users can write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or request.user.is_manager_level
