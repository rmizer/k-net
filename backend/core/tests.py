from datetime import datetime, time, timedelta
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Department, User
from announcements.models import Alert, Announcement
from schedule.models import Event
from tasks.models import Task

from . import weather
from .models import InvestorPage, ProductionSettings

PASSWORD = "a-strong-test-password-1"


def make_user(email, role, department=None, **extra):
    return User.objects.create_user(
        email=email, password=PASSWORD, first_name=email.split("@")[0].title(), last_name="Test",
        role=role, department=department, **extra,
    )


def at(day, hour):
    return timezone.make_aware(datetime.combine(day, time(hour)))


class BaseTestCase(APITestCase):
    def setUp(self):
        self.tech = Department.objects.create(name="Tech")
        self.logistics = Department.objects.create(name="Logistics")
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF, self.tech, is_active_crew=True)
        self.other = make_user("other@test.com", User.Role.STAFF, self.logistics, is_active_crew=True)


class AnnouncementPermissionTests(BaseTestCase):
    def test_staff_can_read_but_not_post(self):
        Announcement.objects.create(title="Hello")
        self.client.force_authenticate(self.staff)
        self.assertEqual(len(self.client.get("/api/announcements/").data), 1)
        self.assertEqual(self.client.post("/api/announcements/", {"title": "Nope"}).status_code, 403)

    def test_director_posts_announcement_as_author(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/announcements/", {"title": "Call time moved", "body": "Now 7am"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Announcement.objects.get().created_by, self.director)

    def test_expired_alerts_are_hidden(self):
        Alert.objects.create(message="Old", expires_at=timezone.now() - timedelta(hours=1))
        Alert.objects.create(message="Current")
        self.client.force_authenticate(self.staff)
        self.assertEqual([a["message"] for a in self.client.get("/api/alerts/").data], ["Current"])


class CallSheetTests(BaseTestCase):
    SHEET = (
        '<div class="cs-sheets"><article class="cs-sheet" aria-label="Page 1" onclick="steal()">'
        '<span class="cs-edit" contenteditable="true">Call Sheet - Season 1</span>'
        '<script>alert(1)</script><img src="/assets/logo.png" alt="Logo" onerror="x()">'
        '<img src="https://evil.example/pixel.gif"><a href="javascript:x()">link</a>'
        '<table><tr><td colspan="2">Max &amp; Dylan &lt;b&gt;</td></tr></table></article></div>'
    )

    def publish(self, user, **extra):
        self.client.force_authenticate(user)
        body = {"title": "Call sheet · Fri, Oct 23", "day": "2026-10-23", "html": self.SHEET, **extra}
        return self.client.post("/api/call-sheets/", body)

    def test_directors_publish_and_everyone_reads_the_cleaned_sheet(self):
        self.assertEqual(self.publish(self.staff).status_code, 403)
        response = self.publish(self.director)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            response.data["html"],
            '<div class="cs-sheets"><article class="cs-sheet" aria-label="Page 1">'
            '<span class="cs-edit">Call Sheet - Season 1</span>'
            '<img alt="Logo" src="/assets/logo.png">link'
            '<table><tr><td colspan="2">Max &amp; Dylan &lt;b&gt;</td></tr></table></article></div>',
        )

        self.client.force_authenticate(self.staff)
        latest = self.client.get("/api/call-sheets/latest/").data
        self.assertEqual(latest["id"], response.data["id"])
        self.assertEqual(self.client.get("/api/dashboard/").data["latest_call_sheet"]["title"], "Call sheet · Fri, Oct 23")

    def test_newest_sheet_is_the_one_linked(self):
        self.client.force_authenticate(self.staff)
        self.assertIsNone(self.client.get("/api/call-sheets/latest/").data)
        self.publish(self.director, title="First")
        self.publish(self.director, title="Second")
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/dashboard/").data["latest_call_sheet"]["title"], "Second")


class TaskPermissionTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.mine = Task.objects.create(title="Mine", assigned_to=self.staff)
        self.theirs = Task.objects.create(title="Theirs", assigned_to=self.other)

    def test_staff_only_see_their_own_tasks(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual([t["title"] for t in self.client.get("/api/tasks/").data], ["Mine"])
        self.assertEqual(self.client.get(f"/api/tasks/{self.theirs.pk}/").status_code, 404)

    def test_mine_filter_limits_managers_to_their_own_tasks(self):
        Task.objects.create(title="Director's", assigned_to=self.director, created_by=self.staff)
        self.client.force_authenticate(self.director)
        self.assertEqual(len(self.client.get("/api/tasks/").data), 3)
        tasks = self.client.get("/api/tasks/?mine=1").data
        self.assertEqual([t["title"] for t in tasks], ["Director's"])
        self.assertEqual(tasks[0]["created_by_name"], "Staff Test")

    def test_staff_can_complete_own_task(self):
        self.client.force_authenticate(self.staff)
        response = self.client.patch(f"/api/tasks/{self.mine.pk}/", {"status": "done"})
        self.assertEqual(response.status_code, 200)
        self.mine.refresh_from_db()
        self.assertIsNotNone(self.mine.completed_at)

    def test_staff_cannot_edit_other_fields_or_create(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.patch(f"/api/tasks/{self.mine.pk}/", {"title": "Renamed"}).status_code, 403)
        self.assertEqual(self.client.post("/api/tasks/", {"title": "New"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/tasks/{self.mine.pk}/").status_code, 403)

    def test_director_assigns_tasks(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/tasks/", {"title": "Rig lights", "assigned_to": self.staff.pk})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(self.client.get("/api/tasks/").data), 3)

    def test_reopening_clears_completed_at(self):
        self.mine.status = Task.Status.DONE
        self.mine.save()
        self.mine.status = Task.Status.TODO
        self.mine.save()
        self.assertIsNone(self.mine.completed_at)


class EventTests(BaseTestCase):
    def test_end_before_start_rejected(self):
        self.client.force_authenticate(self.director)
        now = timezone.now()
        response = self.client.post(
            "/api/events/", {"title": "Bad", "start": now.isoformat(), "end": (now - timedelta(hours=1)).isoformat()}
        )
        self.assertEqual(response.status_code, 400)

    def test_staff_cannot_create_events(self):
        self.client.force_authenticate(self.staff)
        now = timezone.now()
        response = self.client.post("/api/events/", {"title": "X", "start": now.isoformat(), "end": now.isoformat()})
        self.assertEqual(response.status_code, 403)

    def test_mine_filter_uses_attendance_and_department(self):
        now = timezone.now()
        Event.objects.create(title="Dept", start=now, end=now, department=self.tech)
        attending = Event.objects.create(title="Invited", start=now, end=now)
        attending.attendees.add(self.staff)
        Event.objects.create(title="Other", start=now, end=now, department=self.logistics)
        self.client.force_authenticate(self.staff)
        titles = {e["title"] for e in self.client.get("/api/events/?mine=1").data}
        self.assertEqual(titles, {"Dept", "Invited"})


class DashboardTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        today = timezone.localdate()
        self.today = today
        Event.objects.create(title="Tech call", start=at(today, 9), end=at(today, 10), department=self.tech)
        Event.objects.create(title="Logistics run", start=at(today, 11), end=at(today, 12), department=self.logistics)
        Event.objects.create(
            title="Yesterday", start=at(today - timedelta(days=1), 9), end=at(today - timedelta(days=1), 10)
        )
        Task.objects.create(title="Staff task", assigned_to=self.staff, due_date=today - timedelta(days=1))
        Task.objects.create(title="Done task", assigned_to=self.staff, status=Task.Status.DONE)
        Task.objects.create(title="Other task", assigned_to=self.other)

    def get_dashboard(self, user):
        self.client.force_authenticate(user)
        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_daily_rundown_shows_all_of_todays_events(self):
        titles = [e["title"] for e in self.get_dashboard(self.staff)["daily_rundown"]]
        self.assertEqual(titles, ["Tech call", "Logistics run"])

    def test_staff_week_shows_only_their_events(self):
        data = self.get_dashboard(self.staff)
        titles = {e["title"] for e in data["week_events"]}
        self.assertIn("Tech call", titles)
        self.assertNotIn("Logistics run", titles)

    def test_director_week_shows_everyone(self):
        titles = {e["title"] for e in self.get_dashboard(self.director)["week_events"]}
        self.assertTrue({"Tech call", "Logistics run"} <= titles)

    def test_my_tasks_excludes_done_and_others(self):
        tasks = self.get_dashboard(self.staff)["my_tasks"]
        self.assertEqual([t["title"] for t in tasks], ["Staff task"])
        self.assertTrue(tasks[0]["is_overdue"])

    def test_staff_tasks_summary_only_for_managers(self):
        self.assertIsNone(self.get_dashboard(self.staff)["staff_tasks"])
        summary = self.get_dashboard(self.director)["staff_tasks"]
        self.assertEqual(summary["counts"], {"todo": 2, "in_progress": 0, "overdue": 1, "done": 1})
        self.assertEqual(summary["open_total"], 2)

    def test_todays_crew_grouped_by_department(self):
        crew = self.get_dashboard(self.staff)["todays_crew"]
        self.assertEqual([group["department"] for group in crew], ["Logistics", "Tech"])
        self.assertEqual(crew[1]["members"][0]["first_name"], "Staff")

    def test_staff_cannot_see_emergency_details_via_crew(self):
        crew = self.get_dashboard(self.staff)["todays_crew"]
        self.assertEqual(set(crew[0]["members"][0]), {"id", "first_name", "last_name"})


class StaffManagerTests(BaseTestCase):
    def test_tasks_need_a_person_or_department(self):
        self.client.force_authenticate(self.director)
        response = self.client.post("/api/tasks/", {"title": "Floating"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("assigned_to", response.data)
        response = self.client.post("/api/tasks/", {"title": "Tech job", "department": self.tech.pk})
        self.assertEqual(response.status_code, 201)

    def test_events_for_a_person(self):
        day = timezone.localdate() + timedelta(days=1)
        theirs = Event.objects.create(title="Theirs", start=at(day, 9), end=at(day, 10))
        theirs.attendees.add(self.other)
        dept = Event.objects.create(title="Tech meeting", start=at(day, 11), end=at(day, 12), department=self.tech)
        Event.objects.create(title="Nobody's", start=at(day, 13), end=at(day, 14))
        self.client.force_authenticate(self.director)
        titles = [e["title"] for e in self.client.get(f"/api/events/?person={self.staff.pk}").data]
        self.assertEqual(titles, [dept.title])
        self.assertEqual(self.client.get("/api/events/?person=99999").status_code, 400)

    def test_staff_overview(self):
        today = timezone.localdate()
        Task.objects.create(title="Late", assigned_to=self.staff, due_date=today - timedelta(days=1))
        Task.objects.create(title="Done", assigned_to=self.staff, status=Task.Status.DONE)
        monday = today - timedelta(days=today.weekday())
        shift = Event.objects.create(title="Shift", start=at(monday, 9), end=at(monday, 17))
        shift.attendees.add(self.staff)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/staff-manager/staff/").status_code, 403)
        self.client.force_authenticate(self.director)
        row = next(r for r in self.client.get("/api/staff-manager/staff/").data if r["id"] == self.staff.pk)
        self.assertEqual(row["tasks"], {"open": 1, "overdue": 1, "done": 1})
        self.assertEqual(row["hours_this_week"], 8.0)


class ProductionTimeZoneTests(BaseTestCase):
    def test_today_follows_production_time_zone(self):
        production = ProductionSettings.load()
        production.time_zone = "Pacific/Kiritimati"  # UTC+14
        production.save()
        self.client.force_authenticate(self.staff)
        frozen = timezone.make_aware(datetime(2026, 1, 1, 12, 0), timezone.get_fixed_timezone(0))
        with mock.patch("django.utils.timezone.now", return_value=frozen):
            data = self.client.get("/api/dashboard/").data
        self.assertEqual(str(data["production"]["today"]), "2026-01-02")
        with mock.patch("django.utils.timezone.now", return_value=frozen):
            data = self.client.get("/api/production/").data
        self.assertEqual(str(data["today"]), "2026-01-02")

    def test_settings_row_cannot_be_deleted(self):
        ProductionSettings.load().delete()
        self.assertTrue(ProductionSettings.objects.exists())


FAKE_FORECAST = {
    "current": {
        "temperature_2m": 71.6, "apparent_temperature": 70.2, "relative_humidity_2m": 40,
        "weather_code": 2, "wind_speed_10m": 8.4,
    },
    "daily": {
        "time": ["2026-10-03", "2026-10-04"],
        "weather_code": [2, 61],
        "temperature_2m_max": [75.2, 68.0],
        "temperature_2m_min": [58.9, 55.1],
        "precipitation_probability_max": [5, 60],
    },
}


class WeatherTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def test_not_configured_without_location(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/weather/").data, {"configured": False})

    def test_forecast_is_shaped_and_cached(self):
        production = ProductionSettings.load()
        production.latitude, production.longitude, production.location_name = 34.05, -118.24, "Los Angeles"
        production.save()
        self.client.force_authenticate(self.staff)
        with mock.patch.object(weather, "_get_json", return_value=FAKE_FORECAST) as fetch:
            first = self.client.get("/api/weather/").data
            self.client.get("/api/weather/")
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(first["current"]["temperature"], 72)
        self.assertEqual(first["current"]["description"], "Partly cloudy")
        self.assertEqual(first["daily"][1]["description"], "Light rain")
        self.assertEqual(first["temperature_unit"], "°F")

    def test_service_failure_returns_503(self):
        production = ProductionSettings.load()
        production.latitude, production.longitude = 1, 1
        production.save()
        self.client.force_authenticate(self.staff)
        with mock.patch.object(weather, "_get_json", side_effect=weather.WeatherUnavailable("down")):
            self.assertEqual(self.client.get("/api/weather/").status_code, 503)


class ProductionLocationTests(BaseTestCase):
    PLACE = {
        "location_name": "Atlanta, Georgia, United States",
        "latitude": Decimal("33.749000"),
        "longitude": Decimal("-84.387980"),
        "time_zone": "America/New_York",
    }

    def test_director_sets_location_and_time_zone(self):
        self.client.force_authenticate(self.director)
        with mock.patch.object(weather, "find_place", return_value=self.PLACE):
            response = self.client.post("/api/production/location/", {"query": "Atlanta"})
        self.assertEqual(response.status_code, 200)
        production = ProductionSettings.load()
        self.assertEqual(production.time_zone, "America/New_York")
        self.assertEqual(production.location_name, "Atlanta, Georgia, United States")

    def test_find_place_rounds_coordinates(self):
        result = {"results": [{"name": "Atlanta", "admin1": "Georgia", "country": "United States",
                               "latitude": 33.74900012345, "longitude": -84.387981234, "timezone": "America/New_York"}]}
        with mock.patch.object(weather, "_get_json", return_value=result):
            place = weather.find_place("Atlanta")
        self.assertEqual(str(place["latitude"]), "33.749000")
        self.assertEqual(place["location_name"], "Atlanta, Georgia, United States")

    def test_unknown_place(self):
        self.client.force_authenticate(self.director)
        with mock.patch.object(weather, "find_place", return_value=None):
            response = self.client.post("/api/production/location/", {"query": "Nowhere"})
        self.assertEqual(response.status_code, 400)

    def test_staff_cannot_set_location(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post("/api/production/location/", {"query": "Atlanta"}).status_code, 403)


class InvestorPageTests(APITestCase):
    def setUp(self):
        self.manager = make_user("sm@test.com", User.Role.SITE_MANAGER)

    def test_only_site_managers_get_the_link(self):
        for role in [User.Role.DIRECTOR, User.Role.ASSISTANT, User.Role.STAFF]:
            self.client.force_authenticate(make_user(f"{role}@test.com", role))
            self.assertEqual(self.client.get("/api/investor-link/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/investor-link/").status_code, 403)
        self.client.force_authenticate(self.manager)
        response = self.client.get("/api/investor-link/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["token"], InvestorPage.load().token)

    def test_anyone_with_the_link_can_view(self):
        token = InvestorPage.load().token
        response = self.client.get(f"/api/investors/{token}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")

    def test_wrong_token_is_not_found(self):
        InvestorPage.load()
        self.assertEqual(self.client.get("/api/investors/guess/").status_code, 404)

    def test_public_page_needs_no_token(self):
        response = self.client.get("/api/investors/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")

    def test_replacing_the_link_stops_the_old_one(self):
        old = InvestorPage.load().token
        self.client.force_authenticate(self.manager)
        new = self.client.post("/api/investor-link/").data["token"]
        self.assertNotEqual(old, new)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/investors/{old}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/investors/{new}/").status_code, 200)
