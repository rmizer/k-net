from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import Department, User
from announcements.models import Alert, Announcement
from core.models import ProductionSettings
from crewfinder.models import Tracker, TrackerPing
from documents.models import Document
from finance.models import AutoDraft, Deposit, Invoice, Paycheck, PaymentMethod, PayRate, Payment
from influencers.models import Influencer
from locations.models import Location
from schedule.models import Event, TimelineItem
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


def placeholder_pdf(title):
    """A one-page PDF that just says what the document is."""
    text = "".join(ch for ch in title if ch.isascii() and ch not in "\\()")
    stream = f"BT /F1 20 Tf 72 720 Td ({text}) Tj 0 -30 Td /F1 12 Tf (K-Net demo document) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf, offsets = b"%PDF-1.4\n", []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    xref = len(pdf)
    pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    pdf += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return pdf


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
                "First delete every @knet.test account and all announcements, alerts, tasks, events, "
                "timeline items, documents, locations, finance records and trackers. Production settings, "
                "departments and other accounts are kept."
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
        self._seed_director_tasks(users)
        self._seed_events(users, departments)
        self._seed_next_week(users, departments)
        self._seed_timeline(users)
        self._seed_documents(users)
        self._seed_locations(users)
        self._seed_finance(users)
        self._seed_trackers(users, production)

        self.stdout.write(self.style.SUCCESS(f"Demo data ready. Password for every account: {DEMO_PASSWORD}"))
        self.stdout.write(
            "Accounts: coachk@ and babes@ (Directors), rachel@ (Site Manager), jared@ (Assistant), "
            "jimmy@ (Staff) ... all @knet.test"
        )

    def _reset(self):
        for model in (Payment, Paycheck, PayRate, Invoice, AutoDraft, Deposit, PaymentMethod):
            model.objects.all().delete()
        for document in Document.objects.all():
            document.file.delete(save=False)
        for model in (Tracker, Event, TimelineItem, Task, Alert, Announcement, Document, Location):
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

    def _seed_timeline(self, users):
        """Project phases and milestones around this week's shoot."""
        if TimelineItem.objects.exists():
            return
        today = timezone.localdate()
        shoot_start = today - timedelta(days=today.weekday())  # Filming began this Monday.
        rows = [
            ("Influencer casting & contracts", -35, -8, "Final roster confirmed; release forms collected."),
            ("Pre-production", -28, -1, "Scripts, permits with Film Tampa Bay, vendor bookings, location scouts."),
            ("Travel & lodging booking", -14, 7, "Flights into TPA and rooms at Hilton Tampa Airport Westshore."),
            ("Crew arrives in Tampa", -2, -2, "Check-in at Hilton Tampa Airport Westshore."),
            ("Principal photography", 0, 25, "Scenes 1–40 across Stage A, Stage B and Tampa locations."),
            ("Influencers in residence", 8, 20, "Content shoots, Q&As and live shows."),
            ("Live show: Episode 1", 11, 11, ""),
            ("Live show: Episode 2", 18, 18, ""),
            ("Live show: Finale", 25, 25, ""),
            ("Wrap & load-out", 26, 28, "Return rentals, clear Stage A and B, crew departures."),
            ("Post-production", 29, 60, "Edit, color, sound mix and graphics."),
            ("Final delivery", 63, 63, "Deliver masters to the network."),
        ]
        for name, start, end, description in rows:
            TimelineItem.objects.create(
                name=name,
                start_date=shoot_start + timedelta(days=start),
                end_date=shoot_start + timedelta(days=end),
                description=description,
                created_by=users["coachk"],
            )

    def _seed_director_tasks(self, users):
        """Coach K's own list. Added by title, so re-running only fills in what's missing."""
        today = timezone.localdate()
        coach = users["coachk"]
        P, S = Task.Priority, Task.Status
        # (title, description, assigned by, due in days, priority, status)
        rows = [
            ("Approve influencer travel budget", "Flights into TPA and the Hilton room block for the residence weeks.",
             "jared", -1, P.HIGH, S.TODO),
            ("Review Film Tampa Bay permit for the Riverwalk shoot", "Scene 14 on Monday; permit needs a director's "
             "signature.", "babes", 0, P.HIGH, S.IN_PROGRESS),
            ("Review dailies from Scene 12", "Armature Works exterior. Notes to the Film Crew by end of day.",
             "babes", 1, P.NORMAL, S.TODO),
            ("Confirm Hilton room block extension", "Influencers in residence through Oct 18; hotel needs an answer.",
             "jared", 2, P.NORMAL, S.TODO),
            ("Sign off on Episode 1 run of show", "Live show Friday on Stage A.", "babes", 3, P.HIGH, S.TODO),
            ("Finalize live show host script", "", "babes", 4, P.NORMAL, S.IN_PROGRESS),
            ("Call the network about the finale air date", "", "coachk", 6, P.NORMAL, S.TODO),
            ("Approve post-production schedule", "Edit, color, sound mix and graphics through Nov 27.",
             "babes", 14, P.LOW, S.TODO),
            ("Sign catering contract with Puff 'n Stuff", "", "jared", -3, P.NORMAL, S.DONE),
        ]
        for title, description, assigned_by, due_in, priority, status in rows:
            Task.objects.get_or_create(
                title=title,
                assigned_to=coach,
                defaults={
                    "description": description,
                    "due_date": today + timedelta(days=due_in),
                    "priority": priority,
                    "status": status,
                    "created_by": users[assigned_by],
                },
            )

    def _seed_documents(self, users):
        """Paperwork and crew receipts, each with a placeholder one-page PDF."""
        if Document.objects.exists():
            return
        today = timezone.localdate()
        C, S = Document.Category, Document.Status
        # (title, category, uploader, notes, expires in days)
        paperwork = [
            ("General liability certificate", C.INSURANCE, "coachk", "$2M aggregate. Hillsborough County named as "
             "additional insured.", 180),
            ("Equipment insurance", C.INSURANCE, "coachk", "Covers Moving Picture Tampa rentals.", 120),
            ("Film Tampa Bay permit: Tampa Riverwalk", C.PERMIT, "jared", "Scene 14. Keep a copy on set.", 1),
            ("Film Tampa Bay permit: Ybor City, 7th Ave", C.PERMIT, "jared", "Content shoot with Big tim.", 4),
            ("Hilton Tampa Airport Westshore room block", C.CONTRACT, "jared", "Crew and influencer rooms "
             "through Oct 26.", None),
            ("Moving Picture Tampa rental agreement", C.CONTRACT, "babes", "Camera, grip and lighting package.", None),
            ("Shuttle van registration", C.VEHICLE, "jared", "Ford Transit, white. Kept in the glove box.", 210),
            ("Shuttle van insurance card", C.VEHICLE, "jared", "", 90),
            ("Invoice 4471: Puff 'n Stuff Catering", C.INVOICE, "babes", "Crew lunches, week 1. Net 15.", None),
            ("Per diem vouchers: week 1", C.VOUCHER, "jared", "Signed out to active crew.", None),
            ("Crew contact sheet", C.OTHER, "jared", "", None),
        ]
        for title, category, uploader, notes, expires_in in paperwork:
            self._add_document(
                title,
                users[uploader],
                category=category,
                notes=notes,
                expires_on=today + timedelta(days=expires_in) if expires_in is not None else None,
            )

        # (title, uploader, vendor, amount, days ago, status)
        receipts = [
            ("Gaff tape and zip ties", "jimmy", "The Home Depot", "46.18", 1, S.SUBMITTED),
            ("Water for base camp", "chris", "Walmart Supercenter", "23.40", 2, S.VIEWED),
            ("Fuel for the shuttle van", "ej", "Shell, W Kennedy Blvd", "61.07", 3, S.IN_PROCESS),
            ("Camera batteries", "kelly", "B&H Photo", "129.99", 5, S.PROCESSED),
            ("Rideshare from TPA", "jared", "Uber", "38.25", 0, S.SUBMITTED),
            ("Call sheet printing", "justin", "Office Depot", "17.80", 1, S.SUBMITTED),
        ]
        for title, uploader, vendor, amount, days_ago, status in receipts:
            receipt = self._add_document(
                title,
                users[uploader],
                category=C.RECEIPT,
                vendor=vendor,
                amount=Decimal(amount),
                purchase_date=today - timedelta(days=days_ago),
            )
            if status != S.SUBMITTED:
                receipt.set_status(status)
                receipt.save()

    def _add_document(self, title, uploader, **fields):
        document = Document(title=title, uploaded_by=uploader, **fields)
        slug = "".join(ch if ch.isalnum() else "-" for ch in title.lower()).strip("-")
        document.file.save(f"{slug[:60]}.pdf", ContentFile(placeholder_pdf(title)), save=False)
        document.save()
        return document

    def _seed_locations(self, users):
        """Where the production works and stays in Tampa. Coordinates are stored so seeding
        never needs the geocoding service."""
        if Location.objects.exists():
            return
        K = Location.Kind
        rows = [
            {
                "name": CREW_HOTEL,
                "kind": K.LODGING,
                "address": "2225 N Lois Ave, Tampa, FL 33607",
                "point": ("27.962494", "-82.512774"),
                "phone": "(813) 877-6688",
                "website": "https://www.hilton.com/en/hotels/tpaahhf-hilton-tampa-airport-westshore/",
                "notes": "Crew and influencer hotel. Room block under K-Net Production. Shuttle pickups at the "
                "main entrance.",
            },
            {
                "name": "Tampa International Airport (TPA)",
                "kind": K.AIRPORT,
                "address": "4100 George J Bean Pkwy, Tampa, FL 33607",
                "point": ("27.975470", "-82.533330"),
                "website": "https://www.tampaairport.com/",
                "notes": "Main airport for crew and influencer arrivals. Shuttle meets at baggage claim.",
            },
            {
                "name": "St. Pete–Clearwater International Airport (PIE)",
                "kind": K.AIRPORT,
                "address": "14700 Terminal Blvd, Clearwater, FL 33762",
                "point": ("27.909943", "-82.687718"),
                "website": "https://www.fly2pie.com/",
                "notes": "Some budget flights land here; allow 35 minutes to the hotel.",
            },
            {
                "name": "Production base: Stages A & B",
                "kind": K.PRODUCTION,
                "point": ("27.947520", "-82.458430"),
                "contact_name": "Jared (Logistics)",
                "notes": "Base camp, hospitality tent, wardrobe trailer and the Rooftop set. Crew parking in "
                "Lot C; get the gate code from Logistics.",
            },
            {
                "name": "Armature Works",
                "kind": K.SHOOTING,
                "address": "1910 N Ola Ave, Tampa, FL 33602",
                "point": ("27.961034", "-82.463749"),
                "notes": "Scene 12: exterior market.",
            },
            {
                "name": "Tampa Riverwalk",
                "kind": K.SHOOTING,
                "address": "Tampa Riverwalk, Tampa, FL",
                "point": ("27.941589", "-82.451025"),
                "notes": "Scene 14. Film Tampa Bay permit is in Documents; keep a copy on set.",
            },
            {
                "name": "Ybor City, 7th Ave",
                "kind": K.SHOOTING,
                "address": "E 7th Ave, Ybor City, Tampa, FL 33605",
                "point": ("27.960100", "-82.437000"),
                "notes": "Content shoot with Big tim; Saturday location scout.",
            },
            {
                "name": "Clearwater Beach (Pier 60)",
                "kind": K.SHOOTING,
                "address": "Pier 60, Clearwater Beach, FL 33767",
                "point": ("27.977213", "-82.828905"),
                "notes": "Scouted for beach scenes. About 40 minutes from base.",
            },
            {
                "name": "Tampa General Hospital",
                "kind": K.OTHER,
                "custom_type": "Hospital",
                "address": "1 Tampa General Circle, Tampa, FL 33606",
                "point": ("27.937501", "-82.458900"),
                "phone": "(813) 844-7000",
                "website": "https://www.tgh.org/",
                "notes": "Nearest major hospital. For emergencies, call 911.",
            },
        ]
        for row in rows:
            latitude, longitude = row.pop("point")
            Location.objects.create(
                **row, latitude=Decimal(latitude), longitude=Decimal(longitude), created_by=users["jared"]
            )

    def _seed_finance(self, users):
        """Payment methods, pay, invoices, drafts and deposits around this week's shoot."""
        if PaymentMethod.objects.exists():
            return
        today = timezone.localdate()
        monday = today - timedelta(days=today.weekday())  # Filming began this Monday.
        day = lambda offset: monday + timedelta(days=offset)  # noqa: E731
        M = PaymentMethod.Kind

        amex = PaymentMethod.objects.create(
            name="Production Amex", kind=M.CARD, institution="American Express", last_digits="31004", holder="Coach K"
        )
        operating = PaymentMethod.objects.create(
            name="Operating account", kind=M.BANK, institution="Chase", last_digits="2290", notes="Vendor payments."
        )
        payroll_account = PaymentMethod.objects.create(
            name="Payroll account", kind=M.BANK, institution="Chase", last_digits="7731", notes="Direct deposits only."
        )
        PaymentMethod.objects.create(
            name="Production PayPal", kind=M.DIGITAL, institution="PayPal", holder="Jared",
            notes="Small vendors and influencer per diems.",
        )

        # Pay rates: (person, unit, rate)
        rates = [
            ("coachk", "week", "4000"), ("babes", "week", "4000"), ("jared", "day", "450"),
            ("jimmy", "day", "375"), ("brandon", "day", "375"), ("kelly", "day", "375"),
            ("chris", "day", "300"), ("adam", "day", "300"), ("justin", "day", "300"),
            ("ej", "day", "400"), ("joseph", "day", "400"), ("kirk", "day", "400"),
        ]
        for person, unit, rate in rates:
            PayRate.objects.create(person=users[person], unit=unit, rate=Decimal(rate))

        # Paid the Friday after each Monday-Sunday period: prep week is paid, this week is scheduled.
        for person, unit, rate in rates:
            user = users[person]
            quantity = Decimal("1") if unit == "week" else Decimal("5")
            for start, pay_date, paid in ((day(-7), day(4), True), (day(0), day(11), False)):
                paycheck = Paycheck.objects.create(
                    person=user, period_start=start, period_end=start + timedelta(days=6), pay_date=pay_date,
                    unit=unit, quantity=quantity, rate=Decimal(rate), payment_method=payroll_account,
                )
                if paid:
                    paycheck.status, paycheck.paid_on = Paycheck.Status.PAID, pay_date
                    paycheck.save()
                    Payment.objects.create(
                        paid_on=pay_date, payee=user.get_full_name(), amount=paycheck.total, kind=Payment.Kind.PAYROLL,
                        description=f"Pay for {start:%b} {start.day} to {start + timedelta(days=6):%b} "
                        f"{(start + timedelta(days=6)).day}",
                        payment_method=payroll_account, paycheck=paycheck, created_by=users["jared"],
                    )
                elif person == "kelly":
                    # Kelly's processed receipt rides on this week's check.
                    paycheck.receipts.set(
                        Document.objects.filter(uploaded_by=user, status=Document.Status.PROCESSED)
                    )

        # Invoices: (vendor, number, amount, issued, due, status, paid on, archived, description)
        catering = Document.objects.filter(category=Document.Category.INVOICE, title__startswith="Invoice 4471").first()
        invoices = [
            ("Hilton Tampa Airport Westshore", "HT-30881", "12600.00", -14, -4, "paid", -5, False,
             "Room block deposit, crew and influencers."),
            ("Film Tampa Bay", "FTB-1187", "250.00", -12, -2, "paid", -3, False, "Permit fees: Riverwalk, Ybor City."),
            ("Sunbelt Rentals", "SR-55120", "1180.00", -9, 3, "unpaid", None, False,
             "Generator and cooling, week 1."),
            ("Sunbelt Rentals", "SR-54988", "640.00", -16, -3, "unpaid", None, False, "Light towers, prep week."),
            ("Moving Picture Tampa", "MPT-2219", "6450.00", 0, 7, "scheduled", None, False,
             "Camera, grip and lighting package, week 1."),
            ("Puff 'n Stuff Catering", "4471", "1846.00", 4, 19, "unpaid", None, False, "Crew lunches, week 1."),
            ("Enterprise Truck Rental", "ET-77310", "420.00", -20, -10, "paid", -11, True, "Scout van, 2 days."),
        ]
        for vendor, number, amount, issued, due, status, paid, archived, description in invoices:
            invoice = Invoice.objects.create(
                vendor=vendor, number=number, amount=Decimal(amount), issued_on=day(issued), due_on=day(due),
                status=status, paid_on=day(paid) if paid is not None else None, archived=archived,
                description=description, payment_method=operating, created_by=users["babes"],
                document=catering if number == "4471" else None,
            )
            if status == "paid":
                Payment.objects.create(
                    paid_on=invoice.paid_on, payee=vendor, amount=invoice.amount, kind=Payment.Kind.VENDOR,
                    description=f"Invoice {number}", reference=f"ACH {number[-4:]}", payment_method=operating,
                    invoice=invoice, created_by=users["babes"],
                )

        # Auto drafts: (payee, description, amount, frequency, next in days, method)
        drafts = [
            ("Production insurance carrier", "General liability premium", "1250.00", "monthly", 11, amex),
            ("Equipment insurance carrier", "Rental equipment coverage", "380.00", "monthly", 16, amex),
            ("Cloud storage", "Dailies backup, 20 TB", "199.00", "monthly", 8, amex),
            ("Fleet lease", "Shuttle van", "650.00", "biweekly", 12, operating),
        ]
        for payee, description, amount, frequency, next_in, method in drafts:
            draft = AutoDraft.objects.create(
                payee=payee, description=description, amount=Decimal(amount), frequency=frequency,
                next_on=day(next_in), payment_method=method,
            )
            Payment.objects.create(
                paid_on=day(next_in - (14 if frequency == "biweekly" else 30)), payee=payee, amount=draft.amount,
                kind=Payment.Kind.DRAFT, description=description, payment_method=method, auto_draft=draft,
            )

        Payment.objects.create(
            paid_on=day(1), payee="The Home Depot", amount=Decimal("212.64"), kind=Payment.Kind.OTHER,
            description="Expendables for Stage B", payment_method=amex, created_by=users["jared"],
        )

        # Incoming: (days, source, amount, description, into)
        deposits = [
            (-27, "Network", "250000.00", "Production installment 1 of 3", operating),
            (-13, "Brand partner", "25000.00", "Sponsorship, live show integration", operating),
            (3, "Network", "150000.00", "Production installment 2 of 3", operating),
            (-1, "Moving Picture Tampa", "500.00", "Refund: prep-week equipment deposit", operating),
        ]
        for offset, source, amount, description, into in deposits:
            Deposit.objects.create(
                received_on=day(offset), source=source, amount=Decimal(amount), description=description,
                deposited_into=into, created_by=users["babes"],
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
