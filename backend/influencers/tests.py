import tempfile
from datetime import timedelta
from io import StringIO
from pathlib import Path

from django.core.management import CommandError, call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from schedule.models import Event

from .models import Influencer, InfluencerNote, TravelArrangement

PASSWORD = "a-strong-test-password-1"


def make_user(email, role):
    return User.objects.create_user(email=email, password=PASSWORD, first_name="Dana", last_name="D", role=role)


class InfluencerApiTests(APITestCase):
    def setUp(self):
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.influencer = Influencer.objects.create(name="Nilla", lodging_needs="Ground-floor room.")

    def test_everyone_can_view_roster_and_profile(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/influencers/").data[0]["name"], "Nilla")
        profile = self.client.get(f"/api/influencers/{self.influencer.pk}/").data
        self.assertEqual(profile["lodging_needs"], "Ground-floor room.")
        self.assertIn("travel", profile)

    def test_roster_rows_have_contact_and_upcoming_travel(self):
        now = timezone.now()
        TravelArrangement.objects.create(influencer=self.influencer, kind="flight", starts_at=now - timedelta(days=2))
        TravelArrangement.objects.create(influencer=self.influencer, kind="hotel", starts_at=now + timedelta(days=3))
        Influencer.objects.create(name="Zed")
        self.client.force_authenticate(self.staff)
        rows = {row["name"]: row for row in self.client.get("/api/influencers/").data}
        self.assertEqual(rows["Nilla"]["travel_count"], 2)
        self.assertEqual(rows["Nilla"]["next_travel_at"][:10], (now + timedelta(days=3)).date().isoformat())
        self.assertIsNone(rows["Zed"]["next_travel_at"])
        self.assertEqual(rows["Zed"]["travel_count"], 0)
        self.assertIn("agent_name", rows["Zed"])

    def test_staff_cannot_change_roster(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post("/api/influencers/", {"name": "X"}).status_code, 403)
        self.assertEqual(self.client.patch(f"/api/influencers/{self.influencer.pk}/", {"phone": "1"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/influencers/{self.influencer.pk}/").status_code, 403)
        note = {"influencer": self.influencer.pk, "body": "Hi"}
        self.assertEqual(self.client.post("/api/influencer-notes/", note).status_code, 403)

    def test_director_adds_and_edits(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/influencers/", {"name": "Big tim", "handle": "@bigtim", "platform": "tiktok"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["handle"], "bigtim")
        response = self.client.patch(f"/api/influencers/{self.influencer.pk}/", {"agent_name": "Pat Agent"})
        self.assertEqual(response.data["agent_name"], "Pat Agent")

    def test_duplicate_name_rejected(self):
        self.client.force_authenticate(self.director)
        self.assertEqual(self.client.post("/api/influencers/", {"name": "nilla"}).status_code, 400)

    def test_notes_record_author(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/influencer-notes/", {"influencer": self.influencer.pk, "body": "Vegan."})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["author_name"], "Dana D")
        self.assertEqual(InfluencerNote.objects.get().author, self.director)

    def test_travel_end_before_start_rejected(self):
        self.client.force_authenticate(self.director)
        now = timezone.now()
        response = self.client.post(
            "/api/influencer-travel/",
            {
                "influencer": self.influencer.pk,
                "kind": "flight",
                "starts_at": now.isoformat(),
                "ends_at": (now - timedelta(hours=1)).isoformat(),
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_profile_lists_upcoming_events_only(self):
        now = timezone.now()
        past = Event.objects.create(title="Past", start=now - timedelta(days=2), end=now - timedelta(days=2))
        soon = Event.objects.create(title="Meet & greet", start=now + timedelta(days=1), end=now + timedelta(days=1))
        past.influencers.add(self.influencer)
        soon.influencers.add(self.influencer)
        self.client.force_authenticate(self.staff)
        events = self.client.get(f"/api/influencers/{self.influencer.pk}/").data["upcoming_events"]
        self.assertEqual([e["title"] for e in events], ["Meet & greet"])

    def test_deleting_influencer_removes_notes_and_travel(self):
        InfluencerNote.objects.create(influencer=self.influencer, body="x")
        TravelArrangement.objects.create(influencer=self.influencer)
        self.client.force_authenticate(self.director)
        self.assertEqual(self.client.delete(f"/api/influencers/{self.influencer.pk}/").status_code, 204)
        self.assertFalse(InfluencerNote.objects.exists() or TravelArrangement.objects.exists())


class ImportInfluencersTests(APITestCase):
    def write_csv(self, text):
        handle = tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8")
        handle.write(text)
        handle.close()
        self.addCleanup(Path(handle.name).unlink)
        return handle.name

    def test_imports_and_updates_by_name(self):
        path = self.write_csv('name,email,travel_needs\nNigerian_nupe,n@x.com,"Aisle, from ATL"\nJay Borbon,j@x.com,\n')
        call_command("import_influencers", path, stdout=StringIO())
        self.assertEqual(Influencer.objects.get(name="Nigerian_nupe").travel_needs, "Aisle, from ATL")

        Influencer.objects.filter(name="Jay Borbon").update(agent_name="Kept")
        path = self.write_csv("name,lodging_needs\njay borbon,King bed\n")
        call_command("import_influencers", path, stdout=StringIO())
        jay = Influencer.objects.get(name="Jay Borbon")
        self.assertEqual((jay.lodging_needs, jay.email, jay.agent_name), ("King bed", "j@x.com", "Kept"))
        self.assertEqual(Influencer.objects.count(), 2)

    def test_requires_name_column(self):
        with self.assertRaises(CommandError):
            call_command("import_influencers", self.write_csv("handle\nx\n"), stdout=StringIO())

    def test_bad_platform_is_reported_and_nothing_saved(self):
        path = self.write_csv("name,platform\nA,tiktok\nB,myspace\n")
        with self.assertRaises(CommandError):
            call_command("import_influencers", path, stdout=StringIO())
        self.assertFalse(Influencer.objects.exists())
