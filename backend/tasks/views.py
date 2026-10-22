from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from departments.access import head_department_ids
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


def _head_may_manage(user, departments, task):
    """Whether a department head can edit or delete this task: it belongs to their
    department and is for one of its people (or the whole department). Tasks
    someone else gave the head themselves they can only update the status of."""
    if task.department_id not in departments:
        return False
    if task.assigned_to_id is None:
        return True
    if task.assigned_to_id == user.pk:
        return task.created_by_id == user.pk
    return task.assigned_to.department_id in departments


class TaskViewSet(viewsets.ModelViewSet):
    """Directors, Assistants and Site Managers see and manage every task.
    Department heads also create, assign, edit and delete their own
    department's tasks. Staff see tasks assigned to them or to their whole
    department, and can update their status.

    Filters: ?mine=1 limits to the signed-in user's tasks (the same set).
    """

    serializer_class = TaskSerializer

    def get_queryset(self):
        tasks = Task.objects.select_related("assigned_to", "department", "created_by")
        user = self.request.user
        if self.request.query_params.get("mine") in ("1", "true"):
            return tasks.filter(visible_to(user))
        if user.is_manager_level:
            return tasks
        departments = head_department_ids(user)
        if departments:
            return tasks.filter(
                visible_to(user) | Q(department_id__in=departments) | Q(assigned_to__department_id__in=departments)
            ).distinct()
        return tasks.filter(visible_to(user))

    def _require_manager(self):
        if not self.request.user.is_manager_level:
            raise PermissionDenied("Only Directors and Assistants can manage tasks.")

    def _head_fields(self, data, current=None):
        """For a department head: the task's department and person must be theirs.
        Fills in the department from the person when it's left out."""
        user = self.request.user
        departments = head_department_ids(user)
        person = data.get("assigned_to", current.assigned_to if current else None)
        department = data.get("department", current.department if current else None)
        if person is not None and person.pk != user.pk and person.department_id not in departments:
            raise PermissionDenied("You can only give tasks to people in your department.")
        if department is None:
            if person is not None and person.department_id in departments:
                data["department"] = person.department
            else:
                data["department"] = user.head_of_department
        elif department.pk not in departments:
            raise PermissionDenied("You can only add tasks for your own department.")

    def create(self, request, *args, **kwargs):
        # Check permission before validating, so staff get a 403 rather than form errors.
        if not (request.user.is_manager_level or head_department_ids(request.user)):
            raise PermissionDenied("Only Directors, Assistants and department heads can add tasks.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        if not self.request.user.is_manager_level:
            self._head_fields(serializer.validated_data)
        task = serializer.save(created_by=self.request.user)
        if task.assigned_to != self.request.user:
            slack.notify_task_assigned(task)
        slack.notify_department_task(task, exclude=[self.request.user.pk])

    def perform_update(self, serializer):
        user = self.request.user
        if not user.is_manager_level:
            extra = set(self.request.data) - STAFF_EDITABLE_FIELDS
            departments = head_department_ids(user)
            if departments and _head_may_manage(user, departments, serializer.instance):
                if extra:
                    self._head_fields(serializer.validated_data, serializer.instance)
            elif extra:
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
        user = self.request.user
        if not (user.is_manager_level or _head_may_manage(user, head_department_ids(user), instance)):
            raise PermissionDenied("Only Directors, Assistants and the department's head can delete tasks.")
        instance.delete()
