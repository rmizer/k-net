"""Who can see and change each department page (the Departments menu).

- Site Managers, Directors and Assistants see and edit every page.
- Department heads see every page but edit only the one for the department they head.
- Everyone else sees only their own department's page.
"""

from accounts.models import Department, User

PAGES = [choice for choice in Department.Page if choice != Department.Page.NONE]


def page_label(page):
    return Department.Page(page).label


def is_page(page):
    return page in Department.Page.values and page != Department.Page.NONE


def page_department_ids(page):
    return list(Department.objects.filter(page=page).values_list("pk", flat=True))


def headed_page(user):
    """The page for the department this person heads, or "" if none."""
    if user.is_department_head and user.head_of_department_id:
        return user.head_of_department.page
    return ""


def head_department_ids(user):
    """Departments a department head can manage: every department on their page
    (Film Crew and Audio together), or just the one they head if it has no page."""
    if not (user.is_department_head and user.head_of_department_id):
        return []
    page = user.head_of_department.page
    return page_department_ids(page) if page else [user.head_of_department_id]


def can_view(user, page):
    if user.is_manager_level or user.is_department_head:
        return True
    return bool(user.department_id) and user.department.page == page


def can_edit(user, page):
    return user.is_manager_level or headed_page(user) == page


def visible_pages(user):
    return [page for page in PAGES if can_view(user, page)]


def heads_of(page):
    return User.objects.filter(is_active=True, is_department_head=True, head_of_department__page=page)
