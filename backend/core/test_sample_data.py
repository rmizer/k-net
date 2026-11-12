from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from accounts.models import Department, User
from challenges.models import Challenge
from inventory.models import InventoryItem
from vehicles.models import Vehicle


class LoadSampleDataTests(TestCase):
    def test_loads_once_and_reruns_add_nothing(self):
        User.objects.create_user(email="support.knet@gmail.com", first_name="Rachel", role=User.Role.SITE_MANAGER)
        Department.objects.create(name="Culinary", page=Department.Page.CULINARY)

        out = StringIO()
        call_command("load_sample_data", stdout=out)
        self.assertGreater(InventoryItem.objects.count(), 100)
        self.assertEqual(Vehicle.objects.count(), 5)
        self.assertEqual(Challenge.objects.count(), 4)
        self.assertTrue(Challenge.objects.first().supplies.exists())
        dana = User.objects.get(email="dana.whitfield.hr@example.com")
        self.assertEqual((dana.role, dana.department.name), (User.Role.ASSISTANT, "Human Resources"))
        self.assertFalse(dana.has_usable_password())
        self.assertEqual(Department.objects.get(name="Human Resources").page, Department.Page.HUMAN_RESOURCES)
        # Links that aren't on this site are reported, not invented.
        self.assertIn("Not on this site", out.getvalue())

        counts = InventoryItem.objects.count(), Vehicle.objects.count(), Challenge.objects.count()
        call_command("load_sample_data", stdout=StringIO())
        self.assertEqual((InventoryItem.objects.count(), Vehicle.objects.count(), Challenge.objects.count()), counts)

    def test_update_refreshes_existing_records(self):
        call_command("load_sample_data", stdout=StringIO())
        van = Vehicle.objects.get(kind="van")
        original = van.storage_location
        van.storage_location = "Somewhere else"
        van.save()
        call_command("load_sample_data", stdout=StringIO())
        self.assertEqual(Vehicle.objects.get(pk=van.pk).storage_location, "Somewhere else")
        call_command("load_sample_data", "--update", stdout=StringIO())
        self.assertEqual(Vehicle.objects.get(pk=van.pk).storage_location, original)
