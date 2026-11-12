from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse, Http404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from . import alerts
from .access import can_file, can_review
from .models import MAX_ATTACHMENT_MB, IncidentAttachment, IncidentReport
from .serializers import REVIEW_FIELDS, IncidentAttachmentSerializer, IncidentReportSerializer


class SecurityTeamPermission(BasePermission):
    message = "Incident reports are for the Security team, Directors, Assistants and Site Managers."

    def has_permission(self, request, view):
        return can_file(request.user)


def can_change(user, report):
    """Reviewers always; whoever filed it while it is still Open."""
    return can_review(user) or (report.reported_by_id == user.pk and report.status == IncidentReport.Status.OPEN)


class IncidentReportViewSet(viewsets.ModelViewSet):
    """Incident reports, newest incident first. ?status=open|investigating|resolved
    limits to one status. Filing or raising one to High or Critical alerts managers."""

    serializer_class = IncidentReportSerializer
    permission_classes = [SecurityTeamPermission]

    def get_queryset(self):
        reports = IncidentReport.objects.select_related("reported_by").prefetch_related("attachments__uploaded_by")
        if self.request.query_params.get("status"):
            reports = reports.filter(status=self.request.query_params["status"])
        return reports

    def can_change(self, report):
        return can_change(self.request.user, report)

    def perform_create(self, serializer):
        if REVIEW_FIELDS & set(self.request.data) and not can_review(self.request.user):
            raise PermissionDenied("Only the Security head and managers set the status and resolution.")
        alerts.send(serializer.save(reported_by=self.request.user))

    def perform_update(self, serializer):
        report = serializer.instance
        if not self.can_change(report):
            raise PermissionDenied("Only the Security head and managers can change this report now.")
        changed = {
            field for field in REVIEW_FIELDS & set(self.request.data) if self.request.data[field] != getattr(report, field)
        }
        if changed and not can_review(self.request.user):
            raise PermissionDenied("Only the Security head and managers set the status and resolution.")
        alerts.send(serializer.save())

    def perform_destroy(self, instance):
        if not can_review(self.request.user):
            raise PermissionDenied("Only the Security head and managers can delete a report.")
        for attachment in instance.attachments.all():
            attachment.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def attachments(self, request, pk=None):
        """Adds a photo, video or PDF ({"file": ..., "caption": ...})."""
        report = self.get_object()
        if not self.can_change(report):
            raise PermissionDenied("Only the Security head and managers can add to this report now.")
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a photo, video or PDF."})
        if upload.size > MAX_ATTACHMENT_MB * 1024 * 1024:
            raise ValidationError({"file": f"Files can be up to {MAX_ATTACHMENT_MB} MB. Trim the video and try again."})
        attachment = IncidentAttachment(
            report=report, file=upload, caption=request.data.get("caption", "")[:200], uploaded_by=request.user
        )
        try:
            attachment.full_clean(exclude=["uploaded_by"])
        except DjangoValidationError as error:
            raise ValidationError(
                {"file": "Photos, videos (MP4, MOV, WebM) and PDFs only."}
                if "file" in error.message_dict
                else error.message_dict
            )
        attachment.save()
        report.save(update_fields=["updated_at"])
        return Response(IncidentAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class IncidentAttachmentViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Attachments are added through their report. Here they are opened and removed."""

    permission_classes = [SecurityTeamPermission]
    queryset = IncidentAttachment.objects.select_related("report")

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        attachment = self.get_object()
        try:
            handle = attachment.file.open("rb")
        except FileNotFoundError:
            raise Http404("The file is missing.")
        download = request.query_params.get("download") == "1"
        return FileResponse(handle, filename=attachment.file_name, as_attachment=download)

    def perform_destroy(self, instance):
        if not can_change(self.request.user, instance.report):
            raise PermissionDenied("Only the Security head and managers can remove this now.")
        instance.file.delete(save=False)
        instance.delete()
