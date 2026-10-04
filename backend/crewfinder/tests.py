from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Department, User

from .models import Tracker, TrackerPing

PASSWORD = "a-strong-test-password-1"


def make_user(email, role, **extra):
    return User.objects.create_user(
        email=email, password=PASSWORD, first_name=email.split("@")[0].title(), last_name="Test", role=role, **extra
    )


class TrackerTestCase(APITestCase):
    def setUp(self):
        self.manager = make_user("sm@test.com", User.Role.SITE_MANAGER)
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.staff = make_user(
            "staff@test.com", User.Role.STAFF, department=Department.objects.create(name="Tech"), is_active_crew=True
        )

    def add_tracker(self, **fields):
        self.client.force_authenticate(self.manager)
        response = self.client.post("/api/trackers/", {"person": self.staff.pk, "tracker_type": "airtag", **fields})
        self.client.force_authenticate(None)
        return response

    def ping(self, token, **data):
        payload = {"latitude": 33.749, "longitude": -84.388, **data}
        return self.client.post(
            "/api/trackers/ping/", payload, format="json", HTTP_AUTHORIZATION=f"Bearer {token}"
        )


class TrackerManagementTests(TrackerTestCase):
    def test_only_site_managers_manage_trackers(self):
        for user in (self.director, self.staff):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/trackers/").status_code, 403)
            response = self.client.post("/api/trackers/", {"person": self.staff.pk, "tracker_type": "airtag"})
            self.assertEqual(response.status_code, 403)

    def test_create_returns_key_once_and_stores_only_a_hash(self):
        response = self.add_tracker(label="Badge tag")
        self.assertEqual(response.status_code, 201)
        token = response.data["token"]
        tracker = Tracker.objects.get()
        self.assertNotEqual(tracker.token_hash, token)
        self.assertEqual(Tracker.for_token(token), tracker)
        self.client.force_authenticate(self.manager)
        self.assertNotIn("token", self.client.get(f"/api/trackers/{tracker.pk}/").data)

    def test_rotate_key_invalidates_old_key(self):
        response = self.add_tracker()
        old = response.data["token"]
        self.client.force_authenticate(self.manager)
        new = self.client.post(f"/api/trackers/{response.data['id']}/rotate_key/").data["token"]
        self.client.force_authenticate(None)
        self.assertEqual(self.ping(old).status_code, 401)
        self.assertEqual(self.ping(new).status_code, 201)

    def test_manual_location(self):
        tracker_id = self.add_tracker().data["id"]
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            f"/api/trackers/{tracker_id}/location/", {"latitude": 34.05, "longitude": -118.24, "note": "Stage B"}
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(TrackerPing.objects.get().source, TrackerPing.Source.MANUAL)

    def test_cannot_track_removed_account(self):
        self.staff.is_active = False
        self.staff.save()
        self.assertEqual(self.add_tracker().status_code, 400)


class TrackerPingTests(TrackerTestCase):
    def setUp(self):
        super().setUp()
        self.token = self.add_tracker().data["token"]

    def test_device_ping_records_location(self):
        response = self.ping(self.token, accuracy_m=12)
        self.assertEqual(response.status_code, 201)
        ping = TrackerPing.objects.get()
        self.assertEqual(str(ping.latitude), "33.749000")
        self.assertEqual(ping.accuracy_m, 12)
        self.assertEqual(ping.source, TrackerPing.Source.DEVICE)

    def test_bad_or_missing_key_rejected(self):
        self.assertEqual(self.ping("not-a-real-key").status_code, 401)
        self.assertEqual(self.client.post("/api/trackers/ping/", {"latitude": 1, "longitude": 1}).status_code, 401)

    def test_inactive_tracker_rejected(self):
        Tracker.objects.update(is_active=False)
        self.assertEqual(self.ping(self.token).status_code, 401)

    def test_out_of_range_coordinates_rejected(self):
        self.assertEqual(self.ping(self.token, latitude=95).status_code, 400)

    def test_future_timestamp_rejected(self):
        future = (timezone.now() + timedelta(hours=1)).isoformat()
        self.assertEqual(self.ping(self.token, recorded_at=future).status_code, 400)


class CrewFinderTests(TrackerTestCase):
    def test_everyone_sees_latest_location_without_identifiers(self):
        token = self.add_tracker(identifier="SERIAL-123").data["token"]
        self.ping(token, latitude=10, recorded_at=(timezone.now() - timedelta(hours=1)).isoformat())
        self.ping(token, latitude=20)
        self.client.force_authenticate(self.staff)
        data = self.client.get("/api/crewfinder/").data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["person"]["first_name"], "Staff")
        self.assertEqual(data[0]["person"]["department_name"], "Tech")
        self.assertEqual(float(data[0]["location"]["latitude"]), 20.0)
        self.assertNotIn("identifier", data[0])
        self.assertNotIn("SERIAL-123", str(data))

    def test_tracker_without_pings_has_no_location(self):
        self.add_tracker()
        self.client.force_authenticate(self.staff)
        self.assertIsNone(self.client.get("/api/crewfinder/").data[0]["location"])

    def test_inactive_trackers_and_removed_people_hidden(self):
        self.add_tracker()
        self.staff.is_active = False
        self.staff.save()
        self.client.force_authenticate(self.director)
        self.assertEqual(self.client.get("/api/crewfinder/").data, [])

    def test_requires_sign_in(self):
        self.assertEqual(self.client.get("/api/crewfinder/").status_code, 403)
