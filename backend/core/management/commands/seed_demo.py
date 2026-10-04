from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import Department, User
from announcements.models import Alert, Announcement
from core.models import ProductionSettings
from crewfinder.models import Tracker, TrackerPing
from influencers.models import Influencer
from schedule.models import Event
from tasks.models import Task

DEMO_PASSWORD = "knet-demo-2026"

# Demo people. Emails are the name in lowercase without spaces, e.g. coachk@knet.test.
# (name, role, department, on the active crew)
DEMO_PEOPLE = [
    # Upper level
    ("Coach K", User.Role.DIRECTOR, None, False),
    ("Babes", User.Role.DIRECTOR, None, False),
    ("Rachel", User.Role.SITE_MANAGER, None, False),
    # Assistants
    ("Jared", User.Role.ASSISTANT, "Logistics", True),
    # Staff
    ("Jimmy", User.Role.STAFF, "Tech", True),
    ("Brandon", User.Role.STAFF, "Tech", True),
    ("Kelly", User.Role.STAFF, "Tech", True),
    ("Chris", User.Role.STAFF, "Logistics", True),
    ("Adam", User.Role.STAFF, "Logistics", True),
    ("EJ", User.Role.STAFF, "Film Crew", True),
    ("Joseph", User.Role.STAFF, "Film Crew", True),
    ("Kirk", User.Role.STAFF, "Film Crew", True),
    ("Justin", User.Role.STAFF, "Logistics", True),
]

# Last names, where known.
LAST_NAMES = {"Rachel": "Mizer", "Justin": "Smith"}

DEPARTMENTS = ["Tech", "Logistics", "Film Crew"]

# Everyone stays at the crew hotel. Known room numbers, by first name.
CREW_HOTEL = "Hilton Tampa Airport Westshore"
ROOMS = {"Jared": "410"}


def demo_email(name):
    return f"{name.lower().replace(' ', '')}@knet.test"

DEMO_LOCATION = {
    "location_name": "Tampa, Florida, United States",
    "latitude": 27.94752,
    "longitude": -82.45843,
    "time_zone": "America/New_York",
}


class Command(BaseCommand):
    help = "Create demo accounts, departments and dashboard content for local development."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help=(
                "First delete every @knet.test account and all announcements, alerts, tasks, events and "
                "trackers. Production settings, departments and other accounts are kept."
            ),
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo only runs with DJANGO_DEBUG on.")

        if options["reset"]:
            self._reset()

        departments = {name: Department.objects.get_or_create(name=name)[0] for name in DEPARTMENTS}

        for name, role, dept, crew in DEMO_PEOPLE:
            last = LAST_NAMES.get(name, "")
            self._ensure_user(demo_email(name), name, last, role, departments.get(dept), crew=crew)

        production = self._ensure_production()
        # Dates below are relative to "today" where the production is.
        timezone.activate(production.zone)
        users = {user.email.split("@")[0]: user for user in User.objects.filter(email__endswith="@knet.test")}
        self._seed_announcements(users)
        self._seed_tasks(users, departments)
        self._seed_events(users, departments)
        self._seed_next_week(users, departments)
        self._seed_trackers(users, production)

        self.stdout.write(self.style.SUCCESS(f"Demo data ready. Password for every account: {DEMO_PASSWORD}"))
        self.stdout.write(
            "Accounts: coachk@ and babes@ (Directors), rachel@ (Site Manager), jared@ (Assistant), "
            "jimmy@ (Staff) ... all @knet.test"
        )

    def _reset(self):
        for model in (Tracker, Event, Task, Alert, Announcement):
            model.objects.all().delete()
        deleted, _ = User.objects.filter(email__endswith="@knet.test").delete()
        self.stdout.write(f"Reset demo data ({deleted} demo records removed).")

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
                "lodging": f"{CREW_HOTEL}, Room {ROOMS[first]}" if first in ROOMS else CREW_HOTEL,
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
        director = users["coachk"]
        Announcement.objects.create(
            title="Welcome to K-Net",
            body="All schedules, tasks and crew info now live here. Check the dashboard each morning.",
            pinned=True,
            created_by=director,
        )
        Announcement.objects.create(
            title="Wrap party Friday",
            body="Rooftop at the crew hotel, 8pm. Plus-ones welcome.",
            created_by=users["jared"],
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
        director = users["coachk"]
        rows = [
            ("Charge camera batteries", "jimmy", "Tech", 0, Task.Priority.HIGH, Task.Status.TODO),
            ("Label cable runs for Stage B", "jimmy", "Tech", 2, Task.Priority.NORMAL, Task.Status.IN_PROGRESS),
            ("Return rental monitors", "kelly", "Tech", -1, Task.Priority.NORMAL, Task.Status.TODO),
            ("Confirm shuttle schedule", "chris", "Logistics", 1, Task.Priority.HIGH, Task.Status.TODO),
            ("Restock water at base camp", "adam", "Logistics", 0, Task.Priority.LOW, Task.Status.DONE),
            ("Prep dolly track for Scene 12", "ej", "Film Crew", 0, Task.Priority.HIGH, Task.Status.IN_PROGRESS),
            ("Review influencer release forms", "jared", "Logistics", 1, Task.Priority.NORMAL, Task.Status.TODO),
            ("Approve weekend call sheet", "coachk", "Film Crew", 2, Task.Priority.HIGH, Task.Status.TODO),
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

    def _seed_trackers(self, users, production):
        """Trackers for a few crew members, with recent locations near the production."""
        if Tracker.objects.exists() or not production.has_location:
            return
        now = timezone.now()
        rows = [
            # person, type, label, (lat offset, lng offset), minutes ago, note
            ("jimmy", Tracker.TrackerType.AIRTAG, "Badge AirTag", (0.0012, -0.0008), 4, "Stage B"),
            ("brandon", Tracker.TrackerType.AIRTAG, "Badge AirTag", (0.0015, -0.0002), 11, "Stage B"),
            ("chris", Tracker.TrackerType.GPS, "Shuttle van GPS", (-0.0150, 0.0210), 2, "En route to base camp"),
            ("ej", Tracker.TrackerType.TILE, "Camera bag Tile", (-0.0021, 0.0034), 7, "Exterior set"),
            ("joseph", Tracker.TrackerType.PHONE, "Phone", (0.0040, 0.0061), 185, "Crew hotel"),
            ("kirk", Tracker.TrackerType.AIRTAG, "Badge AirTag", None, None, ""),  # No location yet
        ]
        for name, tracker_type, label, offset, minutes_ago, note in rows:
            tracker = Tracker(person=users[name], tracker_type=tracker_type, label=label, created_by=users["rachel"])
            tracker.issue_token()  # Demo keys are never shown; Site Managers can issue new ones.
            tracker.save()
            if offset is None:
                continue
            TrackerPing.objects.create(
                tracker=tracker,
                latitude=round(production.latitude + Decimal(str(offset[0])), 6),
                longitude=round(production.longitude + Decimal(str(offset[1])), 6),
                accuracy_m=15,
                note=note,
                recorded_at=now - timedelta(minutes=minutes_ago),
            )

    @staticmethod
    def _at(day, hour, minute=0):
        return timezone.make_aware(datetime.combine(day, time(hour, minute)))

    def _event_adder(self, users, departments):
        def add(
            title,
            day,
            start,
            end,
            event_type=Event.EventType.PRODUCTION,
            dept=None,
            location="",
            attendees=(),
            influencers=(),
            all_day=False,
        ):
            event = Event.objects.create(
                title=title,
                event_type=event_type,
                start=self._at(day, *start),
                end=self._at(day + timedelta(days=1), 0) if all_day else self._at(day, *end),
                all_day=all_day,
                location=location,
                department=departments.get(dept) if dept else None,
                created_by=users["coachk"],
            )
            event.attendees.set([users[name] for name in attendees if name in users])
            event.influencers.set(Influencer.objects.filter(name__in=influencers))

        return add

    def _seed_events(self, users, departments):
        if Event.objects.exists():
            return
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        add = self._event_adder(users, departments)

        for offset in range(5):  # Weekday crew calls
            day = week_start + timedelta(days=offset)
            add("Crew call", day, (6, 0), (6, 30), location="Base camp")

        add("Scene 12: Exterior market", today, (8, 0), (13, 0), dept="Film Crew", location="Armature Works")
        add("Lunch", today, (13, 0), (14, 0), location="Base camp")
        add(
            "Influencer meet & greet: Jade Rivers",
            today,
            (15, 0),
            (16, 0),
            event_type=Event.EventType.INFLUENCER,
            location="Hospitality tent",
            attendees=["jared"],
        )
        add("Equipment load-out", today, (18, 0), (20, 0), dept="Tech", location="Stage B")

        add(
            "Production meeting",
            week_start + timedelta(days=1),
            (16, 0),
            (17, 0),
            event_type=Event.EventType.STAFF,
            attendees=["coachk", "babes", "jared"],
        )
        add("Tech rehearsal", week_start + timedelta(days=2), (9, 0), (12, 0), dept="Tech", location="Stage B")
        add(
            "Content shoot: Marco Lane",
            week_start + timedelta(days=3),
            (10, 0),
            (12, 0),
            event_type=Event.EventType.INFLUENCER,
            location="Rooftop set",
            attendees=["jared", "ej"],
        )
        add("Shuttle run to TPA", week_start + timedelta(days=4), (7, 0), (9, 0), dept="Logistics", location="TPA")
        add(
            "Location scout: Clearwater Beach",
            week_start + timedelta(days=5),
            (9, 0),
            (14, 0),
            dept="Film Crew",
            location="Clearwater Beach",
        )

    def _seed_next_week(self, users, departments):
        """Next Monday through Sunday, in Tampa. Skipped if that week already has events."""
        today = timezone.localdate()
        monday = today - timedelta(days=today.weekday()) + timedelta(days=7)
        if Event.objects.overlapping(self._at(monday, 0), self._at(monday + timedelta(days=7), 0)).exists():
            return
        add = self._event_adder(users, departments)
        day = [monday + timedelta(days=offset) for offset in range(7)]
        hotel = "Hilton Tampa Airport Westshore"
        influencer = Event.EventType.INFLUENCER
        staff = Event.EventType.STAFF

        for weekday in day[:6]:  # Crew call Monday to Saturday
            add("Crew call", weekday, (6, 0), (6, 30), location="Base camp")

        # Monday
        add("Production meeting", day[0], (7, 0), (8, 0), event_type=staff, attendees=["coachk", "babes", "jared"])
        add("Scene 14: Riverwalk", day[0], (8, 30), (13, 0), dept="Film Crew", location="Tampa Riverwalk")
        add("Lunch", day[0], (13, 0), (14, 0), location="Base camp")
        add("Lighting prep", day[0], (14, 0), (18, 0), dept="Tech", location="Stage B")

        # Tuesday
        add("Airport pickups: influencer arrivals", day[1], (9, 0), (17, 0), dept="Logistics", location="TPA arrivals")
        add(
            "Content shoot: Nilla",
            day[1],
            (11, 0),
            (13, 0),
            event_type=influencer,
            location="Rooftop set",
            attendees=["jared", "ej"],
            influencers=["Nilla"],
        )
        add("Scene 15: Interior lounge", day[1], (13, 30), (18, 30), dept="Film Crew", location="Stage A")

        # Wednesday
        add("Tech rehearsal", day[2], (9, 0), (12, 0), dept="Tech", location="Stage B")
        add(
            "Wardrobe fittings",
            day[2],
            (12, 30),
            (15, 30),
            event_type=influencer,
            location="Wardrobe trailer",
            attendees=["jared"],
            influencers=["Madi Jo", "Gordo Loco", "Big tim"],
        )
        add(
            "Influencer welcome dinner",
            day[2],
            (18, 30),
            (21, 0),
            event_type=influencer,
            location=f"{hotel}, ballroom",
            attendees=["coachk", "babes", "jared"],
            influencers=["Nilla", "Madi Jo", "Gordo Loco", "Big tim"],
        )

        # Thursday
        add("Shuttle run to TPA", day[3], (7, 0), (9, 0), dept="Logistics", location="TPA departures")
        add("Live show rehearsal", day[3], (10, 0), (14, 0), dept="Tech", location="Stage A")
        add(
            "Content shoot: Big tim",
            day[3],
            (15, 0),
            (17, 0),
            event_type=influencer,
            location="Ybor City, 7th Ave",
            attendees=["ej", "joseph"],
            influencers=["Big tim"],
        )

        # Friday
        add("Load-in", day[4], (9, 0), (13, 0), dept="Tech", location="Stage A")
        add("Lunch", day[4], (13, 0), (14, 0), location="Base camp")
        add(
            "Live show: Episode 1",
            day[4],
            (17, 0),
            (19, 30),
            location="Stage A",
            influencers=["Nilla", "Madi Jo", "Gordo Loco", "Big tim"],
        )
        add("Wrap party", day[4], (20, 0), (23, 0), event_type=staff, location=f"{hotel}, rooftop")

        # Saturday
        add("Location scout: Ybor City", day[5], (9, 0), (13, 0), dept="Film Crew", location="Ybor City")
        add(
            "Influencer Q&A: Madi Jo & Gordo Loco",
            day[5],
            (14, 0),
            (15, 30),
            event_type=influencer,
            location="Hospitality tent",
            attendees=["jared"],
            influencers=["Madi Jo", "Gordo Loco"],
        )
        add("Equipment maintenance", day[5], (15, 0), (18, 0), dept="Tech", location="Stage B")

        # Sunday
        add("Crew day off", day[6], (0, 0), (0, 0), event_type=staff, all_day=True)
        add("Airport drop-offs", day[6], (8, 0), (12, 0), dept="Logistics", location="TPA departures")
