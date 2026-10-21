from io import StringIO

from django.core.management import call_command
from rest_framework.test import APITestCase

from accounts.models import Department, User
from influencers.models import Influencer

from .models import Show

PASSWORD = "a-strong-test-password-1"


def make_user(email, role, **fields):
    return User.objects.create_user(email=email, password=PASSWORD, first_name="T", last_name="U", role=role, **fields)


class ShowTests(APITestCase):
    def setUp(self):
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.other_director = make_user("dir2@test.com", User.Role.DIRECTOR)
        self.assistant = make_user("asst@test.com", User.Role.ASSISTANT)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.tech = Department.objects.create(name="Tech")
        self.head = make_user("head@test.com", User.Role.STAFF, is_department_head=True, head_of_department=self.tech)

    def test_director_creates_show_and_leads_it(self):
        self.client.force_authenticate(self.director)
        response = self.client.post(
            "/api/shows/",
            {
                "name": "New Show",
                "description": "A pitch.",
                "status": "planning",
                "seasons": 2,
                "other_directors": [self.other_director.pk, self.director.pk],
                "department_heads": [self.head.pk],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["director"], self.director.pk)
        # The lead director isn't repeated among the other directors.
        self.assertEqual(response.data["other_directors"], [self.other_director.pk])
        self.assertEqual(response.data["department_head_details"][0]["head_of_department_name"], "Tech")

    def test_name_and_description_required(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/shows/", {"name": "", "description": ""}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.data)
        self.assertIn("description", response.data)

    def test_seasons_must_be_a_number(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/shows/", {"name": "A", "description": "B", "seasons": "two"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("seasons", response.data)

    def test_only_department_heads_can_be_added_as_heads(self):
        self.client.force_authenticate(self.director)
        response = self.client.post(
            "/api/shows/", {"name": "A", "description": "B", "department_heads": [self.staff.pk]}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_assistants_and_staff_can_view_but_not_create(self):
        for user in (self.assistant, self.staff):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/shows/").status_code, 200)
            response = self.client.post("/api/shows/", {"name": "A", "description": "B"})
            self.assertEqual(response.status_code, 403)

    def test_department_head_stays_a_head_when_department_is_deleted(self):
        self.tech.delete()
        self.head.refresh_from_db()
        self.assertTrue(self.head.is_department_head)
        self.assertIsNone(self.head.head_of_department)

    def test_clearing_department_head_clears_department(self):
        self.client.force_authenticate(self.director)
        response = self.client.patch(f"/api/users/{self.head.pk}/", {"is_department_head": False}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["head_of_department"])


class BattleHouseWeeksTests(APITestCase):
    def test_influencers_are_placed_in_their_latest_week(self):
        Influencer.objects.create(name="Gordo Loco")
        Influencer.objects.create(name="Nilla")
        call_command("load_battle_house_weeks", stdout=StringIO())
        show = Show.objects.get(name="Battle House Live")
        gordo = Influencer.objects.get(name="Gordo Loco")  # In weeks 1 and 2.
        self.assertEqual((gordo.show, gordo.season, gordo.week), (show, 1, 2))
        self.assertEqual(Influencer.objects.get(name="QT Claps").week, 3)  # Added with dummy details.
        self.assertTrue(Influencer.objects.get(name="QT Claps").phone)
        count = Influencer.objects.count()
        call_command("load_battle_house_weeks", stdout=StringIO())
        self.assertEqual(Influencer.objects.count(), count)

    def test_dry_run_saves_nothing(self):
        call_command("load_battle_house_weeks", "--dry-run", stdout=StringIO())
        self.assertFalse(Show.objects.exists())
        self.assertFalse(Influencer.objects.exists())
