from rest_framework.test import APITestCase

from accounts.models import User
from influencers.models import Influencer

from .models import Challenge

SAFE = {"waivers": "done", "allergy_check": "not_needed", "medic": "done"}


def make_user(email, role=User.Role.STAFF):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role)


class ChallengeTests(APITestCase):
    def setUp(self):
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com")
        self.ava = Influencer.objects.create(name="Ava")
        self.ben = Influencer.objects.create(name="Ben")

    def create(self, **changes):
        self.client.force_authenticate(self.director)
        data = {
            "name": "Egg drop",
            "date": "2026-12-03",
            "description": "Drop an egg from the roof without breaking it.",
            "participants": [self.ben.pk, self.ava.pk],
            "rewards": "Immunity for the week",
            "supplies": [
                {"name": "Eggs", "quantity": "2 dozen", "category": "food"},
                {"name": "Tape", "category": "props", "note": "Art dept has some"},
            ],
            **changes,
        }
        return self.client.post("/api/challenges/", data, format="json")

    def test_create_with_participants_and_supplies(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "planning")
        self.assertEqual(response.data["participant_names"], ["Ava", "Ben"])
        self.assertEqual([item["name"] for item in response.data["supplies"]], ["Eggs", "Tape"])
        self.assertEqual(response.data["created_by_name"], "director")

    def test_participants_rewards_and_supplies_are_optional(self):
        response = self.create(participants=[], rewards="", supplies=[])
        self.assertEqual(response.status_code, 201, response.data)

    def test_name_date_and_description_are_required(self):
        response = self.create(name="", date=None, description="")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"name", "date", "description"})

    def test_edit_keeps_updates_adds_and_removes_supplies(self):
        challenge = self.create().data
        eggs, tape = challenge["supplies"]
        response = self.client.patch(
            f"/api/challenges/{challenge['id']}/",
            {
                "status": "planned",
                **SAFE,
                "supplies": [{**eggs, "quantity": "3 dozen", "checked": True}, {"name": "Ladder", "category": "props"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "planned")
        supplies = response.data["supplies"]
        self.assertEqual([(s["name"], s["quantity"], s["checked"]) for s in supplies], [
            ("Eggs", "3 dozen", True),
            ("Ladder", "", False),
        ])
        self.assertEqual(supplies[0]["id"], eggs["id"])
        self.assertNotIn(tape["id"], [s["id"] for s in supplies])

    def test_checking_a_supply_moves_the_challenge_up(self):
        first = self.create().data
        self.create(name="Second")
        self.client.patch(f"/api/challenge-supplies/{first['supplies'][0]['id']}/", {"checked": True}, format="json")
        self.assertEqual(Challenge.objects.first().pk, first["id"])
        self.assertTrue(Challenge.objects.get(pk=first["id"]).supplies.first().checked)

    def test_filter_by_status(self):
        self.create()
        self.create(name="Done one", status="complete", **SAFE)
        response = self.client.get("/api/challenges/?status=complete")
        self.assertEqual([c["name"] for c in response.data], ["Done one"])

    def test_staff_cannot_see_or_change_challenges(self):
        self.create()
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/challenges/").status_code, 403)
        self.assertEqual(self.client.post("/api/challenges/", {}, format="json").status_code, 403)

    def test_show_and_week(self):
        from shows.models import Show

        show = Show.objects.create(name="Battle House Live", description="Live competition")
        response = self.create(show=show.pk, week=2)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["show_name"], response.data["week"]), ("Battle House Live", 2))
        self.assertEqual(self.create(week=0).status_code, 400)

    def test_delete(self):
        challenge = self.create().data
        self.assertEqual(self.client.delete(f"/api/challenges/{challenge['id']}/").status_code, 204)
        self.assertFalse(Challenge.objects.exists())

    def test_safety_checklist_must_be_cleared_before_planned(self):
        response = self.create(status="planned", waivers="done")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"allergy_check", "medic"})

        challenge = self.create().data
        self.assertEqual(challenge["safety_to_do"], ["Waivers signed", "Allergy check done", "Medic booked"])
        url = f"/api/challenges/{challenge['id']}/"
        self.assertEqual(self.client.patch(url, {"status": "planned"}, format="json").status_code, 400)
        response = self.client.patch(url, {"status": "planned", **SAFE}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["safety_to_do"], [])
        # Once planned, a check can't go back to To do.
        self.assertEqual(self.client.patch(url, {"medic": "todo"}, format="json").status_code, 400)

    def test_location_cleanup_and_content_warnings(self):
        response = self.create(
            location="backyard",
            location_details="By the pool deck",
            cleanup_plan="Hose down the deck",
            cleanup_owner=self.director.pk,
            content_warnings=["vomiting", "eating_insects", "vomiting"],
            other_content_warnings="Live spiders",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["location_display"], "Backyard")
        self.assertEqual(response.data["cleanup_owner_name"], "director")
        self.assertEqual(response.data["content_warnings"], ["eating_insects", "vomiting"])
        self.assertEqual(self.create(content_warnings=["made_up"]).status_code, 400)
