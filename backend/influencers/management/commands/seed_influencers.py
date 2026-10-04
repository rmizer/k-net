import random
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from influencers.models import Influencer, InfluencerNote, TravelArrangement

# The production is in Tampa and everyone stays at the crew hotel.
HOTEL = "Hilton Tampa Airport Westshore"
HOTEL_ADDRESS = "2225 N Lois Ave, Tampa, FL 33607"
TAMPA = ZoneInfo("America/New_York")

# (home city, airport code, airline)
HOMETOWNS = [
    ("Atlanta, GA", "ATL", "Delta"),
    ("Dallas, TX", "DFW", "American"),
    ("Houston, TX", "IAH", "United"),
    ("Chicago, IL", "ORD", "United"),
    ("New York, NY", "JFK", "JetBlue"),
    ("Los Angeles, CA", "LAX", "Delta"),
    ("Las Vegas, NV", "LAS", "Southwest"),
    ("Nashville, TN", "BNA", "Southwest"),
    ("Charlotte, NC", "CLT", "American"),
    ("Phoenix, AZ", "PHX", "Southwest"),
    ("Denver, CO", "DEN", "Frontier"),
    ("Detroit, MI", "DTW", "Delta"),
]
LOCAL = ("Tampa, FL", None, None)  # Some creators live close enough to drive.

STREETS = ["Maple Ave", "Oak St", "Cedar Ln", "Sunset Blvd", "Lakeview Dr", "Park Pl", "Elm St", "River Rd"]
AGENT_FIRST = ["Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Jamie", "Drew", "Skyler"]
AGENT_LAST = ["Brooks", "Hayes", "Reed", "Parker", "Ellis", "Morgan", "Shaw", "Grant", "Lane", "Cole"]
AGENCIES = ["Brightline Talent", "Northstar Creators", "Viral Ventures Mgmt", "Clutch Talent Group", None]

TRAVEL_NEEDS = [
    "Aisle seat. Checking one bag plus a camera case.",
    "Window seat, early flights preferred. Needs pickup at TPA arrivals.",
    "Traveling with a plus-one (manager). Book adjacent seats.",
    "Nervous flyer: nonstop only, please.",
    "Bringing ring light and tripod; needs an SUV for ground transport.",
    "Prefers evening arrival. TSA PreCheck number on file with agent.",
    "Needs wheelchair assistance through the airport.",
    "Carry-on only. Happy to take the crew shuttle.",
]
DRIVE_NEEDS = "Driving in from home; needs a parking pass at the hotel and set."
LODGING_NEEDS = [
    "King room, high floor, away from the elevator.",
    "Two queen beds (sharing with a plus-one).",
    "Accessible room with roll-in shower.",
    "Quiet room; films content late at night. Needs strong Wi-Fi.",
    "King room. Fridge for medication.",
    "Early check-in requested; arrives on a red-eye.",
    "Feather-free pillows (allergy).",
    "Standard king. Late checkout on departure day.",
]
OTHER_NEEDS = [
    "Vegan meals.",
    "Gluten-free.",
    "No pork.",
    "Nut allergy: carries an EpiPen.",
    "Needs a private space to change between shoots.",
    "",
    "",
    "",
]
NOTES = [
    "Very responsive by text; email goes through the agent.",
    "Asked about bringing their own lighting kit.",
    "Signed release form on file.",
    "Prefers call times after 10am.",
]


def slug(name):
    return "".join(ch for ch in name.lower() if ch.isalnum())


def tampa_time(day, hour, minute=0):
    return datetime.combine(day, time(hour, minute), tzinfo=TAMPA)


class Command(BaseCommand):
    help = (
        f"Fill the Influencer Roster with dummy contact details, needs and travel/lodging bookings at {HOTEL}. "
        "Only blank fields are filled, and bookings are only added for influencers who have none."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Overwrite every influencer's contact details and needs, and replace all travel and notes.",
        )

    @transaction.atomic
    def handle(self, *args, reset=False, **options):
        if not settings.DEBUG:
            raise CommandError("seed_influencers only runs with DJANGO_DEBUG on.")

        influencers = list(Influencer.objects.all())
        if not influencers:
            raise CommandError("The roster is empty. Add influencers (or run import_influencers) first.")

        today = timezone.localdate(timezone=TAMPA)
        booked = 0
        for index, influencer in enumerate(influencers):
            rng = random.Random(influencer.name)  # Same dummy data every run.
            city, airport, airline = LOCAL if index % 7 == 3 else rng.choice(HOMETOWNS)
            agent = f"{rng.choice(AGENT_FIRST)} {rng.choice(AGENT_LAST)}"
            agency = rng.choice(AGENCIES)
            values = {
                "platform": rng.choice(Influencer.Platform.values[:-1]),
                # 555-01xx numbers are reserved for fiction.
                "phone": f"(813) 555-01{index % 100:02d}",
                "email": f"{slug(influencer.name)}@example.com",
                "address": f"{rng.randint(100, 9899)} {rng.choice(STREETS)}, {city}",
                "agent_name": f"{agent} ({agency})" if agency else agent,
                "agent_phone": f"(323) 555-01{(index + 50) % 100:02d}",
                "agent_email": f"{agent.split()[0].lower()}@{slug(agency or agent)}.example.com",
                "travel_needs": DRIVE_NEEDS if airport is None else rng.choice(TRAVEL_NEEDS),
                "lodging_needs": f"Staying at {HOTEL}. {rng.choice(LODGING_NEEDS)}",
                "needs": rng.choice(OTHER_NEEDS),
            }
            for field, value in values.items():
                if reset or not getattr(influencer, field):
                    setattr(influencer, field, value)
            influencer.save()

            if reset:
                influencer.travel.all().delete()
                influencer.notes.all().delete()
            if not influencer.travel.exists():
                self._book(influencer, rng, today, index, airport, airline)
                booked += 1
            if not influencer.notes.exists() and rng.random() < 0.4:
                InfluencerNote.objects.create(influencer=influencer, body=rng.choice(NOTES))

        self.stdout.write(
            self.style.SUCCESS(f"Dummy details filled for {len(influencers)} influencers; {booked} given bookings.")
        )

    def _book(self, influencer, rng, today, index, airport, airline):
        # Stagger arrivals over the next two weeks; stays run 4 to 9 nights.
        arrive_day = today + timedelta(days=2 + index % 14)
        depart_day = arrive_day + timedelta(days=rng.randint(4, 9))
        code = "".join(rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))

        if airport:
            hour = rng.choice([8, 10, 12, 14, 16, 19])
            flight_in = tampa_time(arrive_day, hour, rng.choice([0, 15, 30, 45]))
            TravelArrangement.objects.create(
                influencer=influencer,
                kind=TravelArrangement.Kind.FLIGHT,
                provider=airline,
                reference=f"{rng.randint(100, 2999)}",
                confirmation=code,
                depart_location=airport,
                arrive_location="TPA",
                starts_at=flight_in - timedelta(hours=rng.randint(2, 5)),
                ends_at=flight_in,
            )
            TravelArrangement.objects.create(
                influencer=influencer,
                kind=TravelArrangement.Kind.GROUND,
                provider="Crew shuttle",
                depart_location="TPA arrivals, baggage claim",
                arrive_location=HOTEL,
                starts_at=flight_in + timedelta(minutes=30),
                notes="Driver will text on landing.",
            )
            flight_out = tampa_time(depart_day, rng.choice([9, 11, 13, 17]))
            TravelArrangement.objects.create(
                influencer=influencer,
                kind=TravelArrangement.Kind.FLIGHT,
                provider=airline,
                reference=f"{rng.randint(100, 2999)}",
                confirmation=code,
                depart_location="TPA",
                arrive_location=airport,
                starts_at=flight_out,
                ends_at=flight_out + timedelta(hours=rng.randint(2, 5)),
            )

        TravelArrangement.objects.create(
            influencer=influencer,
            kind=TravelArrangement.Kind.HOTEL,
            provider=HOTEL,
            reference=f"Room {rng.randint(2, 11)}{rng.randint(1, 40):02d}",
            confirmation=f"HH{rng.randint(10000000, 99999999)}",
            starts_at=tampa_time(arrive_day, 15),
            ends_at=tampa_time(depart_day, 11),
            notes=f"{HOTEL_ADDRESS}. Billed to the production master account.",
        )
