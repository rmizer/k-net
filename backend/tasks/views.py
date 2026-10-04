from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from .models import Task
from .serializers import TaskSerializer

# Fields staff may change on tasks assigned to them.
STAFF_EDITABLE_FIELDS = {"status"}


class TaskViewSet(viewsets.ModelViewSet):
    """Directors, Assistants and Site Managers see and manage every task.
    Staff see only tasks assigned to them and can update their status."""

    serializer_class = TaskSerializer

    def get_queryset(self):
        tasks = Task.objects.select_related("assigned_to", "department")
        if self.request.user.is_manager_level:
            return tasks
        return tasks.filter(assigned_to=self.request.user)

    def _require_manager(self):
        if not self.request.user.is_manager_level:
            raise PermissionDenied("Only Directors and Assistants can manage tasks.")

    def perform_create(self, serializer):
        self._require_manager()
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if not self.request.user.is_manager_level:
            extra = set(self.request.data) - STAFF_EDITABLE_FIELDS
            if extra:
                raise PermissionDenied("You can only update the status of your tasks.")
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager()
        instance.delete()
