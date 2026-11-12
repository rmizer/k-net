"""Loads the sample data (core/sample_data/sample_data.json) so a site shows the
newer pages filled in: the Human Resources and Runners departments, a sample HR
person and runner, the Sarasota production office, sample challenges, the
inventory and the vehicles.

Records are matched by name (or email), so running it again only adds what's
missing. --update also brings existing sample records back in line with the file.
Links are looked up by name, email or title; anything that isn't on this site
(say, a receipt) is left blank and reported.

    python manage.py load_sample_data [--update]
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Department, User
from challenges.models import Challenge, SupplyItem
from documents.models import Document
from inventory.models import InventoryItem
from locations.models import Location
from shows.models import Show
from vehicles.models import Vehicle

DATA_FILE = Path(__file__).resolve().parents[2] / "sample_data" / "sample_data.json"
OWNER_EMAIL = "support.knet@gmail.com"


class Command(BaseCommand):
    help = "Adds the sample departments, people, office, challenges, inventory and vehicles."

    def add_arguments(self, parser):
        parser.add_argument("--update", action="store_true", help="Also update sample records that already exist.")

    @transaction.atomic
    def handle(self, *args, update=False, **options):
        self.update = update
        self.missing = []
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        self.owner = User.objects.filter(email=OWNER_EMAIL).first()

        for row in data["departments"]:
            self.save(Department, {"name": row["name"]}, {"page": row["page"]}, "departments")
        for row in data["locations"]:
            self.save(Location, {"name": row["name"]}, {**self.without(row, "name"), "created_by": self.owner}, "locations")
        for row in data["people"]:
            self.save_person(row)
        for row in data["challenges"]:
            self.save_challenge(row)
        for row in data["inventory"]:
            fields = {
                **self.without(row, "name", "department", "receipt"),
                "receipt": self.receipt(row["receipt"]),
                "created_by": self.owner,
            }
            self.save(
                InventoryItem,
                {"name": row["name"], "department": self.department(row["department"]), "deleted_at": None},
                fields,
                "inventory",
            )
        for row in data["vehicles"]:
            self.save_vehicle(row)

        for model_label, counts in self.counts.items():
            self.stdout.write(f"{model_label}: {counts['added']} added, {counts['updated']} updated, {counts['kept']} already there")
        for note in self.missing:
            self.stdout.write(self.style.WARNING(f"Not on this site, left blank: {note}"))

    # Saving

    @property
    def counts(self):
        if not hasattr(self, "_counts"):
            self._counts = {}
        return self._counts

    def tally(self, label, outcome):
        self.counts.setdefault(label, {"added": 0, "updated": 0, "kept": 0})[outcome] += 1

    def save(self, model, lookup, fields, label):
        obj = model.objects.filter(**lookup).first()
        if obj is None:
            obj = model.objects.create(**lookup, **fields)
            self.tally(label, "added")
            return obj, True
        if self.update:
            for name, value in fields.items():
                if name != "created_by":
                    setattr(obj, name, value)
            obj.save()
            self.tally(label, "updated")
        else:
            self.tally(label, "kept")
        return obj, False

    def save_person(self, row):
        fields = {
            **self.without(row, "email", "department", "head_of_department"),
            "department": self.department(row["department"]),
            "head_of_department": self.department(row["head_of_department"]),
        }
        person, created = self.save(User, {"email": row["email"]}, fields, "people")
        if created:
            # Sample people can't log in.
            person.set_unusable_password()
            person.save(update_fields=["password"])

    def save_challenge(self, row):
        fields = {
            **self.without(row, "name", "date", "show", "cleanup_owner", "supplies"),
            "show": Show.objects.filter(name=row["show"]).first() if row["show"] else None,
            "cleanup_owner": self.person(row["cleanup_owner"]),
            "created_by": self.owner,
        }
        challenge, created = self.save(Challenge, {"name": row["name"], "date": row["date"]}, fields, "challenges")
        if created or self.update:
            challenge.supplies.all().delete()
            SupplyItem.objects.bulk_create(SupplyItem(challenge=challenge, **supply) for supply in row["supplies"])

    def save_vehicle(self, row):
        fields = {
            **self.without(row, "name", "driver", "documents"),
            "driver": self.person(row["driver"]),
            "created_by": self.owner,
        }
        vehicle, created = self.save(Vehicle, {"name": row["name"]}, fields, "vehicles")
        if created or self.update:
            vehicle.documents.set(filter(None, (self.document(title) for title in row["documents"])))

    # Lookups

    @staticmethod
    def without(row, *names):
        return {key: value for key, value in row.items() if key not in names}

    def department(self, name):
        if not name:
            return None
        department = Department.objects.filter(name=name).first()
        if department is None:
            self.missing.append(f"department {name}")
        return department

    def person(self, email):
        if not email:
            return None
        person = User.objects.filter(email=email).first()
        if person is None:
            self.missing.append(f"person {email}")
        return person

    def document(self, title):
        document = Document.objects.filter(title=title).first()
        if document is None:
            self.missing.append(f"document {title}")
        return document

    def receipt(self, title):
        if not title:
            return None
        receipt = Document.objects.filter(title=title, category=Document.Category.RECEIPT).first()
        if receipt is None:
            self.missing.append(f"receipt {title}")
        return receipt
