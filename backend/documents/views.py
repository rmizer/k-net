from django.http import FileResponse, Http404
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from departments.access import is_finance

from .models import Document
from .serializers import DocumentSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    """Directors, Assistants and Site Managers see and manage every document.
    Everyone else uploads documents and receipts (the Paperwork page) and sees
    only their own, and can change or withdraw one until it has been viewed. The
    Finance department also sees everyone's receipts, to reimburse them.

    Filters: ?category=<category>, ?mine=1 (documents you uploaded).
    """

    serializer_class = DocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        documents = Document.objects.select_related("uploaded_by")
        if is_finance(user) and not user.is_manager_level:
            documents = documents.filter(Q(uploaded_by=user) | Q(category=Document.Category.RECEIPT))
        elif not user.is_manager_level:
            documents = documents.filter(uploaded_by=user)
        params = self.request.query_params
        if params.get("category"):
            documents = documents.filter(category=params["category"])
        if params.get("mine") in ("1", "true"):
            documents = documents.filter(uploaded_by=user)
        return documents

    def _check_can_change(self, document):
        if self.request.user.is_manager_level:
            return
        if document.uploaded_by_id != self.request.user.pk:
            raise PermissionDenied("You can only change what you submitted.")
        if document.status != Document.Status.SUBMITTED:
            what = "receipt is already being processed" if document.is_receipt else "has already been seen"
            raise PermissionDenied(f"This {what}, so it can't be changed.")

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def perform_update(self, serializer):
        self._check_can_change(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_can_change(instance)
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        """The file itself. A manager (or Finance, for a receipt) opening someone's
        new submission marks it Viewed."""
        document = self.get_object()
        if (
            (request.user.is_manager_level or (document.is_receipt and is_finance(request.user)))
            and document.status == Document.Status.SUBMITTED
            and document.uploaded_by_id != request.user.pk
        ):
            document.set_status(Document.Status.VIEWED)
            document.save(update_fields=["status", "status_changed_at", "updated_at"])
        try:
            handle = document.file.open("rb")
        except FileNotFoundError:
            raise Http404("The file is missing.")
        download = request.query_params.get("download") == "1"
        return FileResponse(handle, filename=document.file_name, as_attachment=download)
