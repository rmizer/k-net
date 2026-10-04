from django.core.management.base import BaseCommand

from resources.models import Resource

C = Resource.Category

# Tampa-area vendors and services, from the businesses' own websites and public
# listings (checked October 2026). Confirm details before booking.
TAMPA_RESOURCES = [
    {
        "company_name": "Puff 'n Stuff Catering",
        "category": C.CATERING,
        "phone": "(813) 324-4060",
        "address": "5804 E Columbus Dr, Tampa, FL 33619",
        "notes": "Full-service catering: on-site service or drop-off, from crew lunches to large events.",
    },
    {
        "company_name": "Moving Picture Tampa",
        "category": C.EQUIPMENT,
        "phone": "(813) 296-2737",
        "email": "info@movingpicture.com",
        "website": "https://movingpicture.com/moving-picture-tampa/",
        "address": "5101 N Rome Ave, Tampa, FL 33603",
        "notes": "Camera, grip and lighting rentals, production supplies, crews and production services.",
    },
    {
        "company_name": "First Unit Production Services",
        "category": C.EQUIPMENT,
        "phone": "(727) 522-1925",
        "address": "6543 46th St N, Suite 1104, Pinellas Park, FL 33781",
        "notes": "Lighting and grip rental (HMI, LED, tungsten), generators, dollies, jib arms, rigging and "
        "expendables. Serves Tampa/St. Pete.",
    },
    {
        "company_name": "Sunbelt Rentals – Power & HVAC",
        "category": C.RENTALS,
        "phone": "(813) 247-4800",
        "website": "https://www.sunbeltrentals.com/",
        "address": "8417 Palm River Rd, Tampa, FL 33619",
        "notes": "Generators, temporary power distribution and portable cooling/HVAC. Mon–Fri 7am–5pm.",
    },
    {
        "company_name": "Sunbelt Rentals – Aerial Work Equipment",
        "category": C.RENTALS,
        "phone": "(813) 769-7373",
        "website": "https://www.sunbeltrentals.com/",
        "address": "7520 US Highway 301 N, Tampa, FL 33637",
        "notes": "Scissor lifts, boom lifts and other aerial work platforms.",
    },
    {
        "company_name": "Tailored Thrones Management",
        "category": C.RENTALS,
        "phone": "(941) 227-4434",
        "address": "3030 N Rocky Point Dr, Suite 150A, Tampa, FL 33607",
        "notes": "Restroom trailers with flushing toilets, hot running water and A/C.",
    },
    {
        "company_name": "Fiesta Solutions Event Rentals",
        "category": C.RENTALS,
        "phone": "(813) 506-4036",
        "notes": "Event rentals including tents, audio-visual equipment and restroom trailers.",
    },
    {
        "company_name": "Hartford Technology Rentals",
        "category": C.TECHNICAL,
        "phone": "(888) 520-5667",
        "website": "https://hartfordrents.com/locations/tampa-fl-audio-rental/",
        "notes": "Sound systems, wireless microphones and AV gear by the day, week or month. Serves Tampa "
        "from its East Coast distribution center.",
    },
    {
        "company_name": "Alora Transportation",
        "category": C.TRANSPORTATION,
        "phone": "(813) 314-0000",
        "address": "4810 N Hale Ave, Tampa, FL 33614",
        "notes": "Airport shuttles, Mercedes Sprinter vans and charter buses.",
    },
    {
        "company_name": "Tampa International Airport (TPA)",
        "category": C.TRANSPORTATION,
        "phone": "(813) 870-8700",
        "address": "4200 George J. Bean Pkwy, Tampa, FL 33607",
        "notes": "Main airport line. Rental car center is on site.",
    },
    {
        "company_name": "Tampa Electric (TECO)",
        "category": C.UTILITIES,
        "phone": "(866) 832-6249",
        "website": "https://www.tampaelectric.com/contact/",
        "notes": "Business/commercial service line, Mon–Fri 7:30am–6pm. Outages: (877) 588-1010. Downed "
        "power line: call 911 first.",
    },
    {
        "company_name": "City of Tampa Water Department",
        "category": C.UTILITIES,
        "phone": "(813) 274-8811",
        "website": "https://www.tampa.gov/water",
        "notes": "Utilities Call Center, Mon–Fri 8am–5pm. After hours, weekends and holidays: (813) 274-7400.",
    },
    {
        "company_name": "The Home Depot – Stadium (#0256)",
        "category": C.STORES,
        "phone": "(813) 878-1350",
        "website": "https://www.homedepot.com/l/Stadium/FL/Tampa/33607/256",
        "address": "1712 N Dale Mabry Hwy, Tampa, FL 33607",
        "notes": "Pro Service Desk number above. Tool Rental Center: (813) 878-1340. Mon–Sat 6am–10pm, "
        "Sun 8am–8pm.",
    },
    {
        "company_name": "Walmart Supercenter – N Dale Mabry",
        "category": C.STORES,
        "phone": "(813) 872-6992",
        "address": "1505 N Dale Mabry Hwy, Tampa, FL 33607",
        "notes": "Groceries, craft services supplies and general merchandise. Open daily 6am–11pm.",
    },
    {
        "company_name": "Film Tampa Bay",
        "category": C.PERMITS,
        "contact_name": "Permitting office",
        "phone": "(813) 218-3304",
        "website": "https://www.visittampabay.com/about/film/",
        "address": "201 N Franklin St, Suite 2900, Tampa, FL 33602",
        "notes": "Hillsborough County film commission. One permit process for filming on public property in "
        "Hillsborough County, Tampa, Plant City and Temple Terrace.",
    },
    {
        "company_name": "Tampa General Hospital",
        "category": C.MEDICAL,
        "phone": "(813) 844-7000",
        "website": "https://www.tgh.org/",
        "address": "1 Tampa General Circle, Tampa, FL 33606",
        "notes": "Main hospital line. On Davis Islands. For emergencies call 911.",
    },
    {
        "company_name": "Tampa Police Department (non-emergency)",
        "category": C.MEDICAL,
        "phone": "(813) 231-6130",
        "notes": "Non-emergency line. For emergencies call 911.",
    },
    {
        "company_name": "Hilton Tampa Airport Westshore",
        "category": C.LODGING,
        "phone": "(813) 877-6688",
        "website": "https://www.hilton.com/en/hotels/tpaahhf-hilton-tampa-airport-westshore/",
        "address": "2225 N Lois Ave, Tampa, FL 33607",
        "notes": "Crew and influencer hotel. Near Tampa International Airport (TPA) and the Westshore "
        "district. Hilton reservations: 1-800-HILTONS.",
    },
]


class Command(BaseCommand):
    help = "Add Tampa-area vendors and services to the Resources Directory (safe to run more than once)."

    def handle(self, *args, **options):
        created = updated = 0
        for entry in TAMPA_RESOURCES:
            fields = {"contact_name": "", "email": "", "website": "", "address": "", **entry}
            _, was_created = Resource.objects.update_or_create(
                company_name=fields.pop("company_name"), defaults=fields
            )
            if was_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"Tampa resources loaded: {created} added, {updated} updated."))
