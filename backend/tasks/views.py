from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from notifications import slack

from .models import Task
from .serializers import TaskSerializer

# Fields staff may change on tasks assigned to them.
STAFF_EDITABLE_FIELDS = {"status"}


def visible_to(user):
    """Tasks assigned to this person, plus tasks given to their whole department
    (a department and no person)."""
    mine = Q(assigned_to=user)
    if user.department_id:
        mine |= Q(assigned_to__isnull=True, department_id=user.department_id)
    return mine


class TaskViewSet(viewsets.ModelViewSet):
    """Directors, Assistants and Site Managers see and manage every task.
    Staff see tasks assigned to them or to their whole department, and can
    update their status.

    Filters: ?mine=1 limits to the signed-in user's tasks (the same set).
    """

    serializer_class = TaskSerializer

    def get_queryset(self):
        tasks = Task.objects.select_related("assigned_to", "department", "created_by")
        user = self.request.user
        if not user.is_manager_level or self.request.query_params.get("mine") in ("1", "true"):
            tasks = tasks.filter(visible_to(user))
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
        slack.notify_department_task(task, exclude=[self.request.user.pk])

    def perform_update(self, serializer):
        if not self.request.user.is_manager_level:
            extra = set(self.request.data) - STAFF_EDITABLE_FIELDS
            if extra:
                raise PermissionDenied("You can only update the status of your tasks.")
        previous = (serializer.instance.assigned_to_id, serializer.instance.department_id)
        task = serializer.save()
        # Message the new person when a task is reassigned (not on every edit).
        if task.assigned_to_id != previous[0] and task.assigned_to != self.request.user:
            slack.notify_task_assigned(task)
        # Likewise the department, when a task newly becomes theirs as a whole.
        if (task.assigned_to_id, task.department_id) != previous:
            slack.notify_department_task(task, exclude=[self.request.user.pk])

    def perform_destroy(self, instance):
        self._require_manager()
        instance.delete()
