from decimal import Decimal

from rest_framework.test import APITestCase

from accounts.models import Department, User
from documents.models import Document


def make_user(email, role=User.Role.STAFF):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role)


class VehicleTests(APITestCase):
    def setUp(self):
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.driver = make_user("driver@test.com")
        self.gas = Document.objects.create(
            title="Gas", category=Document.Category.RECEIPT, file="documents/gas.pdf", vendor="Shell", amount=Decimal("84.10")
        )
        self.rental = Document.objects.create(
            title="U-Haul rental", category=Document.Category.RECEIPT, file="documents/uh.pdf", amount=Decimal("312.55")
        )
        self.registration = Document.objects.create(
            title="Registration", category=Document.Category.VEHICLE, file="documents/reg.pdf"
        )
        self.client.force_authenticate(self.director)

    def add(self, **changes):
        data = {
            "name": "U-Haul 15 ft",
            "kind": "moving_truck",
            "description": "White 15-foot box truck for moving the art department.",
            "license_plate": " ab 12345 ",
            "plate_state": "AZ",
            "ownership": "rented",
            "rented_from": "U-Haul of Doral, 8400 NW 36th St",
            "rental_reference": "UH-998877",
            "rented_on": "2026-12-01",
            "return_by": "2026-12-08T22:00:00Z",
            "return_to": "U-Haul of Doral",
            "storage_location": "Back lot by the production pod",
            "keys_location": "Lockbox in the production office",
            "driver": self.driver.pk,
            "documents": [self.gas.pk, self.rental.pk, self.registration.pk],
            **changes,
        }
        return self.client.post("/api/vehicles/", data, format="json")

    def test_add_rented_vehicle_with_receipts(self):
        response = self.add()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["license_plate"], "AB 12345")
        self.assertEqual(response.data["driver_name"], "driver")
        self.assertEqual(response.data["receipt_total"], "396.65")
        self.assertEqual(len(response.data["document_details"]), 3)
        self.assertEqual(response.data["status"], "active")

    def test_vin(self):
        response = self.add(vin=" 1ftfw1e50mfa12345 ")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["vin"], "1FTFW1E50MFA12345")
        self.assertIn("vin", self.add(vin="1FTFW1E50MFA1234").data)  # 16 characters
        self.assertIn("vin", self.add(vin="1FTFW1E5OMFA12345").data)  # letter O
        self.assertEqual(self.add(vin="").status_code, 201)

    def test_required_fields(self):
        response = self.add(name="", description="", license_plate="", storage_location="")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"name", "description", "license_plate", "storage_location"})

    def test_owned_vehicle_drops_rental_details(self):
        response = self.add(name="Party bus", kind="party_bus", ownership="owned")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["rented_from"], "")
        self.assertIsNone(response.data["return_by"])

    def test_due_back_after_pickup(self):
        response = self.add(rented_on="2026-12-10", return_by="2026-12-08T22:00:00Z")
        self.assertEqual(response.status_code, 400)
        self.assertIn("return_by", response.data)

    def test_edit_unlink_and_delete(self):
        vehicle = self.add().data
        url = f"/api/vehicles/{vehicle['id']}/"
        response = self.client.patch(url, {"documents": [self.gas.pk], "status": "returned"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["receipt_total"], "84.10")
        self.assertEqual(self.client.get("/api/vehicles/?status=returned").data[0]["id"], vehicle["id"])
        self.assertEqual(self.client.delete(url).status_code, 204)
        # Unlinking or deleting a vehicle leaves the documents in Documents.
        self.assertEqual(Document.objects.count(), 3)

    def test_staff_outside_transportation_cannot_see_vehicles(self):
        self.client.force_authenticate(self.driver)
        self.assertEqual(self.client.get("/api/vehicles/").status_code, 403)

    def test_transportation_team(self):
        transportation = Department.objects.create(name="Transportation", page=Department.Page.TRANSPORTATION)
        head = User.objects.create_user(
            email="head@test.com", first_name="head", department=transportation, is_department_head=True,
            head_of_department=transportation,
        )
        busdriver = User.objects.create_user(email="bus@test.com", first_name="bus", department=transportation)
        vehicle = self.add().data
        url = f"/api/vehicles/{vehicle['id']}/"

        self.client.force_authenticate(busdriver)
        self.assertEqual(self.client.get("/api/vehicles/").status_code, 200)
        response = self.client.patch(url, {"storage_location": "Hotel lot, row C"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)

        # Linked files open through the vehicle, even though Documents is managers-only.
        file_url = response.data["document_details"][0]["url"]
        self.assertTrue(file_url.startswith(f"/api/vehicles/{vehicle['id']}/documents/"))

        # Crew can link their own uploads, but not someone else's documents.
        mine = Document.objects.create(
            title="Tolls", category=Document.Category.RECEIPT, file="documents/t.pdf", uploaded_by=busdriver
        )
        other = Document.objects.create(title="Lease", category=Document.Category.CONTRACT, file="documents/l.pdf")
        current = vehicle["documents"]
        self.assertEqual(self.client.patch(url, {"documents": [*current, mine.pk]}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(url, {"documents": [*current, other.pk]}, format="json").status_code, 400)

        self.assertEqual(self.client.delete(url).status_code, 403)
        self.client.force_authenticate(head)
        self.assertEqual(self.client.delete(url).status_code, 204)

    def test_document_file_must_be_linked(self):
        vehicle = self.add(documents=[self.gas.pk]).data
        response = self.client.get(f"/api/vehicles/{vehicle['id']}/documents/{self.rental.pk}/file/")
        self.assertEqual(response.status_code, 404)
