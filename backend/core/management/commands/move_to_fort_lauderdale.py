import re
import uuid
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from announcements.models import Announcement
from core.management.commands.load_call_sheet import BLOCK_NAMESPACE, SCHEDULE, TIMELINE_NAME, block_for
from core.models import ProductionSettings
from locations.geocoding import geocode
from locations.models import Location
from schedule.models import Event, TimelineItem

# Battle House Live shot in Tampa through Oct 24, travelled on Oct 25 and shoots
# in Fort Lauderdale from Oct 26. The Support Office stays in Raleigh.
FIRST_DAY = date(2026, 10, 9)
TRAVEL_DAY = date(2026, 10, 25)
# The first Fort Lauderdale day goes live early: 8:00 AM to the usual 10:00 PM.
FIRST_LIVE_START = time(8, 0)

TAMPA_HOUSE = "Tampa Cast House"
TAMPA_HOTEL = "Hilton Tampa Airport Westshore"
OLD_CREW_HOTEL = "Home 2 Suites by Hilton"
CREW_HOTEL = "Candlewood Suites Ft. Lauderdale Airport/Cruise"
CAST_HOUSE = "Cast House 2.0"

# name, kind, custom type, address, phone, website, notes.
LOCATIONS = [
    (TAMPA_HOUSE, Location.Kind.SHOOTING, "", "Davis Islands, Tampa, FL 33606", "", "",
     "Shooting location for shoot days 1 to 16 (Oct 9 to Oct 24)."),
    (TAMPA_HOTEL, Location.Kind.LODGING, "", "2225 N Lois Ave, Tampa, FL 33607", "",
     "https://www.hilton.com/en/hotels/tpaahhf-hilton-tampa-airport-westshore/",
     "Crew hotel in Tampa, Oct 9 to Oct 24. Checked out Oct 25."),
    (CREW_HOTEL, Location.Kind.LODGING, "", "1120 W State Road 84, Fort Lauderdale, FL 33315", "(954) 522-8822", "",
     "Crew hotel in Fort Lauderdale from Oct 25, until the move to Doral. Free airport shuttle at limited hours."),
    ("Rock Bar", Location.Kind.OTHER, "Bar", "219 S Fort Lauderdale Beach Blvd, Fort Lauderdale, FL 33316",
     "(954) 533-1568", "https://rockbarflb.com/", "Beach bar, open 11 AM to 4 AM. A cast and crew favorite."),
]  # fmt: skip

# Map pins for addresses the geocoder doesn't find.
PINS = {CREW_HOTEL: ("26.091153", "-80.155744"), "Rock Bar": ("26.120294", "-80.104670")}

# How the Tampa days read: the call sheet's Fort Lauderdale places, swapped for Tampa's.
TAMPA_NAMES = [
    (re.compile(r"\bCast House( 2\.0)?"), TAMPA_HOUSE),
    (re.compile(r"\bSegment House"), f"{TAMPA_HOUSE} (segment room)"),
    (re.compile(re.escape(OLD_CREW_HOTEL)), TAMPA_HOTEL),
]

# The travel day: key, start, end, talent / crew, title, details, location, type,
# and who's on it (a call sheet row whose people come along, or None).
P, ST, INF, O = Event.EventType.PRODUCTION, Event.EventType.STAFF, Event.EventType.INFLUENCER, Event.EventType.OTHER
TRAVEL = [
    ("pack-out", "08:00", "09:30", "Culinary & PRIIME teams", "Pack out: Tampa Cast House",
     "Kitchen and the PRIIME trailer packed and on the road by 9:30.", TAMPA_HOUSE, ST, "pack-out"),
    ("check-out", "08:00", "09:30", "All crew", "Breakfast & hotel check-out",
     "Bags in the lobby by 9:15. Keys back at the front desk.", TAMPA_HOTEL, ST, "crew-call"),
    ("driver", "09:00", "09:30", "Transportation", "Bus driver call", "", TAMPA_HOTEL, ST, "driver"),
    ("cast-breakfast", "08:30", "09:30", "All cast", "Cast breakfast & pack up (off camera)", "", TAMPA_HOUSE, INF, None),
    ("load", "09:30", "10:00", "All crew", "Load buses", "", TAMPA_HOUSE, ST, "crew-call"),
    ("drive", "10:00", "15:00", "All cast / all crew", "Travel: Tampa to Fort Lauderdale",
     "Buses leave the Tampa mansion for the airport at 10:00 AM, then we fly to Fort Lauderdale.",
     "Tampa mansion to the airport", O, "crew-call"),
    ("check-in", "15:00", "16:00", "All crew", "Check-in: Candlewood Suites", "", CREW_HOTEL, ST, "crew-call"),
    ("cast-move-in", "15:00", "16:30", "All cast", "Cast move-in: Cast House 2.0", "", CAST_HOUSE, INF, None),
    ("walk-through", "16:30", "18:00", "All crew", "Walk-through & tech set up: Cast House 2.0",
     "Camera positions, audio and the PRIIME trailer for tomorrow's live show.", CAST_HOUSE, P, "crew-call"),
    ("dinner", "18:30", "19:30", "All cast / all crew", "Welcome dinner", "", CAST_HOUSE, INF, None),
    ("wrap", "20:00", "20:15", "All crew", "Travel day wrap", "No shooting today. Live again Oct 26 at 8:00 AM.",
     CREW_HOTEL, ST, None),
]  # fmt: skip

ANNOUNCEMENT = "We're moving to Fort Lauderdale today"
ANNOUNCEMENT_BODY = (
    "Today is a travel day: no shooting. Buses leave the Tampa mansion for the airport at 10:00 AM. Bags in "
    "the lobby by 9:15. The crew hotel is now Candlewood Suites Ft. Lauderdale Airport/Cruise, 1120 W State Road "
    "84, and we shoot at Cast House 2.0, 720 Isle of Palms Dr. Walk-through at 4:30 PM, welcome dinner at 6:30 PM. "
    "We're live again tomorrow at 8:00 AM."
)
# Posted by Stephanie Bartley (assistant to Coach K); a Site Manager if her account is gone.
ANNOUNCEMENT_AUTHOR = "sellingncbysteph@gmail.com"


# Travel day rows taken out since the first run; running again deletes them.
# "lunch" was a stop on the drive, and the move is by air.
REMOVED_TRAVEL = ["lunch"]


def travel_block(key):
    return uuid.uuid5(BLOCK_NAMESPACE, f"battle-house-season-1/travel/{key}")


class Command(BaseCommand):
    help = (
        "Move Battle House Live from Tampa to Fort Lauderdale: Tampa places on the shoot days before "
        f"{TRAVEL_DAY:%b %d}, a travel day on {TRAVEL_DAY:%b %d}, the Fort Lauderdale crew hotel after it, "
        "and a pinned announcement. Safe to run more than once."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without saving.")

    @transaction.atomic
    def handle(self, *args, dry_run=False, **options):
        zone = ProductionSettings.load().zone
        self.load_locations()
        self.move_crew()
        self.tampa_days(zone)
        self.travel_day(zone)
        self.fort_lauderdale_days(zone)
        self.first_live_day(zone)
        self.timeline()
        self.announce()
        if dry_run:
            transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING("Dry run: nothing was saved."))

    def load_locations(self):
        # The Fort Lauderdale crew hotel takes over the old one's entry.
        Location.objects.filter(name=OLD_CREW_HOTEL).update(name=CREW_HOTEL)
        for name, kind, custom_type, address, phone, website, notes in LOCATIONS:
            location, created = Location.objects.update_or_create(
                name=name,
                defaults={
                    "kind": kind,
                    "custom_type": custom_type,
                    "address": address,
                    "phone": phone,
                    "website": website,
                    "notes": notes,
                },
            )
            point = geocode(address) or PINS.get(name)
            if point:
                location.latitude, location.longitude = point
                location.save(update_fields=["latitude", "longitude"])
            self.stdout.write(f"{'Added' if created else 'Updated'} location {name}" + ("" if point else " (no map pin)"))

    def move_crew(self):
        moved = User.objects.filter(lodging=OLD_CREW_HOTEL).update(lodging=CREW_HOTEL)
        self.stdout.write(f"Lodging: {moved} people moved to {CREW_HOTEL}")

    def window(self, zone, first, last):
        return {
            "start__gte": datetime.combine(first, time.min, tzinfo=zone),
            "start__lt": datetime.combine(last + timedelta(days=1), time.min, tzinfo=zone),
        }

    def tampa_days(self, zone):
        changed = 0
        blocks = [block_for(row[0]) for row in SCHEDULE]
        events = Event.objects.filter(block__in=blocks, **self.window(zone, FIRST_DAY, TRAVEL_DAY - timedelta(days=1)))
        for event in events:
            title, location = event.title, event.location
            for pattern, name in TAMPA_NAMES:
                if name not in title:
                    title = pattern.sub(name, title)
                if name not in location:
                    location = pattern.sub(name, location)
            if (title, location) != (event.title, event.location):
                event.title, event.location = title, location
                event.save(update_fields=["title", "location", "updated_at"])
                changed += 1
        self.stdout.write(f"Tampa days: {changed} events now at Tampa places")

    def travel_day(self, zone):
        window = self.window(zone, TRAVEL_DAY, TRAVEL_DAY)
        # Who comes along, from the day's call sheet before it's replaced.
        def called(key):
            event = Event.objects.filter(block=block_for(key), **window).first()
            return list(event.attendees.all()) if event else []

        people = {
            "crew-call": called("crew-call"),
            "driver": called("driver"),
            "pack-out": called("culinary") + called("priime"),
        }
        if any(people.values()):
            self.people = people
        else:  # Already a travel day: keep who's on it.
            self.people = {
                "crew-call": list(Event.objects.get(block=travel_block("drive"), **window).attendees.all()),
                "driver": list(Event.objects.get(block=travel_block("driver"), **window).attendees.all()),
                "pack-out": list(Event.objects.get(block=travel_block("pack-out"), **window).attendees.all()),
            }

        replaced = Event.objects.filter(
            block__in=[block_for(row[0]) for row in SCHEDULE]
            + [travel_block(row[0]) for row in TRAVEL]
            + [travel_block(key) for key in REMOVED_TRAVEL],
            **window,
        ).delete()[1].get("schedule.Event", 0)
        for key, start, end, talent_crew, title, description, location, event_type, call in TRAVEL:
            event = Event.objects.create(
                title=title,
                description=description,
                talent_crew=talent_crew,
                event_type=event_type,
                location=location,
                start=datetime.combine(TRAVEL_DAY, time.fromisoformat(start), tzinfo=zone),
                end=datetime.combine(TRAVEL_DAY, time.fromisoformat(end), tzinfo=zone),
                block=travel_block(key),
            )
            if call:
                event.attendees.set(self.people[call])
        self.stdout.write(f"Travel day: {len(TRAVEL)} events (replaced {replaced}), {len(self.people['crew-call'])} crew")

    def fort_lauderdale_days(self, zone):
        later = Event.objects.filter(start__gte=datetime.combine(TRAVEL_DAY + timedelta(days=1), time.min, tzinfo=zone))
        moved = later.filter(location=OLD_CREW_HOTEL).update(location=CREW_HOTEL)
        self.stdout.write(f"Fort Lauderdale days: {moved} events now at {CREW_HOTEL}")

    def first_live_day(self, zone):
        day = TRAVEL_DAY + timedelta(days=1)
        start = datetime.combine(day, FIRST_LIVE_START, tzinfo=zone)
        changed = Event.objects.filter(block=block_for("live"), **self.window(zone, day, day)).update(
            start=start, description="The show is live from 8:00 AM."
        )
        self.stdout.write(f"First Fort Lauderdale day: live from {FIRST_LIVE_START:%H:%M} ({changed} event)")

    def timeline(self):
        shoot = TimelineItem.objects.filter(name=TIMELINE_NAME).first()
        if shoot:
            shoot.description = (
                f"Tampa from Oct 9 to Oct 24, travel day Oct 25, Fort Lauderdale from Oct 26 to {shoot.end_date:%b} "
                f"{shoot.end_date.day}. Live every shoot day from 12:00 PM (8:00 AM on Oct 26)."
            )
            shoot.save(update_fields=["description", "updated_at"])
        TimelineItem.objects.update_or_create(
            name="Travel day: Tampa to Fort Lauderdale",
            defaults={
                "start_date": TRAVEL_DAY,
                "end_date": TRAVEL_DAY,
                "description": f"No shooting. Cast to {CAST_HOUSE}, crew to {CREW_HOTEL}.",
            },
        )
        self.stdout.write("Timeline: travel day milestone added")

    def announce(self):
        author = (
            User.objects.filter(email__iexact=ANNOUNCEMENT_AUTHOR, is_active=True).first()
            or User.objects.filter(role=User.Role.SITE_MANAGER, is_active=True).order_by("pk").first()
        )
        # Pinned when it's first posted; move_to_doral unpins it later.
        _, created = Announcement.objects.update_or_create(
            title=ANNOUNCEMENT,
            defaults={"body": ANNOUNCEMENT_BODY, "created_by": author},
            create_defaults={"body": ANNOUNCEMENT_BODY, "pinned": True, "created_by": author},
        )
        self.stdout.write(f"Announcement {'posted' if created else 'updated'}: {ANNOUNCEMENT}")
