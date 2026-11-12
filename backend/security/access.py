"""Who can file and review incident reports.

- The Security team (anyone in a Security department) and Site Managers,
  Directors and Assistants file reports and read them all.
- The Security head(s) and managers review them: set the status, write the
  resolution, and edit or delete any report.
- Whoever filed a report can fix its details while it is still Open.
- Other departments' heads can see the Security page, but not the reports.
"""

from accounts.models import Department
from departments import access

SECURITY = Department.Page.SECURITY


def on_security_team(user):
    return bool(user.department_id) and user.department.page == SECURITY


def can_file(user):
    return bool(user and user.is_authenticated) and (
        user.is_manager_level or on_security_team(user) or access.headed_page(user) == SECURITY
    )


def can_review(user):
    return bool(user and user.is_authenticated) and access.can_edit(user, SECURITY)
