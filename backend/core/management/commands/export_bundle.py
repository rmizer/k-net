import base64
import json
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

# Rebuilt by migrate, or only meaningful on this machine.
EXCLUDE = ["contenttypes", "auth.permission", "admin.logentry", "sessions"]


def bundle_files(root, prefix):
    root = Path(root)
    if not root.is_dir():
        return {}
    return {
        f"{prefix}/{path.relative_to(root).as_posix()}": base64.b64encode(path.read_bytes()).decode()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


class Command(BaseCommand):
    help = (
        "Write the whole database and every uploaded file to one JSON file, for moving "
        "K-Net to another server with import_bundle."
    )

    def add_arguments(self, parser):
        parser.add_argument("output", help="Where to write the bundle, e.g. knet-bundle.json")

    def handle(self, output, **options):
        data = StringIO()
        call_command(
            "dumpdata", exclude=EXCLUDE, natural_foreign=True, natural_primary=True, stdout=data
        )
        files = {
            **bundle_files(settings.MEDIA_ROOT, "media"),
            **bundle_files(settings.PRIVATE_MEDIA_ROOT, "private"),
        }
        bundle = {"data": json.loads(data.getvalue()), "files": files}
        Path(output).write_text(json.dumps(bundle), encoding="utf-8")
        self.stdout.write(
            self.style.SUCCESS(f"Wrote {len(bundle['data'])} records and {len(files)} files to {output}.")
        )
