import base64
import json
import sys
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User


class Command(BaseCommand):
    help = (
        "Load a bundle written by export_bundle: every record, plus the uploaded files. "
        "Meant for a fresh, migrated database; refuses if accounts already exist."
    )

    def add_arguments(self, parser):
        parser.add_argument("source", help="The bundle file, or - to read it from standard input.")

    def handle(self, source, **options):
        raw = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
        try:
            bundle = json.loads(raw)
        except json.JSONDecodeError as error:
            raise CommandError(f"That isn't a bundle file: {error}") from None
        if User.objects.exists():
            raise CommandError("This database already has accounts; import into an empty one.")

        roots = {"media": Path(settings.MEDIA_ROOT), "private": Path(settings.PRIVATE_MEDIA_ROOT)}
        with tempfile.TemporaryDirectory() as folder:
            fixture = Path(folder) / "bundle.json"
            fixture.write_text(json.dumps(bundle["data"]), encoding="utf-8")
            with transaction.atomic():
                call_command("loaddata", str(fixture), verbosity=0)

        for name, content in bundle["files"].items():
            area, _, relative = name.partition("/")
            target = (roots[area] / relative).resolve()
            if not target.is_relative_to(roots[area].resolve()):
                raise CommandError(f"Refusing to write outside the upload folders: {name}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(base64.b64decode(content))

        self.stdout.write(
            self.style.SUCCESS(f"Loaded {len(bundle['data'])} records and {len(bundle['files'])} files.")
        )
