from django.http import FileResponse, Http404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from .access import can_delete, can_use
from .models import Vehicle
from .serializers import VehicleSerializer


class VehiclePermission(BasePermission):
    message = "Vehicles are for the Transportation team, Directors, Assistants and Site Managers."

    def has_permission(self, request, view):
        return can_use(request.user)


class VehicleViewSet(viewsets.ModelViewSet):
    """The production's vehicles. ?status=active|out_of_service|returned limits to one status."""

    serializer_class = VehicleSerializer
    permission_classes = [VehiclePermission]

    def get_queryset(self):
        vehicles = Vehicle.objects.select_related("driver", "created_by").prefetch_related("documents__uploaded_by")
        if self.request.query_params.get("status"):
            vehicles = vehicles.filter(status=self.request.query_params["status"])
        return vehicles

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if not can_delete(self.request.user):
            raise PermissionDenied("Only the Transportation head and managers can delete a vehicle.")
        instance.delete()

    @action(detail=True, methods=["get"], url_path=r"documents/(?P<document_id>\d+)/file")
    def document_file(self, request, pk=None, document_id=None):
        """A receipt or document linked to this vehicle, for anyone who can see the vehicle."""
        document = self.get_object().documents.filter(pk=document_id).first()
        if document is None:
            raise Http404("That document isn't linked to this vehicle.")
        try:
            handle = document.file.open("rb")
        except FileNotFoundError:
            raise Http404("The file is missing.")
        download = request.query_params.get("download") == "1"
        return FileResponse(handle, filename=document.file_name, as_attachment=download)
