from django.db.models import Count, Min, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from accounts.permissions import ReadOnlyOrManagerLevel

from .models import Influencer, InfluencerNote, TravelArrangement
from .serializers import (
    InfluencerNoteSerializer,
    InfluencerPhotoSerializer,
    InfluencerRowSerializer,
    InfluencerSerializer,
    TravelArrangementSerializer,
)


class InfluencerViewSet(viewsets.ModelViewSet):
    """The Influencer Roster. Everyone can view; only Directors, Assistants and
    Site Managers add, edit or remove influencers."""

    queryset = Influencer.objects.all()
    permission_classes = [ReadOnlyOrManagerLevel]

    def get_queryset(self):
        influencers = Influencer.objects.all()
        if self.action == "retrieve":
            influencers = influencers.prefetch_related("notes__author", "travel")
        elif self.action == "list":
            now = timezone.now()
            influencers = influencers.annotate(
                travel_count=Count("travel", distinct=True),
                next_travel_at=Min("travel__starts_at", filter=Q(travel__starts_at__gte=now)),
                next_event_at=Min("events__start", filter=Q(events__end__gte=now)),
            )
        return influencers

    def get_serializer_class(self):
        return InfluencerRowSerializer if self.action == "list" else InfluencerSerializer

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def photo(self, request, pk=None):
        influencer = self.get_object()
        serializer = InfluencerPhotoSerializer(influencer, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(InfluencerSerializer(influencer, context=self.get_serializer_context()).data)


class InfluencerNoteViewSet(viewsets.ModelViewSet):
    """Notes on influencers, written by Directors and Assistants."""

    queryset = InfluencerNote.objects.select_related("author")
    serializer_class = InfluencerNoteSerializer
    permission_classes = [ReadOnlyOrManagerLevel]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class TravelArrangementViewSet(viewsets.ModelViewSet):
    queryset = TravelArrangement.objects.all()
    serializer_class = TravelArrangementSerializer
    permission_classes = [ReadOnlyOrManagerLevel]
