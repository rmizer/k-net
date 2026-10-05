from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from rest_framework.test import APITestCase

from accounts.models import User

from . import geocoding
from .models import Location

PASSWORD = "a-strong-test-password-1"
HILTON = (Decimal("27.962494"), Decimal("-82.512774"))


def make_user(email, role):
    return User.objects.create_user(email=email, password=PASSWORD, first_name="Dana", last_name="D", role=role)


class LocationApiTests(APITestCase):
    def setUp(self):
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)

    def test_everyone_can_view_but_only_managers_change(self):
        location = Location.objects.create(name="Stage A", kind="production")
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/locations/").data[0]["name"], "Stage A")
        self.assertEqual(self.client.post("/api/locations/", {"name": "X"}).status_code, 403)
        self.assertEqual(self.client.patch(f"/api/locations/{location.pk}/", {"name": "Y"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/locations/{location.pk}/").status_code, 403)

    def test_address_is_placed_on_the_map(self):
        self.client.force_authenticate(self.director)
        with mock.patch.object(geocoding, "geocode", return_value=HILTON) as lookup:
            response = self.client.post(
                "/api/locations/",
                {"name": "Hilton", "kind": "lodging", "address": "2225 N Lois Ave, Tampa, FL 33607"},
            )
        self.assertEqual(response.status_code, 201)
        lookup.assert_called_once_with("2225 N Lois Ave, Tampa, FL 33607")
        self.assertEqual((response.data["latitude"], response.data["longitude"]), ("27.962494", "-82.512774"))

    def test_unchanged_address_is_not_looked_up_again(self):
        location = Location.objects.create(name="Hilton", address="2225 N Lois Ave", latitude=1, longitude=2)
        self.client.force_authenticate(self.director)
        with mock.patch.object(geocoding, "geocode") as lookup:
            self.client.patch(f"/api/locations/{location.pk}/", {"address": "2225 N Lois Ave", "phone": "1"})
        lookup.assert_not_called()

    def test_unknown_address_saves_without_a_pin(self):
        self.client.force_authenticate(self.director)
        with mock.patch.object(geocoding, "geocode", return_value=None):
            response = self.client.post("/api/locations/", {"name": "Secret set", "address": "Somewhere"})
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["latitude"])

    def test_pin_placed_by_hand_wins(self):
        self.client.force_authenticate(self.director)
        data = {"name": "Ybor", "address": "E 7th Ave", "latitude": "27.96", "longitude": "-82.438"}
        with mock.patch.object(geocoding, "geocode") as lookup:
            response = self.client.post("/api/locations/", data)
        lookup.assert_not_called()
        self.assertEqual(response.data["latitude"], "27.960000")

    def test_coordinates_validated(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/locations/", {"name": "X", "latitude": "27.9"})
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/locations/", {"name": "X", "latitude": "95", "longitude": "1"})
        self.assertIn("latitude", response.data)

    def test_custom_type_only_for_other(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/locations/", {"name": "TGH", "kind": "other", "custom_type": "Hospital"})
        self.assertEqual(response.data["type_label"], "Hospital")
        response = self.client.post("/api/locations/", {"name": "TPA", "kind": "airport", "custom_type": "Hospital"})
        self.assertEqual((response.data["custom_type"], response.data["type_label"]), ("", "Airport"))


class GeocodeTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_failures_are_not_cached(self):
        with mock.patch.object(geocoding, "urlopen", side_effect=TimeoutError):
            self.assertIsNone(geocoding.geocode("2225 N Lois Ave"))
        with mock.patch.object(geocoding, "urlopen") as urlopen:
            urlopen.return_value.__enter__.return_value.read.return_value = b'[{"lat": "27.9", "lon": "-82.5"}]'
            self.assertEqual(geocoding.geocode("2225 N Lois Ave"), (Decimal("27.9"), Decimal("-82.5")))
        with mock.patch.object(geocoding, "urlopen") as urlopen:
            self.assertEqual(geocoding.geocode("2225 n lois ave"), (Decimal("27.9"), Decimal("-82.5")))
            urlopen.assert_not_called()  # Cached, whatever the case.
