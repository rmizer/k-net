from io import StringIO

from django.core.management import call_command
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Resource

PASSWORD = "a-strong-test-password-1"


def make_user(email, role):
    return User.objects.create_user(email=email, password=PASSWORD, first_name="T", last_name="U", role=role)


class ResourceTests(APITestCase):
    def setUp(self):
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)

    def test_staff_can_view_but_not_add(self):
        Resource.objects.create(company_name="Acme Rentals", phone="555-0100")
        self.client.force_authenticate(self.staff)
        self.assertEqual(len(self.client.get("/api/resources/").data), 1)
        response = self.client.post("/api/resources/", {"company_name": "X", "phone": "1"})
        self.assertEqual(response.status_code, 403)

    def test_director_adds_and_edits(self):
        self.client.force_authenticate(self.director)
        response = self.client.post(
            "/api/resources/", {"company_name": "Acme Rentals", "phone": "555-0100", "category": "rentals"}
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["category_display"], "Rentals")
        resource = Resource.objects.get()
        self.assertEqual(resource.created_by, self.director)
        response = self.client.patch(f"/api/resources/{resource.pk}/", {"contact_name": "Pat"})
        self.assertEqual(response.data["contact_name"], "Pat")

    def test_name_and_phone_required(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/resources/", {"company_name": "", "phone": ""})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["phone"][0], "Enter a phone number.")
        self.assertIn("company_name", response.data)

    def test_invalid_website_rejected(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/resources/", {"company_name": "A", "phone": "1", "website": "not a url"})
        self.assertEqual(response.status_code, 400)

    def test_load_miami_is_repeatable(self):
        call_command("load_miami", stdout=StringIO())
        count = Resource.objects.count()
        self.assertGreater(count, 10)
        call_command("load_miami", stdout=StringIO())
        self.assertEqual(Resource.objects.count(), count)

    def test_load_miami_removes_tampa_entries_only_when_asked(self):
        Resource.objects.create(company_name="Film Tampa Bay", phone="1")
        Resource.objects.create(company_name="Fiesta Solutions Event Rentals", phone="1")
        Resource.objects.create(company_name="Help Desk", phone="1", address="Raleigh, NC")
        call_command("load_miami", stdout=StringIO())
        self.assertTrue(Resource.objects.filter(company_name="Film Tampa Bay").exists())
        call_command("load_miami", "--remove-tampa", "--dry-run", stdout=StringIO())
        self.assertTrue(Resource.objects.filter(company_name="Film Tampa Bay").exists())
        call_command("load_miami", "--remove-tampa", stdout=StringIO())
        names = set(Resource.objects.values_list("company_name", flat=True))
        self.assertNotIn("Film Tampa Bay", names)
        self.assertNotIn("Fiesta Solutions Event Rentals", names)
        self.assertIn("Help Desk", names)
        self.assertIn("Moving Picture Miami", names)
