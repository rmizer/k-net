from django.utils import timezone
from rest_framework import mixins, viewsets

from accounts.permissions import IsManagerLevel

from .models import Challenge, SupplyItem
from .serializers import ChallengeSerializer, SupplyCheckSerializer


class ChallengeViewSet(viewsets.ModelViewSet):
    """Challenges, most recently changed first. ?status=planning|planned|complete
    limits to one column of the Challenge Planner. Directors, Assistants and Site
    Managers only, like the rest of the Director Dashboard."""

    serializer_class = ChallengeSerializer
    permission_classes = [IsManagerLevel]

    def get_queryset(self):
        challenges = Challenge.objects.select_related("created_by", "show", "cleanup_owner").prefetch_related("participants", "supplies")
        if self.request.query_params.get("status"):
            challenges = challenges.filter(status=self.request.query_params["status"])
        return challenges

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SupplyItemViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Check supplies off one at a time, as they come in."""

    serializer_class = SupplyCheckSerializer
    permission_classes = [IsManagerLevel]
    queryset = SupplyItem.objects.all()

    def perform_update(self, serializer):
        item = serializer.save()
        # Counts as a change to the challenge, so it moves up its column.
        Challenge.objects.filter(pk=item.challenge_id).update(updated_at=timezone.now())
