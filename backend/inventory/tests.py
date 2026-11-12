from rest_framework.test import APITestCase

from accounts.models import Department, User
from documents.models import Document

from .models import InventoryItem


def make_user(email, role=User.Role.STAFF):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role)


class InventoryTests(APITestCase):
    def setUp(self):
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com")
        self.culinary = Department.objects.create(name="Culinary", page=Department.Page.CULINARY)
        self.receipt = Document.objects.create(
            title="Publix run", category=Document.Category.RECEIPT, file="documents/r.pdf", vendor="Publix"
        )
        self.contract = Document.objects.create(title="Lease", category=Document.Category.CONTRACT, file="documents/c.pdf")
        self.client.force_authenticate(self.director)

    def add(self, **changes):
        data = {
            "name": "Great Value shredded cheddar",
            "department": self.culinary.pk,
            "item_type": "food",
            "purchased_on": "2026-11-11",
            "expires_on": "2026-11-20",
            "receipt": self.receipt.pk,
            "quantity": "2",
            "quantity_unit": "packages",
            "size": "32",
            "size_unit": "oz",
            "storage_location": "Filming location kitchen",
            "details": "Not open yet.",
            **changes,
        }
        return self.client.post("/api/inventory-items/", data, format="json")

    def test_add_item_with_receipt(self):
        response = self.add()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["department_name"], "Culinary")
        self.assertEqual(response.data["receipt_details"]["vendor"], "Publix")
        self.assertEqual(response.data["receipt_details"]["url"], f"/api/documents/{self.receipt.pk}/file/")
        self.assertTrue(response.data["in_stock"])

    def test_optional_fields_and_other_department(self):
        response = self.add(
            name="Gaffer tape", department=None, purchased_on=None, expires_on=None, receipt=None, size=None, size_unit=""
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["department_name"], "Other")

    def test_validation(self):
        response = self.add(name="", storage_location="", quantity="-1")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"name", "storage_location", "quantity"})
        self.assertIn("size_unit", self.add(size_unit="").data)
        self.assertIn("receipt", self.add(receipt=self.contract.pk).data)

    def test_zero_quantity_is_out_of_stock(self):
        self.assertFalse(self.add(quantity="0").data["in_stock"])

    def test_delete_restore_and_purge(self):
        item = self.add().data
        url = f"/api/inventory-items/{item['id']}/"
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.client.get("/api/inventory-items/").data, [])
        deleted = self.client.get("/api/inventory-items/?deleted=1").data
        self.assertEqual([row["id"] for row in deleted], [item["id"]])
        self.assertEqual(deleted[0]["deleted_by_name"], "director")
        # Deleted items can't be edited until restored.
        self.assertEqual(self.client.patch(url, {"quantity": "3"}, format="json").status_code, 404)

        self.assertEqual(self.client.post(f"{url}restore/").status_code, 200)
        self.assertEqual(len(self.client.get("/api/inventory-items/").data), 1)
        self.assertIsNone(InventoryItem.objects.get().deleted_at)

        # Only deleted items can be removed for good.
        self.assertEqual(self.client.delete(f"{url}purge/").status_code, 400)
        self.client.delete(url)
        self.assertEqual(self.client.delete(f"{url}purge/").status_code, 204)
        self.assertFalse(InventoryItem.objects.exists())

    def test_equipment_details(self):
        response = self.add(
            name="Sony FX6",
            brand="Sony",
            model_number="ILME-FX6V",
            serial_numbers="  5001234 \n\n5001235\n",
            asset_tag="KN-CAM-001",
            warranty_expires="2027-10-01",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["serial_numbers"], "5001234\n5001235")
        self.assertEqual(response.data["model_number"], "ILME-FX6V")

    def test_bunches_with_an_individual_count(self):
        response = self.add(name="Bananas", quantity="2", quantity_unit="bunches", piece_count=12, piece_label="bananas")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["quantity_unit_display"], response.data["piece_count"]), ("Bunches", 12))
        self.assertEqual(self.add(piece_count=None, piece_label="bananas").data["piece_label"], "")

    def test_item_type(self):
        self.assertEqual(self.add().data["item_type_display"], "Food")
        pot = self.add(name="Stock pot", item_type="cookware", expires_on=None)
        self.assertEqual(pot.data["item_type_display"], "Cookware & serving")
        self.assertEqual(self.add(item_type="made_up").status_code, 400)

    def test_staff_cannot_see_inventory(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/inventory-items/").status_code, 403)
