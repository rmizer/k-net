"""Who can use the Vehicles page.

- Site Managers, Directors and Assistants (the Director Dashboard), and the
  Transportation team (the Transportation page), see, add and update vehicles.
- Only managers and the Transportation head(s) delete one.
- Linked receipts and paperwork open through the vehicle, so the team can see a
  vehicle's receipts without seeing all of Documents. Crew who aren't managers
  can only link documents they uploaded themselves.
"""

from accounts.models import Department
from departments import access

TRANSPORTATION = Department.Page.TRANSPORTATION


def can_use(user):
    if not (user and user.is_authenticated):
        return False
    return (
        user.is_manager_level
        or (bool(user.department_id) and user.department.page == TRANSPORTATION)
        or access.headed_page(user) == TRANSPORTATION
    )


def can_delete(user):
    return bool(user and user.is_authenticated) and access.can_edit(user, TRANSPORTATION)
