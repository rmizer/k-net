from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from notifications import slack

from .models import Task
from .serializers import TaskSerializer

# Fields staff may change on tasks assigned to them.
STAFF_EDITABLE_FIELDS = {"status"}


class TaskViewSet(viewsets.ModelViewSet):
    """Directors, Assistants and Site Managers see and manage every task.
    Staff see only tasks assigned to them and can update their status.

    Filters: ?mine=1 limits to tasks assigned to the signed-in user.
    """

    serializer_class = TaskSerializer

    def get_queryset(self):
        tasks = Task.objects.select_related("assigned_to", "department", "created_by")
        user = self.request.user
        if not user.is_manager_level or self.request.query_params.get("mine") in ("1", "true"):
            tasks = tasks.filter(assigned_to=user)
        return tasks

    def _require_manager(self):
        if not self.request.user.is_manager_level:
            raise PermissionDenied("Only Directors and Assistants can manage tasks.")

    def create(self, request, *args, **kwargs):
        # Check permission before validating, so staff get a 403 rather than form errors.
        self._require_manager()
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        if task.assigned_to != self.request.user:
            slack.notify_task_assigned(task)

    def perform_update(self, serializer):
        if not self.request.user.is_manager_level:
            extra = set(self.request.data) - STAFF_EDITABLE_FIELDS
            if extra:
                raise PermissionDenied("You can only update the status of your tasks.")
        previous_assignee_id = serializer.instance.assigned_to_id
        task = serializer.save()
        # Message the new person when a task is reassigned (not on every edit).
        if task.assigned_to_id != previous_assignee_id and task.assigned_to != self.request.user:
            slack.notify_task_assigned(task)

    def perform_destroy(self, instance):
        self._require_manager()
        instance.delete()
