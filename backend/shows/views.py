from django.db.models import Count
from rest_framework import viewsets

from accounts.permissions import ReadOnlyOrDirectorLevel

from .models import Show
from .serializers import ShowSerializer


class ShowViewSet(viewsets.ModelViewSet):
    """Everyone can see the shows (influencers are listed by show); Directors
    and Site Managers create and edit them. Assistants can't."""

    queryset = (
        Show.objects.select_related("director")
        .prefetch_related("other_directors", "department_heads__head_of_department")
        .annotate(influencer_count=Count("influencers"))
    )
    serializer_class = ShowSerializer
    permission_classes = [ReadOnlyOrDirectorLevel]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
