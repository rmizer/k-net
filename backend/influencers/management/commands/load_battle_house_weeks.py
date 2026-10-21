import random

from django.core.management.base import BaseCommand
from django.db import transaction

from influencers.management.commands.seed_influencers import (
    AGENCIES,
    AGENT_FIRST,
    AGENT_LAST,
    HOMETOWNS,
    OTHER_NEEDS,
    STREETS,
    TRAVEL_NEEDS,
    slug,
)
from influencers.models import Influencer
from shows.models import Show

SHOW_NAME = "Battle House Live"
SHOW_DEFAULTS = {
    "description": "Live-streamed influencer competition: creators live together in the mansion, take on "
    "challenges, and fans vote every week.",
    "status": Show.Status.PRODUCTION,
    "seasons": 1,
    "shooting_location": "Miami, FL",
}
SEASON = 1

# Who was in the mansion each week of season 1: week 1 from the original vote
# standings, weeks 2 and 3 from the show's voting pages. Anyone on more than one
# list is placed in their latest week.
WEEKS = {
    1: [
        "Nigerian_nupe", "Jay Borbon", "Wuanof1", "Gordo Loco", "King Quran", "StillAngiie",
        "Luckless Holly", "Ashwitdafin", "Queen Cheryl", "Monica Baez", "Thecountryascornbread", "Dreybaby",
    ],
    2: [
        "Nilla", "Big tim", "Tommy2Coats", "Gordo Loco", "Kayceewins", "Bethany Mals", "thedrezshow",
        "Cyberlivehq", "John Conner", "Bigguyjon", "Gus Smyrnios", "Amanda Frances", "Madi Jo", "Young_rum",
    ],
    3: [
        "Jessicadimon", "Sunny Christina", "Caleb_runkle", "Natasha Ball", "Drewfilmedit", "Charity",
        "JaeArsenal", "Im_loving_cj", "Mariah", "QT Claps", "Whitneywren1", "Preston Viltz", "Rockyofficiallive",
    ],
}  # fmt: skip


def dummy_details(name, number):
    """Made-up contact details for a new influencer, like seed_influencers gives."""
    rng = random.Random(name)
    city = rng.choice(HOMETOWNS)[0]
    agent = f"{rng.choice(AGENT_FIRST)} {rng.choice(AGENT_LAST)}"
    agency = rng.choice(AGENCIES)
    return {
        "platform": rng.choice(Influencer.Platform.values[:-1]),
        # 555-01xx numbers are reserved for fiction.
        "phone": f"(813) 555-01{number % 100:02d}",
        "email": f"{slug(name)}@example.com",
        "address": f"{rng.randint(100, 9899)} {rng.choice(STREETS)}, {city}",
        "agent_name": f"{agent} ({agency})" if agency else agent,
        "agent_phone": f"(323) 555-01{(number + 50) % 100:02d}",
        "agent_email": f"{agent.split()[0].lower()}@{slug(agency or agent)}.example.com",
        "travel_needs": rng.choice(TRAVEL_NEEDS),
        "needs": rng.choice(OTHER_NEEDS),
    }


class Command(BaseCommand):
    help = (
        f"Put every {SHOW_NAME} influencer on the show in their latest week of season {SEASON}, creating the "
        "show and any missing influencers (with dummy details). Safe to run more than once."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without saving.")

    @transaction.atomic
    def handle(self, *args, dry_run=False, **options):
        show, created = Show.objects.get_or_create(name=SHOW_NAME, defaults=SHOW_DEFAULTS)
        if created:
            self.stdout.write(f"Created the show {SHOW_NAME}.")

        latest_week = {}
        for week, names in sorted(WEEKS.items()):
            for name in names:
                latest_week[name] = week

        added = moved = 0
        for name, week in latest_week.items():
            influencer = Influencer.objects.filter(name__iexact=name).first()
            if influencer is None:
                influencer = Influencer(name=name, **dummy_details(name, Influencer.objects.count()))
                self.stdout.write(f"Add {name} (week {week}), with dummy contact details.")
                added += 1
            elif (influencer.show_id, influencer.season, influencer.week) != (show.pk, SEASON, week):
                self.stdout.write(f"{name}: week {week}")
                moved += 1
            else:
                continue
            influencer.show, influencer.season, influencer.week = show, SEASON, week
            influencer.save()

        others = Influencer.objects.exclude(name__in=latest_week).filter(show__isnull=True)
        for influencer in others:
            self.stdout.write(self.style.WARNING(f"Not on any week's list, left as is: {influencer.name}"))

        if dry_run:
            transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING("Dry run: nothing was saved."))
        else:
            self.stdout.write(self.style.SUCCESS(f"{SHOW_NAME}: {added} influencers added, {moved} updated."))
