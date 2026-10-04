from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Department, User

DEMO_PASSWORD = "knet-demo-2026"

DEPARTMENT_CREW = {
    "Tech": ["Robert", "Laura", "Brock", "Adam"],
    "Logistics": ["Jared", "Mike", "Darren", "Josh"],
    "Film Crew": ["Morgan", "Drew", "Sarah", "Owen", "Brian", "Terry"],
}

ROLE_ACCOUNTS = [
    ("manager@knet.test", "Sam", "Manager", User.Role.SITE_MANAGER, None),
    ("director@knet.test", "Dana", "Director", User.Role.DIRECTOR, "Film Crew"),
    ("assistant@knet.test", "Alex", "Assistant", User.Role.ASSISTANT, "Logistics"),
]


class Command(BaseCommand):
    help = "Create demo departments and one account per role for local development."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo only runs with DJANGO_DEBUG on.")

        departments = {
            name: Department.objects.get_or_create(name=name)[0] for name in DEPARTMENT_CREW
        }

        for email, first, last, role, dept in ROLE_ACCOUNTS:
            self._ensure_user(email, first, last, role, departments.get(dept), crew=dept is not None)

        for dept_name, names in DEPARTMENT_CREW.items():
            for first in names:
                email = f"{first.lower()}@knet.test"
                self._ensure_user(email, first, "Crew", User.Role.STAFF, departments[dept_name], crew=True)

        self.stdout.write(self.style.SUCCESS(f"Demo data ready. Password for every account: {DEMO_PASSWORD}"))
        self.stdout.write("Role accounts: manager@knet.test, director@knet.test, assistant@knet.test, robert@knet.test (staff)")

    def _ensure_user(self, email, first, last, role, department, crew):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first,
                "last_name": last,
                "role": role,
                "department": department,
                "is_active_crew": crew,
                "phone": "555-0100",
                "lodging": "Crew Hotel" if crew else "",
                "emergency_contact_name": f"{first}'s emergency contact",
                "emergency_contact_phone": "555-0199",
            },
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()
