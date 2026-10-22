from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, JsonResponse
from django.urls import include, path, re_path
from django.views.decorators.cache import never_cache
from django.views.static import serve

admin.site.site_header = "K-Net Site Manager"
admin.site.site_title = "K-Net Admin"
admin.site.index_title = "System administration"


def health(request):
    """For the host's health check: the app is up."""
    return JsonResponse({"ok": True})


@never_cache
def frontend(request, path=""):
    """The React app's index.html for every page route; React Router takes it
    from there. Only in production, where frontend/dist has been built."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise Http404("The frontend hasn't been built.")
    return FileResponse(index.open("rb"), content_type="text/html")


urlpatterns = [
    path("api/health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("core.urls")),
    path("api/", include("announcements.urls")),
    path("api/", include("tasks.urls")),
    path("api/", include("schedule.urls")),
    path("api/", include("crewfinder.urls")),
    path("api/", include("resources.urls")),
    path("api/", include("influencers.urls")),
    path("api/", include("shows.urls")),
    path("api/", include("meetings.urls")),
    path("api/", include("departments.urls")),
    path("api/culinary/", include("culinary.urls")),
    path("api/", include("documents.urls")),
    path("api/", include("locations.urls")),
    path("api/", include("support.urls")),
    path("api/finance/", include("finance.urls")),
    # Profile pictures and influencer photos. (Documents are private and only
    # ever go out through the API.) Django serves these itself; fine at this scale.
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    # Everything else is a page in the React app. Unknown /api/ and /admin/
    # addresses stay 404s instead of returning the app.
    re_path(r"^(?!api/|admin/|static/|media/).*$", frontend, name="frontend"),
]
