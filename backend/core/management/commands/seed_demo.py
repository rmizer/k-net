from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import Department, User
from announcements.models import Alert, Announcement
from core.models import ProductionSettings
from schedule.models import Event
from tasks.models import Task

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

DEMO_LOCATION = {
    "location_name": "Los Angeles, California, United States",
    "latitude": 34.05223,
    "longitude": -118.24368,
    "time_zone": "America/Los_Angeles",
}


class Command(BaseCommand):
    help = "Create demo accounts, departments and dashboard content for local development."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo only runs with DJANGO_DEBUG on.")

        departments = {name: Department.objects.get_or_create(name=name)[0] for name in DEPARTMENT_CREW}

        for email, first, last, role, dept in ROLE_ACCOUNTS:
            self._ensure_user(email, first, last, role, departments.get(dept), crew=dept is not None)

        for dept_name, names in DEPARTMENT_CREW.items():
            for first in names:
                email = f"{first.lower()}@knet.test"
                self._ensure_user(email, first, "Crew", User.Role.STAFF, departments[dept_name], crew=True)

        production = self._ensure_production()
        # Dates below are relative to "today" where the production is.
        timezone.activate(production.zone)
        users = {user.email.split("@")[0]: user for user in User.objects.all()}
        self._seed_announcements(users)
        self._seed_tasks(users, departments)
        self._seed_events(users, departments)

        self.stdout.write(self.style.SUCCESS(f"Demo data ready. Password for every account: {DEMO_PASSWORD}"))
        self.stdout.write(
            "Role accounts: manager@knet.test, director@knet.test, assistant@knet.test, robert@knet.test (staff)"
        )

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

    def _ensure_production(self):
        production = ProductionSettings.load()
        if not production.has_location:
            production.name = "K-Net Demo Production"
            for field, value in DEMO_LOCATION.items():
                setattr(production, field, value)
            production.save()
        return production

    def _seed_announcements(self, users):
        if Announcement.objects.exists() or Alert.objects.exists():
            return
        director = users["director"]
        Announcement.objects.create(
            title="Welcome to K-Net",
            body="All schedules, tasks and crew info now live here. Check the dashboard each morning.",
            pinned=True,
            created_by=director,
        )
        Announcement.objects.create(
            title="Wrap party Friday",
            body="Rooftop at the crew hotel, 8pm. Plus-ones welcome.",
            created_by=users["assistant"],
        )
        Announcement.objects.create(
            title="Updated parking instructions",
            body="Crew parking has moved to Lot C. Shuttles run every 15 minutes from 5am.",
            created_by=director,
        )
        Alert.objects.create(message="High winds expected after 3pm; secure all rigging.", level=Alert.Level.URGENT)
        Alert.objects.create(message="Lot C gate code changed. Ask Logistics.", level=Alert.Level.WARNING)
        Alert.objects.create(message="Catering truck arrives 30 minutes late today.", level=Alert.Level.INFO)

    def _seed_tasks(self, users, departments):
        if Task.objects.exists():
            return
        today = timezone.localdate()
        director = users["director"]
        rows = [
            ("Charge camera batteries", "robert", "Tech", 0, Task.Priority.HIGH, Task.Status.TODO),
            ("Label cable runs for Stage B", "robert", "Tech", 2, Task.Priority.NORMAL, Task.Status.IN_PROGRESS),
            ("Return rental monitors", "robert", "Tech", -1, Task.Priority.NORMAL, Task.Status.TODO),
            ("Confirm shuttle schedule", "jared", "Logistics", 1, Task.Priority.HIGH, Task.Status.TODO),
            ("Restock water at base camp", "mike", "Logistics", 0, Task.Priority.LOW, Task.Status.DONE),
            ("Prep dolly track for Scene 12", "morgan", "Film Crew", 0, Task.Priority.HIGH, Task.Status.IN_PROGRESS),
            ("Review influencer release forms", "assistant", "Logistics", 1, Task.Priority.NORMAL, Task.Status.TODO),
            ("Approve weekend call sheet", "director", "Film Crew", 2, Task.Priority.HIGH, Task.Status.TODO),
            ("Inventory grip truck", None, "Film Crew", 3, Task.Priority.NORMAL, Task.Status.TODO),
        ]
        for title, assignee, dept, due_in, priority, status in rows:
            Task.objects.create(
                title=title,
                assigned_to=users.get(assignee) if assignee else None,
                department=departments[dept],
                due_date=today + timedelta(days=due_in),
                priority=priority,
                status=status,
                created_by=director,
            )

    def _seed_events(self, users, departments):
        if Event.objects.exists():
            return
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())

        def at(day, hour, minute=0):
            return timezone.make_aware(datetime.combine(day, time(hour, minute)))

        def add(title, day, start, end, event_type=Event.EventType.PRODUCTION, dept=None, location="", attendees=()):
            event = Event.objects.create(
                title=title,
                event_type=event_type,
                start=at(day, *start),
                end=at(day, *end),
                location=location,
                department=departments.get(dept) if dept else None,
                created_by=users["director"],
            )
            event.attendees.set([users[name] for name in attendees])

        for offset in range(5):  # Weekday crew calls
            day = week_start + timedelta(days=offset)
            add("Crew call", day, (6, 0), (6, 30), location="Base camp")

        add("Scene 12: Exterior market", today, (8, 0), (13, 0), dept="Film Crew", location="Grand Central Market")
        add("Lunch", today, (13, 0), (14, 0), location="Base camp")
        add(
            "Influencer meet & greet: Jade Rivers",
            today,
            (15, 0),
            (16, 0),
            event_type=Event.EventType.INFLUENCER,
            location="Hospitality tent",
            attendees=["assistant"],
        )
        add("Equipment load-out", today, (18, 0), (20, 0), dept="Tech", location="Stage B")

        add(
            "Production meeting",
            week_start + timedelta(days=1),
            (16, 0),
            (17, 0),
            event_type=Event.EventType.STAFF,
            attendees=["director", "assistant"],
        )
        add("Tech rehearsal", week_start + timedelta(days=2), (9, 0), (12, 0), dept="Tech", location="Stage B")
        add(
            "Content shoot: Marco Lane",
            week_start + timedelta(days=3),
            (10, 0),
            (12, 0),
            event_type=Event.EventType.INFLUENCER,
            location="Rooftop set",
            attendees=["assistant", "morgan"],
        )
        add("Shuttle run to LAX", week_start + timedelta(days=4), (7, 0), (9, 0), dept="Logistics")
        add("Location scout: Malibu", week_start + timedelta(days=5), (9, 0), (14, 0), dept="Film Crew")
