import uuid
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from accounts.models import Department, User
from core.models import ProductionSettings
from locations.models import Location
from schedule.models import Event, TimelineItem

# From the Battle House Live season 1 call sheet (dev/img/Battle House Assets/call_sheet_example.jpg).
FIRST_DAY = date(2026, 10, 9)  # Shoot day 1
LAST_DAY = date(2026, 10, 23)
TIMELINE_NAME = "Battle House Live: Season 1 shoot"

# Department names to fix before anyone is placed: old name -> new name.
RENAME_DEPARTMENTS = {"Catering": "Culinary", "Logistics": "Transportation"}
# Each department and its page in the Departments menu (Film Crew and Audio share one).
DEPARTMENTS = {
    "Production": Department.Page.PRODUCTION,
    "Operations": Department.Page.OPERATIONS,
    "Tech": Department.Page.TECH,
    "Film Crew": Department.Page.FILM_AUDIO,
    "Audio": Department.Page.FILM_AUDIO,
    "Marketing": Department.Page.MARKETING,
    "Culinary": Department.Page.CULINARY,
    "Transportation": Department.Page.TRANSPORTATION,
    "Security": Department.Page.SECURITY,
}

CREW_HOTEL = "Home 2 Suites by Hilton"
CAST_HOUSE = "Cast House 2.0"
SEGMENT_HOUSE = "Segment House"

LOCATIONS = [
    (CREW_HOTEL, Location.Kind.LODGING, "315 NW First Ave, Fort Lauderdale, FL 33301", "Crew hotel"),
    (CAST_HOUSE, Location.Kind.SHOOTING, "720 Isle of Palms Dr, Fort Lauderdale, FL 33301", "Location #1"),
    (SEGMENT_HOUSE, Location.Kind.SHOOTING, "433 NW 15th Way, Fort Lauderdale, FL 33311", "Location #2"),
]

D, A, S = User.Role.DIRECTOR, User.Role.ASSISTANT, User.Role.STAFF

# first, last, title, role, department, email, phone, call.
# The call is which of the day's calls below they're on; "" is on call (they come
# in with everyone at 11), None is not called. Emails and phones the call sheet
# doesn't have are made up: example.com addresses and 555-01xx numbers.
STAFF = [
    ("Brandon", "Gomes", "Executive Producer / Host / Owner", D, "Production", "brandon.gomes@example.com", "(954) 555-0142", "bus2"),
    ("Coach", "K", "Executive Producer / Host / Owner", D, "Production", "coach.k@example.com", "(954) 555-0177", ""),
    ("James", "Price", "Executive Producer / Owner", D, "Production", "jp@battlehouselive.com", "252-259-2150", ""),
    ("Adam", "Russell", "Executive Producer / Owner", D, "Production", "ar@battlehouselive.com", "954-352-2381", ""),
    ("Kelly", "Barnhill", "Executive Producer", D, "Production", "kb@battlehouselive.com", "252-258-2578", None),
    ("Mei", "Wang", "Director", D, "Production", "wangtv@gmail.com", "323-308-8486", "bus2"),
    ("Ish", "Soto", "Showrunner", D, "Production", "IshSoto@me.com", "323-806-3212", "bus2"),
    ("Stephanie", "Pons", "Field Producer", D, "Production", "ponsfilm@yahoo.com", "407-637-0242", ""),
    ("Babe", "Bower", "Production Manager / Assistant Director", A, "Production", "bbowerproduction@gmail.com", "714-743-4175", "bus1"),
    ("Denisa", "Zusman", "Production Coordinator", S, "Production", "denisazusman@gmail.com", "646-797-1612", "bus1"),
    ("Maria", "Curiel", "Segment Producer", D, "Production", "mavicumo111@gmail.com", "407-449-6237", "segment"),
    ("Evan", "Nievinski", "Segment Assistant", S, "Production", "epnievinski3456@gmail.com", "904-540-4730", "segment"),
    ("Kurt", "Stevenson", "Chief Technology Officer", D, "Tech", "ks@battlehouselive.com", "727-835-9885", ""),
    ("Nathan", "Kirby", "Operations Supervisor", D, "Operations", "nk@battlehouselive.com", "941-587-9949", ""),
    ("Big", "C", "Operations Manager", D, "Operations", "jazz32715@gmail.com", "786-886-8159", ""),
    ("Angela", "King", "Operations Manager", D, "Operations", "ask@battlehouselive.com", "404-202-7444", ""),
    # The call sheet gives her Nathan Kirby's email, so she keeps a placeholder.
    ("Gloria", "Palma", "Operations Coordinator", D, "Operations", "gloria.palma@example.com", "941-374-4584", ""),
    ("Justin", "Brown", "Operations Assistant", A, "Operations", "jbrownsrq@gmail.com", "941-650-8826", ""),
    ("Stephanie", "Bartley", "Administration / Assistant to Coach K", A, "Production", "sellingncbysteph@gmail.com", "863-397-5169", ""),
    ("Chris", "Jennings", "EIC / PRIIME Trailer Owner", S, "Tech", "chris@priime.us", "508-733-5525", "priime"),
    ("Jarrett", "Trexler", "Media Manager / Utility", S, "Tech", "jarrett@priime.us", "719-208-5338", "priime"),
    ("Carlos", "Hernandez", "Tech Director", S, "Tech", "cwhernandez42@gmail.com", "941-855-1045", "bus1"),
    ("Greg", "Litchy", "Replay / VT Tape", S, "Tech", "greg.litchy@gmail.com", "727-580-3405", "bus1"),
    ("Mo", "Frahm", "Director of Photography", S, "Film Crew", "mlfrahm@gmail.com", "323-252-4641", "bus2"),
    ("Max", "Barten", "Camera Operator", S, "Film Crew", "maxbarten62@gmail.com", "407-221-4501", "bus1"),
    ("Dylan", "Kitts", "Camera Operator", S, "Film Crew", "dkmusic99@gmail.com", "803-415-5879", "bus1"),
    ("Clara", "Beasley", "First Assistant Camera", S, "Film Crew", "clarab1244@gmail.com", "305-989-0912", "bus1"),
    ("Marcus", "Thompson", "Technical / Camera Assistant", S, "Film Crew", "marcusthompsonjr@gmail.com", "716-578-8867", "bus1"),
    ("Jamie", "Amos", "Audio Supervisor", S, "Audio", "JamieAmosAudio@gmail.com", "813-438-9502", "bus1"),
    ("Morgan", "Gatto", "Audio 2", S, "Audio", "magaudiosolutions@gmail.com", "813-230-5500", "bus1"),
    ("Joseph", "Espinosa", "Marketing & Social Media Manager", S, "Marketing", "je@battlehouselive.com", "941-549-4984", "bus1"),
    ("Sherpa", "Bucci", "Marketing & Social Media Coordinator", S, "Marketing", "pb@battlehouselive.com", "714-905-4501", ""),
    ("EJ", "Bernard", "Editor & Photographer", S, "Marketing", "ejbprod@gmail.com", "321-439-0360", ""),
    ("Josh", "Burkett", "Executive Chef", S, "Culinary", "hsm.events@yahoo.com", "717-917-2101", "culinary"),
    ("Karter", "Adams", "Sous Chef", S, "Culinary", "Kradams2206@gmail.com", "717-222-4720", "culinary"),
    ("Jared", "Taylor", "BHL Bus Driver", S, "Transportation", "Therealjaredtaylor@gmail.com", "919-604-5919", "driver"),
    ("Steven", "Baker", "Special Forces Security Owner", S, "Security", "BAKER510286@gmail.com", "786-444-4559", "bus1"),
    ("Chico", "", "Security Guard", S, "Security", "chico@example.com", "786-985-4974", "bus1"),
]  # fmt: skip

# Earlier names to update instead of adding someone new.
FORMERLY = {("Gloria", "Palma"): [("Gloria", "Palms")]}

# The day's shoot schedule, repeated every day of the shoot:
# key, start, end, talent / crew, segment, details, location, type, call.
# Keys keep each row's events together across days (one block per row), so
# running this again replaces them instead of adding copies.
P, ST, INF, O = Event.EventType.PRODUCTION, Event.EventType.STAFF, Event.EventType.INFLUENCER, Event.EventType.OTHER
SCHEDULE = [
    ("culinary", "08:30", "09:00", "Culinary team", "Culinary team: Cast House 2.0", "", f"{CAST_HOUSE} (see Babe)", ST, "culinary"),
    ("priime", "09:00", "09:30", "PRIIME team", "PRIIME crew: self report to Cast House 2.0", "", f"{CAST_HOUSE} (see Chris)", ST, "priime"),
    ("driver", "09:45", "10:00", "Transportation", "Bus driver call", "", CREW_HOTEL, ST, "driver"),
    ("breakfast", "10:00", "11:00", "All cast", "Cast breakfast (off camera)", "", "Kitchen / dining room", INF, None),
    ("bus1", "10:00", "10:30", "Crew (see email for details)", "Crew call: Shuttle bus #1", "", "Hotel", ST, "bus1"),
    ("segment", "10:15", "10:30", "Segment team", "Crew call: Segment House", "", SEGMENT_HOUSE, ST, "segment"),
    ("bus2", "10:30", "11:00", "Crew (see email for details)", "Crew call: Shuttle bus #2", "", "Hotel", ST, "bus2"),
    ("transpo", "10:00", "11:00", "All crew", "Transpo to Cast House 2.0", "", f"Hotel to {CAST_HOUSE}", O, None),
    ("crew-call", "11:00", "11:15", "All crew", "Crew call: Cast House 2.0", "", CAST_HOUSE, ST, ""),
    ("all-call", "11:00", "11:15", "All cast / all crew", "All cast / all crew: Cast House", "", CAST_HOUSE, P, None),
    ("setup", "11:00", "12:00", "BG & creators", "Set up / marks / camera position", "", CAST_HOUSE, P, None),
    ("live", "12:00", "22:00", "", "LIVE", "The show is live from 12:00 PM.", "", P, None),
    ("open", "12:00", "12:15", "BG", "Show open / recap", "", "TBD", P, None),
    ("fan-poll", "12:15", "12:30", "BG & creators", "Fan poll", "Challenge options 1 & 2: Trivia, Master Mind", "TBD", P, None),
    ("reset-1", "12:30", "13:00", "Creators & crew", "Reset: cameras / cast", "", CAST_HOUSE, P, None),
    ("reality-1", "13:00", "14:00", "BG & creators", "Reality / confessionals", "", "Main house / interview room", P, None),
    ("lunch", "14:00", "14:30", "BG & creators", "Cast lunch", "", "Grab and go", INF, None),
    ("challenge-3", "14:30", "16:00", "BG & creators", "Challenge 3", "Jenga", "TBD", P, None),
    ("reality-2", "14:30", "16:00", "BG & creators", "Reality / confessionals", "", "Main house / interview room", P, None),
    ("crew-meal", "16:00", "16:45", "BG & creators", "All crew meal", "", "Kitchen", INF, None),
    ("reset-2", "16:45", "17:00", "Creators & crew", "Reset: cameras / cast", "", CAST_HOUSE, P, None),
    ("challenge-4", "17:00", "18:00", "BG & creators", "Challenge 4", "TBD", "TBD", P, None),
    ("reset-3", "18:00", "18:30", "Creators & crew", "Reset: cameras / cast", "", CAST_HOUSE, P, None),
    ("dinner", "18:30", "19:30", "BG & creators", "Family dinner + extra credit", "", "Dining table", INF, None),
    ("tiktok", "19:30", "21:00", "BG & creators", "TikTok battles", "", "Battle arena", P, None),
    ("wrap-out", "21:00", "22:00", "All crew", "Wrap out", "", "Main house", P, None),
    ("travel", "21:15", "22:00", "All crew", "Travel to hotel", "", "Shuttle bus", O, None),
    ("wrap", "22:00", "22:15", "All crew", "Production wrap", "", "Hotel", ST, None),
]  # fmt: skip

BLOCK_NAMESPACE = uuid.UUID("5b0c3c1e-6a43-4b8e-9a51-0b3f6d2f1c10")


def block_for(key):
    return uuid.uuid5(BLOCK_NAMESPACE, f"battle-house-season-1/{key}")


class Command(BaseCommand):
    help = (
        "Load the Battle House Live call sheet: staff (with titles, site roles and departments), "
        f"locations, and the shoot schedule every day from {FIRST_DAY:%b %d} to {LAST_DAY:%b %d}. "
        "Safe to run more than once."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--remove-filming",
            action="store_true",
            help="Also delete the placeholder 'Filming' events in those dates (the shoot schedule replaces them).",
        )
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without saving.")

    @transaction.atomic
    def handle(self, *args, remove_filming=False, dry_run=False, **options):
        departments = self.load_departments()
        people = self.load_staff(departments)
        self.load_locations()
        self.load_schedule(people, remove_filming)
        if dry_run:
            transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING("Dry run: nothing was saved."))

    def load_departments(self):
        for old, new in RENAME_DEPARTMENTS.items():
            department = Department.objects.filter(name__iexact=old).first()
            if department and not Department.objects.filter(name__iexact=new).exists():
                department.name = new
                department.save()
                self.stdout.write(f"Renamed department {old} to {new}")
        departments = {}
        for name, page in DEPARTMENTS.items():
            department = Department.objects.filter(name__iexact=name).first()
            if department is None:
                department = Department.objects.create(name=name, page=page)
                self.stdout.write(f"Added department {name}")
            elif not department.page:
                department.page = page
                department.save(update_fields=["page"])
            departments[name] = department
        return departments

    def load_staff(self, departments):
        people = {}
        added = updated = 0
        for first, last, title, role, department, email, phone, call in STAFF:
            names = [(first, last), *FORMERLY.get((first, last), [])]
            person = User.objects.filter(email__iexact=email).first()
            for old_first, old_last in names:
                person = person or User.objects.filter(first_name=old_first, last_name=old_last).first()
            fields = {
                "first_name": first,
                "last_name": last,
                "title": title,
                "role": role,
                "department": departments[department],
                "phone": phone,
                "lodging": CAST_HOUSE if call in ("culinary", "priime") else CREW_HOTEL,
            }
            if person is None:
                person = User(email=email.lower(), email_verified=True, **fields)
                # They can be given a password (or reset theirs) when they start using K-Net.
                person.set_unusable_password()
                added += 1
            else:
                person.email = email.lower()
                person.is_active = True
                for field, value in fields.items():
                    setattr(person, field, value)
                updated += 1
            person.save()
            people[(first, last)] = (person, call)
        self.stdout.write(f"Staff: {added} added, {updated} updated")
        return people

    def load_locations(self):
        for name, kind, address, label in LOCATIONS:
            _, created = Location.objects.update_or_create(
                name=name, defaults={"kind": kind, "address": address, "notes": f"{label} on the call sheet."}
            )
            if created:
                self.stdout.write(f"Added location {name}")

    def load_schedule(self, people, remove_filming):
        zone = ProductionSettings.load().zone
        days = [FIRST_DAY + timedelta(days=n) for n in range((LAST_DAY - FIRST_DAY).days + 1)]
        window = Q(start__gte=datetime.combine(FIRST_DAY, time.min, tzinfo=zone)) & Q(
            start__lt=datetime.combine(LAST_DAY + timedelta(days=1), time.min, tzinfo=zone)
        )

        _, deleted = Event.objects.filter(block__in=[block_for(row[0]) for row in SCHEDULE]).delete()
        replaced = deleted.get("schedule.Event", 0)
        if remove_filming:
            _, deleted = Event.objects.filter(window, title="Filming").delete()
            self.stdout.write(f"Removed {deleted.get('schedule.Event', 0)} placeholder Filming events")

        # Everyone who's called comes in for the 11:00 crew call, on call or not.
        attendees = {call: [person for person, theirs in people.values() if theirs == call] for *_, call in SCHEDULE}
        attendees[""] = [person for person, theirs in people.values() if theirs is not None]

        created = 0
        Through = Event.attendees.through
        for key, start, end, talent_crew, title, description, location, event_type, call in SCHEDULE:
            block = block_for(key)
            events = Event.objects.bulk_create(
                [
                    Event(
                        title=title,
                        description=description,
                        talent_crew=talent_crew,
                        event_type=event_type,
                        location=location,
                        start=datetime.combine(day, time.fromisoformat(start), tzinfo=zone),
                        end=datetime.combine(day, time.fromisoformat(end), tzinfo=zone),
                        block=block,
                    )
                    for day in days
                ]
            )
            created += len(events)
            if call is not None:
                Through.objects.bulk_create(
                    [Through(event_id=event.pk, user_id=person.pk) for event in events for person in attendees[call]]
                )
        self.stdout.write(f"Shoot schedule: {created} events over {len(days)} days (replaced {replaced})")

        TimelineItem.objects.update_or_create(
            name=TIMELINE_NAME,
            defaults={
                "start_date": FIRST_DAY,
                "end_date": LAST_DAY,
                "description": "Shoot days 1 to 15, live every day from 12:00 PM.",
            },
        )
