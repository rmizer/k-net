from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "K-Net Site Manager"
admin.site.site_title = "K-Net Admin"
admin.site.index_title = "System administration"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("core.urls")),
    path("api/", include("announcements.urls")),
    path("api/", include("tasks.urls")),
    path("api/", include("schedule.urls")),
    path("api/", include("crewfinder.urls")),
    path("api/", include("resources.urls")),
    path("api/", include("influencers.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
