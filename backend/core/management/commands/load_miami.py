import re
from decimal import Decimal
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction

from core.management.commands.seed_demo import placeholder_pdf
from documents.models import Document
from locations.models import Location
from resources.models import Resource

C = Resource.Category
K = Location.Kind

# Miami-area vendors and services, from the businesses' and agencies' own websites
# where possible (checked October 2026). Confirm details before booking.
MIAMI_RESOURCES = [
    {
        "company_name": "Le Food Catering",
        "category": C.CATERING,
        "phone": "(305) 396-8770",
        "address": "5600 NW 7th Ave, Miami, FL 33127",
        "notes": "Film and photo shoot catering, from boxed lunches to full-service stations. Vegan, "
        "gluten-free and nut-free options. Details are from a directory listing; confirm before booking.",
    },
    {
        "company_name": "Moving Picture Miami",
        "category": C.EQUIPMENT,
        "phone": "(305) 522-1361",
        "email": "info@movingpicture.com",
        "website": "https://movingpicture.com/miami/",
        "address": "400 NW 26th St, Suite 100, Miami, FL 33127",
        "notes": "Camera, grip and lighting rentals, grip trucks, production supplies and crews. In Wynwood.",
    },
    {
        "company_name": "Sunbelt Rentals – Miami Gardens",
        "category": C.RENTALS,
        "phone": "(786) 878-5605",
        "website": "https://www.sunbeltrentals.com/locations/1126",
        "address": "16513 NW 8th Ave, Miami Gardens, FL 33169",
        "notes": "Cooling/HVAC, dehumidifiers and general equipment. Mon–Fri 7am–5pm. 24-hour emergency "
        "line: (800) 892-8677. Ask which branch has generators and lifts in stock.",
    },
    {
        "company_name": "BoatRentals.Miami (American WaterSports)",
        "category": C.RENTALS,
        "phone": "(754) 226-0473",
        "email": "info@boatrentals.miami",
        "website": "https://boatrentals.miami/",
        "address": "300 Alton Rd, Pier E, Miami Beach, FL 33139",
        "notes": "Boat and yacht rentals at Miami Beach Marina. Pontoons, speed boats and center consoles, "
        "self-driven or with a licensed captain, 2–8 hours or multi-day. Yacht charters from 34' to 166' "
        "with captain and crew.",
    },
    {
        "company_name": "Aquarius Boat Rental & Tours",
        "category": C.RENTALS,
        "phone": "(786) 636-1008",
        "email": "info@aquariusboattours.com",
        "website": "https://aquariusboattours.com/",
        "address": "518 West Ave, Miami Beach, FL 33139",
        "notes": "Boat and yacht rentals from 20' to 37', including captained yachts for up to 13 people.",
    },
    {
        "company_name": "Miami Beach Marina",
        "category": C.RENTALS,
        "phone": "(305) 673-6000",
        "address": "300 Alton Rd, Miami Beach, FL 33139",
        "notes": "South Beach marina; several boat rental and yacht charter companies sail from here. Marina "
        "office 7am–7pm. VHF 16.",
    },
    {
        "company_name": "Miami International Airport (MIA)",
        "category": C.TRANSPORTATION,
        "phone": "(305) 876-7000",
        "website": "https://www.miami-airport.com/",
        "address": "4200 NW 21st St, Miami, FL 33122",
        "notes": "Main airport line. Toll-free: 1-800-TALK-MIA (800-825-5642). Rental car center is on site.",
    },
    {
        "company_name": "Fort Lauderdale-Hollywood International Airport (FLL)",
        "category": C.TRANSPORTATION,
        "phone": "(866) 435-9355",
        "website": "https://www.broward.org/airport",
        "address": "100 Terminal Dr, Fort Lauderdale, FL 33315",
        "notes": "Customer information line (1-866-I-FLY-FLL). Some budget flights land here; about 30 miles "
        "north of downtown Miami.",
    },
    {
        "company_name": "Florida Power & Light (FPL)",
        "category": C.UTILITIES,
        "phone": "(888) 988-8249",
        "website": "https://www.fpl.com/contact.html",
        "notes": "Customer service Mon–Fri 8am–7pm, Sat 9am–5pm. Outages: (800) 468-8243, any time. Downed "
        "power line: call 911 first.",
    },
    {
        "company_name": "Miami-Dade Water and Sewer Department",
        "category": C.UTILITIES,
        "phone": "(305) 665-7477",
        "website": "https://www.miamidade.gov/global/water/contact-water-sewer.page",
        "notes": "Customer Care Center, Mon–Fri 8am–7pm. After hours and emergencies: (305) 274-9272, 24 hours.",
    },
    {
        "company_name": "The Home Depot – Miami Calle Ocho (#0277)",
        "category": C.STORES,
        "phone": "(305) 643-8801",
        "website": "https://www.homedepot.com/l/Miami-Calle-Ocho/FL/Miami/33135/277",
        "address": "3030 SW 8th St, Miami, FL 33135",
        "notes": "Pro Service Desk number above. Tool Rental Center: (305) 643-8800. Mon–Sat 6am–11pm, "
        "Sun 7am–8pm.",
    },
    {
        "company_name": "Walmart Supercenter – Coral Way",
        "category": C.STORES,
        "phone": "(305) 351-0725",
        "address": "8400 Coral Way, Miami, FL 33155",
        "notes": "Groceries, craft services supplies and general merchandise. Open until 11pm.",
    },
    {
        "company_name": "City of Miami Film Office",
        "category": C.PERMITS,
        "phone": "(305) 416-1337",
        "email": "filmoffice@miamigov.com",
        "website": "https://www.miami.gov/Permits-Construction/Filming-and-Events/Get-a-Film-Permit",
        "notes": "Permits for filming in the City of Miami only. Apply at least 3 business days ahead, or 7 "
        "with street closures.",
    },
    {
        "company_name": "Miami-Dade County Office of Film and Entertainment",
        "category": C.PERMITS,
        "phone": "(305) 375-3288",
        "website": "https://www.filmiami.org/",
        "notes": "Permits for unincorporated Miami-Dade and county property (parks, the airport, schools, "
        "transit), even inside the cities. Phone is from older listings; confirm it.",
    },
    {
        "company_name": "Miami Beach Film & Print Office",
        "category": C.PERMITS,
        "phone": "(305) 673-7070",
        "website": "https://www.miamibeachfl.gov/city-hall/tourism-culture/film-print/",
        "notes": "Permits for filming in Miami Beach.",
    },
    {
        "company_name": "Jackson Memorial Hospital",
        "category": C.MEDICAL,
        "phone": "(305) 585-1111",
        "website": "https://jacksonhealth.org/",
        "address": "1611 NW 12th Ave, Miami, FL 33136",
        "notes": "Main hospital line. 24/7 emergency room and the Ryder Trauma Center. For emergencies call 911.",
    },
    {
        "company_name": "Miami-Dade Sheriff's Office (non-emergency)",
        "category": C.MEDICAL,
        "phone": "(305) 743-7433",
        "website": "https://www.miamidade.gov/global/police/contact-police.page",
        "notes": "Non-emergency line (305-SHERIFF). For emergencies call 911.",
    },
]

MIAMI_LOCATIONS = [
    {
        "name": "Miami International Airport (MIA)",
        "kind": K.AIRPORT,
        "address": "4200 NW 21st St, Miami, FL 33122",
        "latitude": Decimal("25.795900"),
        "longitude": Decimal("-80.287100"),
        "phone": "(305) 876-7000",
        "website": "https://www.miami-airport.com/",
        "notes": "Main airport for crew and influencer arrivals. The address is the airport entrance, for GPS.",
    },
    {
        "name": "Fort Lauderdale-Hollywood International Airport (FLL)",
        "kind": K.AIRPORT,
        "address": "100 Terminal Dr, Fort Lauderdale, FL 33315",
        "latitude": Decimal("26.072600"),
        "longitude": Decimal("-80.152700"),
        "phone": "(866) 435-9355",
        "website": "https://www.broward.org/airport",
        "notes": "Some budget flights land here; about 30 miles north of downtown Miami.",
    },
    {
        "name": "Jackson Memorial Hospital",
        "kind": K.OTHER,
        "custom_type": "Hospital",
        "address": "1611 NW 12th Ave, Miami, FL 33136",
        "latitude": Decimal("25.790600"),
        "longitude": Decimal("-80.212500"),
        "phone": "(305) 585-1111",
        "website": "https://jacksonhealth.org/",
        "notes": "24/7 emergency room and the Ryder Trauma Center. For emergencies, call 911.",
    },
]

# The trial's example documents, by title (an "Example: " prefix is kept).
# old title -> (new title, {old notes text: new notes text})
DOCUMENT_CHANGES = {
    "Film Tampa Bay permit: Tampa Riverwalk": (
        "City of Miami film permit",
        {"Scene 14. Keep a copy on set.": "Shooting location to be confirmed. Keep a copy on set."},
    ),
    "Film Tampa Bay permit: Ybor City, 7th Ave": ("Miami-Dade County film permit", {}),
    "Hilton Tampa Airport Westshore room block": (
        "Crew hotel room block",
        {"Crew and influencer rooms through Oct 26.": "Miami crew hotel to be confirmed."},
    ),
    "Moving Picture Tampa rental agreement": ("Moving Picture Miami rental agreement", {}),
    "Invoice 4471: Puff 'n Stuff Catering": ("Invoice 4471: Le Food Catering", {}),
    "Rideshare from TPA": ("Rideshare from MIA", {}),
}
NOTE_CHANGES = {"Hillsborough County": "Miami-Dade County", "Moving Picture Tampa": "Moving Picture Miami"}
VENDOR_CHANGES = {"Shell, W Kennedy Blvd": "Shell"}

TAMPA_WORDS = re.compile(
    r"\b(tampa|clearwater|st\.? pete(rsburg)?|pinellas|ybor|hillsborough|westshore|teco)\b", re.IGNORECASE
)
# Tampa vendors from the old list whose entries don't mention the area.
TAMPA_RESOURCE_NAMES = {"Fiesta Solutions Event Rentals"}


def in_tampa_bay(location):
    if location.latitude is None or location.longitude is None:
        return False
    return 27.3 <= location.latitude <= 28.4 and -83.0 <= location.longitude <= -82.0


class Command(BaseCommand):
    help = "Add Miami-area locations and vendors and point the example documents at Miami (safe to run again)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--remove-tampa",
            action="store_true",
            help="Also delete Tampa-area locations and resources.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without saving anything.",
        )

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        with transaction.atomic():
            if options["remove_tampa"]:
                self._remove_tampa()
            self._load(Resource, "company_name", MIAMI_RESOURCES, {"contact_name": "", "email": "", "website": "",
                                                                    "address": ""})
            self._load(Location, "name", MIAMI_LOCATIONS, {"custom_type": "", "phone": "", "website": "",
                                                            "contact_name": ""})
            self._update_documents()
            if self.dry_run:
                transaction.set_rollback(True)
        self.stdout.write(self.style.WARNING("Dry run: nothing was saved.") if self.dry_run
                          else self.style.SUCCESS("Miami data loaded."))

    def _remove_tampa(self):
        for location in Location.objects.all():
            if TAMPA_WORDS.search(f"{location.name} {location.address}") or in_tampa_bay(location):
                self.stdout.write(f"Remove location: {location.name}")
                location.delete()
        for resource in Resource.objects.all():
            text = f"{resource.company_name} {resource.address} {resource.notes}"
            if resource.company_name in TAMPA_RESOURCE_NAMES or TAMPA_WORDS.search(text):
                self.stdout.write(f"Remove resource: {resource.company_name}")
                resource.delete()

    def _load(self, model, key, entries, blanks):
        created = updated = 0
        for entry in entries:
            fields = {**blanks, **entry}
            _, was_created = model.objects.update_or_create(**{key: fields.pop(key)}, defaults=fields)
            created += was_created
            updated += not was_created
        label = model._meta.verbose_name_plural
        self.stdout.write(f"Miami {label}: {created} added, {updated} updated.")

    def _update_documents(self):
        for document in Document.objects.all():
            prefix = "Example: " if document.title.startswith("Example: ") else ""
            title, notes, vendor = document.title, document.notes, document.vendor
            change = DOCUMENT_CHANGES.get(title.removeprefix(prefix))
            if change:
                title = prefix + change[0]
                for old, new in change[1].items():
                    notes = notes.replace(old, new)
            for old, new in NOTE_CHANGES.items():
                notes = notes.replace(old, new)
            vendor = VENDOR_CHANGES.get(vendor, vendor)
            if (title, notes, vendor) == (document.title, document.notes, document.vendor):
                if TAMPA_WORDS.search(f"{title} {notes} {vendor}"):
                    self.stdout.write(self.style.WARNING(f"Still mentions Tampa, check by hand: {title}"))
                continue
            self.stdout.write(f"Update document: {document.title} -> {title}")
            if title != document.title and not self.dry_run:
                self._redraw_placeholder(document, title.removeprefix(prefix))
            document.title, document.notes, document.vendor = title, notes, vendor
            document.save()

    def _redraw_placeholder(self, document, title):
        """Example documents carry a one-page PDF naming the document; redraw it under
        the new name. Real uploads are left alone."""
        try:
            with document.file.open("rb") as file:
                is_placeholder = b"K-Net demo document" in file.read(2048)
        except (FileNotFoundError, ValueError):
            return
        if not is_placeholder:
            return
        old = document.file.name
        slug = "".join(ch if ch.isalnum() else "-" for ch in title.lower()).strip("-")
        document.file.save(f"{slug[:60]}.pdf", ContentFile(placeholder_pdf(title)), save=False)
        if Path(old).name != Path(document.file.name).name:
            document.file.storage.delete(old)
