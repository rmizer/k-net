import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from influencers.models import Influencer

# CSV columns this command understands. Only "name" is required.
TEXT_COLUMNS = [
    "handle",
    "platform",
    "phone",
    "email",
    "address",
    "agent_name",
    "agent_phone",
    "agent_email",
    "travel_needs",
    "lodging_needs",
    "needs",
]


class Command(BaseCommand):
    help = (
        "Add or update influencers from a CSV file. Needs a 'name' column; optional columns: "
        + ", ".join(TEXT_COLUMNS)
        + ". Existing influencers are matched by name, and only the columns present are updated."
    )

    def add_arguments(self, parser):
        parser.add_argument("csv_path", help="Path to the CSV file.")

    @transaction.atomic
    def handle(self, csv_path, **options):
        path = Path(csv_path)
        if not path.is_file():
            raise CommandError(f"File not found: {path}")

        valid_platforms = set(Influencer.Platform.values)
        created = updated = 0
        with path.open(newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            if "name" not in (reader.fieldnames or []):
                raise CommandError("The CSV needs a 'name' column.")

            for line, row in enumerate(reader, start=2):
                name = (row.get("name") or "").strip()
                if not name:
                    continue
                fields = {col: (row[col] or "").strip() for col in TEXT_COLUMNS if col in row}
                if "handle" in fields:
                    fields["handle"] = fields["handle"].lstrip("@")
                if fields.get("platform") and fields["platform"].lower() not in valid_platforms:
                    raise CommandError(f"Line {line}: unknown platform {fields['platform']!r}.")
                if "platform" in fields:
                    fields["platform"] = fields["platform"].lower()

                existing = Influencer.objects.filter(name__iexact=name).first()
                if existing:
                    for field, value in fields.items():
                        setattr(existing, field, value)
                    existing.save()
                    updated += 1
                else:
                    Influencer.objects.create(name=name, **fields)
                    created += 1

        self.stdout.write(self.style.SUCCESS(f"Influencers imported: {created} added, {updated} updated."))
