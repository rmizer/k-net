from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import IsManagerLevel

from .models import InventoryItem
from .serializers import InventoryItemSerializer


class InventoryItemViewSet(viewsets.ModelViewSet):
    """The company inventory, for Directors, Assistants and Site Managers.

    The list shows items in inventory; ?deleted=1 lists Recently deleted instead.
    DELETE moves an item to Recently deleted; POST .../restore/ brings it back and
    DELETE .../purge/ removes a deleted item for good."""

    serializer_class = InventoryItemSerializer
    permission_classes = [IsManagerLevel]

    def get_queryset(self):
        items = InventoryItem.objects.select_related("department", "receipt", "created_by", "deleted_by")
        if self.action == "list":
            if self.request.query_params.get("deleted") in ("1", "true"):
                return items.deleted().order_by("-deleted_at")
            return items.active()
        if self.action in ("update", "partial_update", "destroy"):
            return items.active()
        return items

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete(self.request.user)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        item = self.get_object()
        if item.deleted_at is None:
            raise ValidationError("That item isn't deleted.")
        item.restore()
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=["delete"])
    def purge(self, request, pk=None):
        item = self.get_object()
        if item.deleted_at is None:
            raise ValidationError("Delete the item first; it can only be removed for good from Recently deleted.")
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
