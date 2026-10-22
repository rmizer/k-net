from rest_framework.test import APITestCase

from accounts.models import Department, User
from influencers.models import Influencer

from .models import ShoppingItem


def make_user(email, role=User.Role.STAFF, **fields):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role, **fields)


class CulinaryTests(APITestCase):
    def setUp(self):
        self.culinary = Department.objects.create(name="Culinary", page=Department.Page.CULINARY)
        self.tech = Department.objects.create(name="Tech", page=Department.Page.TECH)
        self.josh = make_user(
            "josh@test.com", department=self.culinary, is_department_head=True, head_of_department=self.culinary
        )
        self.sous = make_user("karter@test.com", department=self.culinary)
        self.techie = make_user("techie@test.com", department=self.tech)
        self.lisa = make_user(
            "lisa@test.com", department=self.tech, is_department_head=True, head_of_department=self.tech
        )

    def chili(self):
        self.client.force_authenticate(self.josh)
        response = self.client.post(
            "/api/culinary/menu-items/",
            {
                "name": "Chili",
                "date": "2026-10-23",
                "meal": "dinner",
                "ingredients": [
                    {"name": "Ground beef", "quantity": "5 lb", "category": "meat"},
                    {"name": "Kidney beans", "quantity": "4 cans", "category": "pantry"},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def add_to_list(self, menu_item, body):
        return self.client.post(f"/api/culinary/menu-items/{menu_item['id']}/add-to-list/", body, format="json")

    def test_menu_ingredients_flow_to_a_shopping_list_and_stay_in_sync(self):
        chili = self.chili()
        response = self.add_to_list(chili, {"store": "Publix", "needed_by": "2026-10-22"})
        self.assertEqual(response.status_code, 201, response.data)
        shopping_list = response.data["shopping_list"]
        self.assertEqual(response.data["added"], 2)
        self.assertEqual(shopping_list["items"][0]["meal"], "Chili · Dinner, Oct 23")

        # Adding again doesn't duplicate.
        self.assertEqual(self.add_to_list(chili, {"shopping_list": shopping_list["id"]}).data["added"], 0)

        # Taco night needs ground beef too: a separate line.
        tacos = self.client.post(
            "/api/culinary/menu-items/",
            {
                "name": "Taco night",
                "date": "2026-10-24",
                "meal": "dinner",
                "ingredients": [{"name": "Ground beef", "quantity": "5 lb", "category": "meat"}],
            },
            format="json",
        ).data
        self.add_to_list(tacos, {"shopping_list": shopping_list["id"]})
        beef = ShoppingItem.objects.filter(shopping_list_id=shopping_list["id"], name="Ground beef")
        self.assertEqual(beef.count(), 2)

        # Editing the menu updates the list; removing an ingredient takes it off.
        beef_row = chili["ingredients"][0]
        response = self.client.patch(
            f"/api/culinary/menu-items/{chili['id']}/",
            {"ingredients": [{**beef_row, "quantity": "6 lb"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        rows = list(
            ShoppingItem.objects.filter(shopping_list_id=shopping_list["id"]).values_list("name", "quantity", "meal")
        )
        self.assertIn(("Ground beef", "6 lb", "Chili · Dinner, Oct 23"), rows)
        self.assertNotIn("Kidney beans", [name for name, *_ in rows])

    def test_bought_items_stay_when_the_menu_changes(self):
        chili = self.chili()
        list_id = self.add_to_list(chili, {"store": "Costco"}).data["shopping_list"]["id"]
        ShoppingItem.objects.filter(name="Kidney beans").update(checked=True)
        self.assertEqual(self.client.delete(f"/api/culinary/menu-items/{chili['id']}/").status_code, 204)
        self.assertEqual(
            list(ShoppingItem.objects.filter(shopping_list_id=list_id).values_list("name", flat=True)),
            ["Kidney beans"],
        )

    def test_who_can_do_what(self):
        chili = self.chili()
        list_id = self.add_to_list(chili, {"store": "Publix"}).data["shopping_list"]["id"]
        item = ShoppingItem.objects.filter(shopping_list_id=list_id).first()

        # The sous chef can look and check things off, not edit menus or lists.
        self.client.force_authenticate(self.sous)
        self.assertEqual(self.client.get("/api/culinary/menu-items/").status_code, 200)
        self.assertEqual(
            self.client.patch(f"/api/culinary/shopping-items/{item.pk}/", {"checked": True}).status_code, 200
        )
        self.assertEqual(
            self.client.patch(f"/api/culinary/shopping-items/{item.pk}/", {"name": "Tofu"}).status_code, 403
        )
        self.assertEqual(
            self.client.post("/api/culinary/menu-items/", {"name": "Soup", "date": "2026-10-23"}).status_code, 403
        )
        self.assertEqual(self.client.delete(f"/api/culinary/shopping-lists/{list_id}/").status_code, 403)

        # Another department's head can look, not check off or change.
        self.client.force_authenticate(self.lisa)
        self.assertEqual(self.client.get(f"/api/culinary/shopping-lists/{list_id}/").status_code, 200)
        self.assertEqual(
            self.client.patch(f"/api/culinary/shopping-items/{item.pk}/", {"checked": False}).status_code, 403
        )

        # Other departments' staff can't see Culinary at all.
        self.client.force_authenticate(self.techie)
        self.assertEqual(self.client.get("/api/culinary/menu-items/").status_code, 403)

        # The head deletes lists.
        self.client.force_authenticate(self.josh)
        self.assertEqual(self.client.delete(f"/api/culinary/shopping-lists/{list_id}/").status_code, 204)

    def test_food_allergies_list_staff_crew_and_influencers(self):
        self.techie.food_allergies = "Peanuts, tree nuts"
        self.techie.allergies = "Penicillin"
        self.techie.save()
        make_user("gone@test.com", food_allergies="Shellfish", is_active=False)
        make_user("blank@test.com", food_allergies="   ")
        Influencer.objects.create(name="Chico", food_allergies="Gluten (celiac)")
        Influencer.objects.create(name="Retired", food_allergies="Eggs", is_active=False)

        self.client.force_authenticate(self.sous)
        response = self.client.get("/api/culinary/food-allergies/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [(row["name"], row["kind"], row["food_allergies"]) for row in response.data["people"]],
            [("Chico", "influencer", "Gluten (celiac)"), ("techie", "staff", "Peanuts, tree nuts")],
        )
        # General allergies stay off the Culinary page.
        self.assertNotIn("allergies", response.data["people"][1])

        # Other departments' staff can't see it, and can't see others' allergies in the Directory.
        self.client.force_authenticate(self.lisa)
        self.assertEqual(self.client.get("/api/culinary/food-allergies/").status_code, 200)
        self.client.force_authenticate(make_user("other@test.com", department=self.tech))
        self.assertEqual(self.client.get("/api/culinary/food-allergies/").status_code, 403)
        self.assertNotIn("food_allergies", self.client.get(f"/api/users/{self.techie.pk}/").data)
