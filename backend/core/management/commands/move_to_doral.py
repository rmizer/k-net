from datetime import date

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from core.management.commands import load_call_sheet
from core.management.commands.load_call_sheet import (
    CREW_HOTEL,
    FORT_LAUDERDALE_HOTEL,
    LOCATIONS,
    NEW_SHEET_DAY,
    STAFF,
    TIMELINE_NAME,
)
from locations.geocoding import geocode
from locations.models import Location
from schedule.models import TimelineItem

# The shoot day 18 call sheet (new_call_sheet.jpg): the crew hotel is now in
# Doral, with Airbnbs for the hosts and some crew, the PRIIME team works from a
# parking garage, and a few people are new or changed jobs.
CHANGED_STAFF = ["ask@battlehouselive.com", "je@battlehouselive.com", "anyelomiguel@gmail.com", "JessieR28221@gmail.com"]
# If the shoot's timeline bar is missing, load the new sheet through this day.
LAST_DAY = date(2026, 11, 7)


class Command(BaseCommand):
    help = (
        f"Load the shoot day 18 call sheet: the Doral crew hotel and new places, the staff changes, and its "
        f"schedule on every shoot day from {NEW_SHEET_DAY:%b %d}. Safe to run more than once."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without saving.")

    @transaction.atomic
    def handle(self, *args, dry_run=False, **options):
        sheet = load_call_sheet.Command(stdout=self.stdout, stderr=self.stderr)
        sheet.load_locations()
        self.pin_locations()
        self.update_staff(sheet)
        self.move_crew()
        shoot = TimelineItem.objects.filter(name=TIMELINE_NAME).first()
        last = max(shoot.end_date, NEW_SHEET_DAY) if shoot else LAST_DAY
        call_command(
            "load_call_sheet",
            "--schedule-only",
            "--start",
            NEW_SHEET_DAY.isoformat(),
            "--end",
            last.isoformat(),
            stdout=self.stdout,
        )
        if dry_run:
            transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING("Dry run: nothing was saved."))

    def pin_locations(self):
        for name, *_ in LOCATIONS:
            location = Location.objects.get(name=name)
            if location.latitude is None:
                point = geocode(location.address)
                if point:
                    location.latitude, location.longitude = point
                    location.save(update_fields=["latitude", "longitude"])
                self.stdout.write(f"Map pin for {name}: {'added' if point else 'not found'}")
        Location.objects.filter(name=FORT_LAUDERDALE_HOTEL).update(
            notes="Crew hotel in Fort Lauderdale from Oct 25, until the move to Doral. Free airport shuttle at limited hours."
        )

    def update_staff(self, sheet):
        departments = sheet.load_departments()
        for row in STAFF:
            if row[5] in CHANGED_STAFF:
                person, created = sheet.save_person(row, departments)
                self.stdout.write(f"{'Added' if created else 'Updated'} {person}: {person.title}, {person.department}")

    def move_crew(self):
        moved = User.objects.filter(lodging=FORT_LAUDERDALE_HOTEL).update(lodging=CREW_HOTEL)
        self.stdout.write(f"Lodging: {moved} people moved to {CREW_HOTEL}")
