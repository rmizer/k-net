from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from accounts.models import Department, User
from tasks.models import Task
from tasks.serializers import TaskSerializer

from . import access
from .serializers import PagePersonSerializer

# Finished tasks stay on a department page for a week.
DONE_SHOWN_FOR = timedelta(days=7)


def _recent(tasks):
    return tasks.filter(
        ~Q(status=Task.Status.DONE) | Q(completed_at__gte=timezone.now() - DONE_SHOWN_FOR)
    ).select_related("assigned_to", "department", "created_by")


@api_view(["GET"])
def page_list(request):
    """The department pages this person can open, for the Departments menu."""
    user = request.user
    return Response(
        [
            {"slug": page.value, "label": page.label, "can_edit": access.can_edit(user, page)}
            for page in access.visible_pages(user)
        ]
    )


@api_view(["GET"])
def page_detail(request, slug):
    """One department page: its heads, crew and tasks.

    Department heads' own tasks are private to each head (and to Site Managers,
    Directors and Assistants); the rest of the department sees everyone else's."""
    user = request.user
    if not access.is_page(slug):
        raise NotFound("No such department page.")
    if not access.can_view(user, slug):
        raise PermissionDenied("This page is for another department.")

    departments = Department.objects.filter(page=slug)
    department_ids = [department.pk for department in departments]
    heads = list(access.heads_of(slug).select_related("department").order_by("first_name", "last_name"))
    head_ids = {head.pk for head in heads}
    crew = (
        User.objects.filter(Q(department_id__in=department_ids) | Q(pk__in=head_ids), is_active=True)
        .select_related("department")
        .order_by("first_name", "last_name")
    )
    staff_ids = [person.pk for person in crew if person.pk not in head_ids]

    is_head = user.pk in head_ids
    if user.is_manager_level:
        head_tasks = _recent(Task.objects.filter(assigned_to_id__in=head_ids))
    elif is_head:
        head_tasks = _recent(Task.objects.filter(assigned_to=user))
    else:
        head_tasks = None
    staff_tasks = _recent(
        Task.objects.filter(
            Q(assigned_to_id__in=staff_ids) | Q(assigned_to__isnull=True, department_id__in=department_ids)
        )
    )

    context = {"request": request, "head_ids": head_ids}
    return Response(
        {
            "slug": slug,
            "label": access.page_label(slug),
            "can_edit": access.can_edit(user, slug),
            "is_head": is_head,
            "departments": [{"id": department.pk, "name": department.name} for department in departments],
            "heads": PagePersonSerializer(heads, many=True, context=context).data,
            "crew": PagePersonSerializer(crew, many=True, context=context).data,
            "head_tasks": None if head_tasks is None else TaskSerializer(head_tasks, many=True).data,
            "staff_tasks": TaskSerializer(staff_tasks, many=True).data,
        }
    )
