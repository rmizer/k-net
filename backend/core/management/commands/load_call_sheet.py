import uuid
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from accounts.models import Department, User
from core.models import ProductionSettings
from locations.models import Location
from schedule.models import Event, TimelineItem

# From the Battle House Live season 1 call sheets (dev/img/Battle House Assets): call_sheet_example.jpg
# for the first days, and new_call_sheet.jpg (shoot day 18) from NEW_SHEET_DAY on.
FIRST_DAY = date(2026, 10, 9)  # Shoot day 1
LAST_DAY = date(2026, 10, 23)  # The first load ran through day 15; --start/--end add more days.
NEW_SHEET_DAY = date(2026, 10, 28)  # Shoot day 18
# No shooting: the move from Tampa to Fort Lauderdale (see move_to_fort_lauderdale).
TRAVEL_DAYS = {date(2026, 10, 25)}
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

# The crew moved from the Fort Lauderdale hotel to Doral with the day 18 call sheet (see move_to_doral).
FORT_LAUDERDALE_HOTEL = "Candlewood Suites Ft. Lauderdale Airport/Cruise"
CREW_HOTEL = "Candlewood Suites Miami - Doral"
HOST_AIRBNB = "Host Airbnb"
CREW_AIRBNB = "Crew Airbnb"
CAST_HOUSE = "Cast House 2.0"
SEGMENT_HOUSE = "Segment House"
GARAGE = "Governmental Center Parking Garage"

LOCATIONS = [
    (CREW_HOTEL, Location.Kind.LODGING, "10505 NW 36th St, Doral, FL 33178", "Crew hotel"),
    (HOST_AIRBNB, Location.Kind.LODGING, "2000 Coral Shores Drive, Fort Lauderdale, FL 33306", "Host Airbnb"),
    (CREW_AIRBNB, Location.Kind.LODGING, "608 SW 13th St, Fort Lauderdale, FL 33315", "Crew Airbnb"),
    (CAST_HOUSE, Location.Kind.SHOOTING, "720 Isle of Palms Dr, Fort Lauderdale, FL 33301", "Location #1"),
    (SEGMENT_HOUSE, Location.Kind.SHOOTING, "433 NW 15th Way, Fort Lauderdale, FL 33311", "Segment Airbnb"),
    (GARAGE, Location.Kind.PRODUCTION, "151 SW 2nd St, Fort Lauderdale, FL 33301", "PRIIME garage"),
]

D, A, S = User.Role.DIRECTOR, User.Role.ASSISTANT, User.Role.STAFF

# first, last, title, role, department, email, phone, call, day 18 call.
# The calls are which of the day's calls below they're on, on the first call sheet
# (SCHEDULE) and from day 18 (SCHEDULE_DAY_18); "" is on call (they come in with
# everyone at 11), None is not called. Emails and phones the call sheet doesn't
# have are made up: example.com addresses and 555-01xx numbers.
STAFF = [
    ("Brandon", "Gomes", "Executive Producer / Host / Owner", D, "Production", "brandon.gomes@example.com", "(954) 555-0142", "bus2", ""),
    ("Coach", "K", "Executive Producer / Host / Owner", D, "Production", "coach.k@example.com", "(954) 555-0177", "", ""),
    ("Angela", "King", "Executive Producer / Host / Owner", D, "Production", "ask@battlehouselive.com", "404-202-7444", "", ""),
    ("James", "Price", "Executive Producer / Owner", D, "Production", "jp@battlehouselive.com", "252-259-2150", "", ""),
    ("Adam", "Russell", "Executive Producer / Owner", D, "Production", "ar@battlehouselive.com", "954-352-2381", "", ""),
    ("Kelly", "Barnhill", "Executive Producer", D, "Production", "kb@battlehouselive.com", "252-258-2578", None, None),
    ("Mei", "Wang", "Director", D, "Production", "wangtv@gmail.com", "323-308-8486", "bus2", ""),
    ("Ish", "Soto", "Showrunner", D, "Production", "IshSoto@me.com", "323-806-3212", "bus2", ""),
    ("Stephanie", "Pons", "Field Producer", D, "Production", "ponsfilm@yahoo.com", "407-637-0242", "", ""),
    ("Babe", "Bower", "Production Manager / Assistant Director", A, "Production", "bbowerproduction@gmail.com", "714-743-4175", "bus1", "production"),
    ("Denisa", "Zusman", "Production Coordinator", S, "Production", "denisazusman@gmail.com", "646-797-1612", "bus1", "garage"),
    ("Maria", "Curiel", "Segment Producer", D, "Production", "mavicumo111@gmail.com", "407-449-6237", "segment", ""),
    ("Evan", "Nievinski", "Segment Assistant", S, "Production", "epnievinski3456@gmail.com", "904-540-4730", "segment", ""),
    ("Miguel", "Anyelo", "Production Assistant", S, "Production", "anyelomiguel@gmail.com", "305-766-1216", None, None),
    ("Jessie", "Rivera", "Production Assistant", S, "Production", "JessieR28221@gmail.com", "414-581-3437", None, "garage"),
    ("Kurt", "Stevenson", "Chief Technology Officer", D, "Tech", "ks@battlehouselive.com", "727-835-9885", "", ""),
    ("Nathan", "Kirby", "Operations Supervisor", D, "Operations", "nk@battlehouselive.com", "941-587-9949", "", ""),
    ("Big", "C", "Operations Manager", D, "Operations", "jazz32715@gmail.com", "786-886-8159", "", ""),
    # The call sheet gives her Nathan Kirby's email, so she keeps a placeholder.
    ("Gloria", "Palma", "Operations Coordinator", D, "Operations", "gloria.palma@example.com", "941-374-4584", "", ""),
    ("Justin", "Brown", "Operations Assistant", A, "Operations", "jbrownsrq@gmail.com", "941-650-8826", "", ""),
    ("Stephanie", "Bartley", "Administration / Assistant to Coach K", A, "Production", "sellingncbysteph@gmail.com", "863-397-5169", "", ""),
    ("Chris", "Jennings", "EIC / PRIIME Trailer Owner", S, "Tech", "chris@priime.us", "508-733-5525", "priime", "garage"),
    ("Jarrett", "Trexler", "Media Manager / Utility", S, "Tech", "jarrett@priime.us", "719-208-5338", "priime", "garage"),
    ("Carlos", "Hernandez", "Tech Director", S, "Tech", "cwhernandez42@gmail.com", "941-855-1045", "bus1", "production"),
    ("Greg", "Litchy", "Replay / VT Tape", S, "Tech", "greg.litchy@gmail.com", "727-580-3405", "bus1", ""),
    ("Mo", "Frahm", "Director of Photography", S, "Film Crew", "mlfrahm@gmail.com", "323-252-4641", "bus2", ""),
    ("Max", "Barten", "Camera Operator", S, "Film Crew", "maxbarten62@gmail.com", "407-221-4501", "bus1", "production"),
    ("Dylan", "Kitts", "Camera Operator", S, "Film Crew", "dkmusic99@gmail.com", "803-415-5879", "bus1", "production"),
    ("Joseph", "Espinosa", "Camera Operator", S, "Film Crew", "je@battlehouselive.com", "941-549-4984", "bus1", "production"),
    ("Clara", "Beasley", "First Assistant Camera", S, "Film Crew", "clarab1244@gmail.com", "305-989-0912", "bus1", "production"),
    ("Marcus", "Thompson", "Technical / Camera Assistant", S, "Film Crew", "marcusthompsonjr@gmail.com", "716-578-8867", "bus1", "production"),
    ("Jamie", "Amos", "Audio Supervisor", S, "Audio", "JamieAmosAudio@gmail.com", "813-438-9502", "bus1", "production"),
    ("Morgan", "Gatto", "Audio 2", S, "Audio", "magaudiosolutions@gmail.com", "813-230-5500", "bus1", "production"),
    ("Sherpa", "Bucci", "Marketing & Social Media Coordinator", S, "Marketing", "pb@battlehouselive.com", "714-905-4501", "", ""),
    ("EJ", "Bernard", "Editor & Photographer", S, "Marketing", "ejbprod@gmail.com", "321-439-0360", "", ""),
    ("Josh", "Burkett", "Executive Chef", S, "Culinary", "hsm.events@yahoo.com", "717-917-2101", "culinary", "culinary"),
    ("Karter", "Adams", "Sous Chef", S, "Culinary", "Kradams2206@gmail.com", "717-222-4720", "culinary", "culinary"),
    ("Jared", "Taylor", "BHL Bus Driver", S, "Transportation", "Therealjaredtaylor@gmail.com", "919-604-5919", "driver", "driver"),
    ("Steven", "Baker", "Special Forces Security Owner", S, "Security", "BAKER510286@gmail.com", "786-444-4559", "bus1", "security"),
    ("Chico", "", "Security Guard", S, "Security", "chico@example.com", "786-985-4974", "bus1", None),
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
    ("driver", "09:45", "10:00", "Transportation", "Bus driver call", "", FORT_LAUDERDALE_HOTEL, ST, "driver"),
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

# From shoot day 18 (new_call_sheet.jpg), in the same columns. The driver and
# security calls come from the staff list; the schedule doesn't have them. The
# culinary call is 9:00 on the schedule (the staff list says 9:30).
SCHEDULE_DAY_18 = [
    ("d18-culinary", "09:00", "09:30", "Culinary crew", "Call time: Culinary crew", "", CAST_HOUSE, ST, "culinary"),
    ("d18-driver", "09:45", "10:00", "Transportation", "Bus driver call", "", CREW_HOTEL, ST, "driver"),
    ("d18-production", "10:00", "10:30", "Production crew", "Call time: Production crew", "", "Hotel: shuttle bus", ST, "production"),
    ("d18-breakfast", "10:00", "10:30", "Creators", "Cast breakfast", "", CAST_HOUSE, INF, None),
    ("d18-garage", "10:30", "11:00", "PRIIME crew", "Call time: PRIIME crew", "", GARAGE, ST, "garage"),
    ("d18-transpo", "10:00", "11:00", "Production / PRIIME crew", "Transpo to Cast House 2.0",
     "White Sprinter (crew) / Jessie (tech team)", f"Hotel and garage to {CAST_HOUSE}", O, None),
    ("d18-crew-call", "11:00", "11:15", "All cast / all crew", "Crew call: Cast House 2.0", "", CAST_HOUSE, ST, ""),
    ("d18-load-in", "11:00", "12:00", "All crew / all cast", "Load in / ESU", "", CAST_HOUSE, P, None),
    ("live", "12:00", "22:00", "", "LIVE", "The show is live from 12:00 PM.", "", P, None),
    ("d18-open", "12:00", "12:15", "BG", "Show open / recap", "", "TBD", P, None),
    ("d18-challenge-1", "12:15", "16:00", "BG & creators", "Challenge 1", "AYCE F*cked Up Buffet", "TBD", P, None),
    ("d18-reset-1", "12:15", "16:00", "Creators & crew", "Reset: cameras / cast", "", "TBD", P, None),
    ("d18-challenge-2", "12:15", "16:00", "BG & creators", "Challenge 2", "Friend or Fo", "TBD", P, None),
    ("d18-lunch", "14:00", "14:30", "Creators", "Cast lunch", "", "Grab and go", INF, None),
    ("d18-reset-2", "14:00", "14:30", "Creators & crew", "Reset: cameras / cast", "", "TBD", P, None),
    ("d18-challenge-3", "14:30", "16:00", "BG & creators", "Challenge 3", "Battle House Superlatives", "TBD", P, None),
    ("d18-security", "15:00", "15:15", "Security", "Call time: Security", "", CAST_HOUSE, ST, "security"),
    ("d18-crew-meal", "16:00", "16:45", "All crew", "All crew meal", "", CAST_HOUSE, INF, None),
    ("d18-reset-3", "16:45", "17:00", "Creators & crew", "Reset: cameras / cast", "", "TBD", P, None),
    ("d18-challenge-4", "17:00", "18:30", "BG & creators", "Challenge 4", "Water Hanging", "TBD", P, None),
    ("d18-reality", "17:00", "18:30", "BG & creators", "Reality / confessionals", "", "Main house / interview room", P, None),
    ("d18-dinner", "18:00", "19:00", "All cast", "Family dinner", "", CAST_HOUSE, INF, None),
    ("d18-reset-4", "18:30", "19:00", "Creators & crew", "Reset: cameras / cast", "", "TBD", P, None),
    ("d18-tiktok", "19:00", "20:30", "BG & creators", "TikTok battles", "", "TBD", P, None),
    ("d18-wrap-out", "20:30", "21:00", "All crew", "Wrap out", "", "TBD", P, None),
    ("d18-travel", "21:00", "22:00", "All crew", "Travel to hotel", "", f"{CAST_HOUSE} to the crew hotel / Airbnbs", O, None),
    ("d18-wrap", "22:00", "22:15", "All crew", "Production wrap", "", "Hotel", ST, None),
]  # fmt: skip

BLOCK_NAMESPACE = uuid.UUID("5b0c3c1e-6a43-4b8e-9a51-0b3f6d2f1c10")


def block_for(key):
    return uuid.uuid5(BLOCK_NAMESPACE, f"battle-house-season-1/{key}")


class Command(BaseCommand):
    help = (
        "Load the Battle House Live call sheet: staff (with titles, site roles and departments), "
        f"locations, and the shoot schedule every day from {FIRST_DAY:%b %d} to {LAST_DAY:%b %d} "
        "(or --start to --end). Safe to run more than once: it replaces only the days it loads."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--remove-filming",
            action="store_true",
            help="Also delete the placeholder 'Filming' events in those dates (the shoot schedule replaces them).",
        )
        parser.add_argument(
            "--start", type=date.fromisoformat, default=FIRST_DAY, help="First day to load (YYYY-MM-DD)."
        )
        parser.add_argument("--end", type=date.fromisoformat, default=LAST_DAY, help="Last day to load (YYYY-MM-DD).")
        parser.add_argument(
            "--schedule-only",
            action="store_true",
            help="Only add the shoot schedule: leave staff, departments and locations as they are on the site.",
        )
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without saving.")

    @transaction.atomic
    def handle(
        self, *args, start=FIRST_DAY, end=LAST_DAY, schedule_only=False, remove_filming=False, dry_run=False, **options
    ):
        if end < start:
            raise CommandError("--end is before --start.")
        if schedule_only:
            people = self.find_staff()
        else:
            departments = self.load_departments()
            people = self.load_staff(departments)
            self.load_locations()
        self.load_schedule(people, start, end, remove_filming)
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
        for row in STAFF:
            person, created = self.save_person(row, departments)
            added += created
            updated += not created
            people[row[:2]] = (person, *row[-2:])
        self.stdout.write(f"Staff: {added} added, {updated} updated")
        return people

    def save_person(self, row, departments):
        """Add or update one STAFF row's person; also whether they were added."""
        first, last, title, role, department, email, phone, call, _call_day_18 = row
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
        created = person is None
        if created:
            person = User(email=email.lower(), email_verified=True, **fields)
            # They can be given a password (or reset theirs) when they start using K-Net.
            person.set_unusable_password()
        else:
            person.email = email.lower()
            person.is_active = True
            for field, value in fields.items():
                setattr(person, field, value)
        person.save()
        return person, created

    def find_staff(self):
        """The call sheet's people as they are on the site, without changing them."""
        people = {}
        for first, last, *_, email, _phone, call, call_day_18 in STAFF:
            person = User.objects.filter(email__iexact=email, is_active=True).first()
            if person is None:
                self.stdout.write(self.style.WARNING(f"Not on the site, so left off the schedule: {first} {last}"))
                continue
            people[(first, last)] = (person, call, call_day_18)
        self.stdout.write(f"Staff: found {len(people)} of {len(STAFF)}")
        return people

    def load_locations(self):
        for name, kind, address, label in LOCATIONS:
            _, created = Location.objects.update_or_create(
                name=name, defaults={"kind": kind, "address": address, "notes": f"{label} on the call sheet."}
            )
            if created:
                self.stdout.write(f"Added location {name}")

    def load_schedule(self, people, first, last, remove_filming):
        zone = ProductionSettings.load().zone
        days = [first + timedelta(days=n) for n in range((last - first).days + 1)]
        days = [day for day in days if day not in TRAVEL_DAYS]
        window = Q(start__gte=datetime.combine(first, time.min, tzinfo=zone)) & Q(
            start__lt=datetime.combine(last + timedelta(days=1), time.min, tzinfo=zone)
        )

        # Only the days being loaded: earlier and later shoot days stay as they are.
        blocks = [block_for(row[0]) for row in SCHEDULE + SCHEDULE_DAY_18]
        _, deleted = Event.objects.filter(window, block__in=blocks).delete()
        replaced = deleted.get("schedule.Event", 0)
        if remove_filming:
            _, deleted = Event.objects.filter(window, title="Filming").delete()
            self.stdout.write(f"Removed {deleted.get('schedule.Event', 0)} placeholder Filming events")

        # Each day follows the call sheet it falls under.
        first_sheet = {person: call for person, call, _ in people.values()}
        day_18_sheet = {person: call for person, _, call in people.values()}
        created = self.add_schedule(
            SCHEDULE, first_sheet, [day for day in days if day < NEW_SHEET_DAY], zone
        ) + self.add_schedule(SCHEDULE_DAY_18, day_18_sheet, [day for day in days if day >= NEW_SHEET_DAY], zone)
        self.stdout.write(f"Shoot schedule: {created} events over {len(days)} days (replaced {replaced})")
        self.update_timeline(zone)

    def add_schedule(self, schedule, calls, days, zone):
        """One call sheet's events on each of the days; calls maps each person to their call."""
        # Everyone who's called comes in for the 11:00 crew call, on call or not.
        attendees = {call: [person for person, theirs in calls.items() if theirs == call] for *_, call in schedule}
        attendees[""] = [person for person, theirs in calls.items() if theirs is not None]

        created = 0
        Through = Event.attendees.through
        for key, start, end, talent_crew, title, description, location, event_type, call in schedule:
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
        return created

    def update_timeline(self, zone):
        # The timeline bar covers every shoot day loaded so far.
        loaded = Event.objects.filter(block=block_for("live")).order_by("start")
        shoot_days = sorted({event.start.astimezone(zone).date() for event in loaded})
        if shoot_days:
            TimelineItem.objects.update_or_create(
                name=TIMELINE_NAME,
                defaults={
                    "start_date": shoot_days[0],
                    "end_date": shoot_days[-1],
                    "description": f"Shoot days 1 to {(shoot_days[-1] - FIRST_DAY).days + 1}, live every day from 12:00 PM.",
                },
            )
