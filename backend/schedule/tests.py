from datetime import date, datetime, time, timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.utils import timezone

from rest_framework.test import APITestCase

from accounts.models import Department, User

from .models import Event, TimelineItem

PASSWORD = "a-strong-test-password-1"


def make_user(email, role):
    return User.objects.create_user(email=email, password=PASSWORD, first_name="Dana", last_name="D", role=role)


class TimelineApiTests(APITestCase):
    def setUp(self):
        self.assistant = make_user("assistant@test.com", User.Role.ASSISTANT)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.item = TimelineItem.objects.create(
            name="Principal photography", start_date=date(2026, 10, 1), end_date=date(2026, 10, 20)
        )

    def test_everyone_can_view(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual([i["name"] for i in self.client.get("/api/timeline/").data], ["Principal photography"])

    def test_staff_cannot_change(self):
        self.client.force_authenticate(self.staff)
        item = {"name": "X", "start_date": "2026-10-01", "end_date": "2026-10-02"}
        self.assertEqual(self.client.post("/api/timeline/", item).status_code, 403)
        self.assertEqual(self.client.patch(f"/api/timeline/{self.item.pk}/", {"name": "Y"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/timeline/{self.item.pk}/").status_code, 403)

    def test_assistant_adds_and_edits(self):
        self.client.force_authenticate(self.assistant)
        item = {"name": "Episode 1 airs", "start_date": "2026-10-09", "end_date": "2026-10-09"}
        response = self.client.post("/api/timeline/", item)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created_by_name"], "Dana D")
        response = self.client.patch(f"/api/timeline/{self.item.pk}/", {"end_date": "2026-10-25"})
        self.assertEqual(response.data["end_date"], "2026-10-25")

    def test_end_before_start_rejected(self):
        self.client.force_authenticate(self.assistant)
        response = self.client.patch(f"/api/timeline/{self.item.pk}/", {"end_date": "2026-09-01"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_date", response.data)


class BlockScheduleTests(APITestCase):
    URL = "/api/events/block/"

    def setUp(self):
        from core.models import ProductionSettings

        settings = ProductionSettings.load()
        settings.time_zone = "America/New_York"
        settings.save()
        self.director = make_user("director@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.client.force_authenticate(self.director)

    def block(self, **changes):
        data = {
            "title": "Office hours",
            "attendees": [self.staff.pk],
            "ranges": [{"start_date": "2026-10-05", "end_date": "2026-10-09"}],
            "weekdays": [0, 1, 2, 3, 4],
            "start_time": "09:00",
            "end_time": "17:00",
        }
        return self.client.post(self.URL, {**data, **changes}, format="json")

    def test_two_week_ranges_nine_to_five(self):
        response = self.block(
            ranges=[
                {"start_date": "2026-10-05", "end_date": "2026-10-09"},
                {"start_date": "2026-10-12", "end_date": "2026-10-16"},
            ]
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["count"], 10)
        events = Event.objects.order_by("start")
        self.assertEqual(events.count(), 10)
        self.assertEqual({e.block for e in events}, {events[0].block})
        # 9 AM Eastern (EDT, UTC-4) is 13:00 UTC.
        self.assertEqual(events[0].start.isoformat(), "2026-10-05T13:00:00+00:00")
        self.assertEqual(events[0].end.isoformat(), "2026-10-05T21:00:00+00:00")
        self.assertEqual(list(events[0].attendees.all()), [self.staff])
        self.assertEqual(events[0].created_by, self.director)

    def test_weekdays_only_over_a_month(self):
        response = self.block(ranges=[{"start_date": "2026-10-05", "end_date": "2026-10-30"}])
        self.assertEqual(response.data["count"], 20)
        self.assertFalse(Event.objects.filter(start__week_day__in=[1, 7]).exists())  # No Sat/Sun.

    def test_overnight_and_all_day(self):
        self.block(start_time="22:00", end_time="06:00", weekdays=[0])
        event = Event.objects.get()
        self.assertEqual(event.end.date().isoformat(), "2026-10-06")
        Event.objects.all().delete()
        self.block(all_day=True, start_time=None, end_time=None)
        self.assertEqual(Event.objects.filter(all_day=True).count(), 5)

    def test_weekly_overnight_support_window(self):
        # Every Tuesday, 11 PM to 2 AM Wednesday.
        response = self.block(
            title="Maintenance",
            event_type="support",
            ranges=[{"start_date": "2026-10-12", "end_date": "2026-10-25"}],
            weekdays=[1],
            start_time="23:00",
            end_time="02:00",
        )
        self.assertEqual(response.data["count"], 2)
        first = Event.objects.order_by("start").first()
        self.assertEqual(first.event_type, "support")
        # 11 PM EDT Tue Oct 13 is 03:00 UTC Wed; 2 AM EDT Wed is 06:00 UTC.
        self.assertEqual(first.start.isoformat(), "2026-10-14T03:00:00+00:00")
        self.assertEqual(first.end.isoformat(), "2026-10-14T06:00:00+00:00")

    def test_validation(self):
        self.assertIn("weekdays", self.block(weekdays=[5, 6]).data)  # Mon-Fri range, weekends only.
        self.assertIn("ranges", self.block(ranges=[{"start_date": "2026-01-01", "end_date": "2028-01-01"}],
                                            weekdays=list(range(7))).data)
        self.assertEqual(self.block(attendees=[]).status_code, 400)
        self.assertIn("end_time", self.block(end_time=None).data)
        bad = self.block(ranges=[{"start_date": "2026-10-09", "end_date": "2026-10-05"}])
        self.assertEqual(bad.status_code, 400)
        self.assertFalse(Event.objects.exists())

    def test_staff_cannot_schedule_blocks(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.block().status_code, 403)

    def test_delete_whole_block(self):
        block = self.block().data["block"]
        other = self.block().data["block"]
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.delete(f"{self.URL}{block}/").status_code, 403)
        self.client.force_authenticate(self.director)
        response = self.client.delete(f"{self.URL}{block}/")
        self.assertEqual(response.data, {"deleted": 5})
        self.assertEqual(Event.objects.count(), 5)
        self.assertTrue(all(str(e.block) == other for e in Event.objects.all()))
        self.assertEqual(self.client.delete(f"{self.URL}{block}/").status_code, 404)


class CrewTests(APITestCase):
    """The Staff / Crew page lists who's working by the schedule."""

    def setUp(self):
        self.audio = Department.objects.create(name="Audio")
        self.viewer = make_user("viewer@test.com", User.Role.STAFF)
        self.early = User.objects.create_user(email="early@test.com", first_name="Early", last_name="E")
        self.member = User.objects.create_user(email="member@test.com", first_name="Mia", department=self.audio)
        self.off = User.objects.create_user(email="off@test.com", first_name="Off", last_name="O")
        self.day = date(2026, 10, 21)
        zone = timezone.get_current_timezone()
        at = lambda hour: datetime.combine(self.day, time(hour), tzinfo=zone)  # noqa: E731
        call = Event.objects.create(title="Crew call", location="Hotel", start=at(8), end=at(9))
        call.attendees.add(self.early)
        Event.objects.create(title="Sound check", start=at(10), end=at(11), department=self.audio)
        later = Event.objects.create(title="Later", start=at(12), end=at(13))
        later.attendees.add(self.early)
        support = Event.objects.create(title="Help desk", start=at(9), end=at(17), event_type=Event.EventType.SUPPORT)
        support.attendees.add(self.off)
        tomorrow = Event.objects.create(title="Tomorrow", start=at(8) + timedelta(days=1), end=at(9) + timedelta(days=1))
        tomorrow.attendees.add(self.off)
        self.client.force_authenticate(self.viewer)

    def test_crew_is_everyone_called_that_day_with_their_first_call(self):
        response = self.client.get("/api/users/crew/?date=2026-10-21")
        self.assertEqual(response.status_code, 200)
        crew = response.data["crew"]
        self.assertEqual([person["first_name"] for person in crew], ["Early", "Mia"])
        self.assertEqual(crew[0]["call"]["title"], "Crew call")
        self.assertEqual(crew[0]["call"]["time"], "08:00")
        self.assertEqual(crew[0]["call"]["location"], "Hotel")
        self.assertEqual(crew[1]["call"]["title"], "Sound check")


class LoadCallSheetTests(APITestCase):
    def test_loads_staff_and_schedule_and_can_run_again(self):
        Department.objects.create(name="Catering")
        gloria = User.objects.create_user(email="gloria.palms@example.com", first_name="Gloria", last_name="Palms")
        call_command("load_call_sheet", stdout=StringIO())
        call_command("load_call_sheet", stdout=StringIO())

        self.assertTrue(Department.objects.filter(name="Culinary").exists())
        self.assertFalse(Department.objects.filter(name="Catering").exists())
        gloria.refresh_from_db()
        self.assertEqual((gloria.last_name, gloria.title, gloria.role), ("Palma", "Operations Coordinator", "director"))
        self.assertEqual(gloria.department.name, "Operations")
        self.assertEqual(gloria.phone, "(941) 374-4584")
        babe = User.objects.get(first_name="Babe")
        self.assertEqual((babe.role, babe.department.name), ("assistant", "Production"))
        self.assertFalse(babe.has_usable_password())
        chico = User.objects.get(first_name="Chico")
        self.assertEqual((chico.role, chico.department.name), ("staff", "Security"))

        # Every day from Oct 9 to 23, once each even after running twice.
        lunches = Event.objects.filter(title="Cast lunch")
        self.assertEqual(lunches.count(), 15)
        self.assertEqual(lunches.first().talent_crew, "BG & creators")

    def test_adding_days_keeps_earlier_days_and_people(self):
        call_command("load_call_sheet", stdout=StringIO())
        babe = User.objects.get(first_name="Babe")
        babe.title = "Changed on the site"
        babe.save()
        args = ["--start", "2026-10-24", "--end", "2026-11-07", "--schedule-only"]
        call_command("load_call_sheet", *args, stdout=StringIO())
        call_command("load_call_sheet", *args, stdout=StringIO())

        # Oct 9 to Nov 7, once each, except the Oct 25 travel day.
        self.assertEqual(Event.objects.filter(title="Cast lunch").count(), 29)
        babe.refresh_from_db()
        self.assertEqual(babe.title, "Changed on the site")
        crew_call = Event.objects.filter(title="Crew call: Cast House 2.0").latest("start")
        self.assertIn(babe, crew_call.attendees.all())
        timeline = TimelineItem.objects.get(name__startswith="Battle House")
        self.assertEqual((str(timeline.start_date), str(timeline.end_date)), ("2026-10-09", "2026-11-07"))

    def test_day_18_call_sheet_from_oct_28(self):
        call_command("load_call_sheet", stdout=StringIO())
        args = ["--start", "2026-10-24", "--end", "2026-11-07", "--schedule-only"]
        call_command("load_call_sheet", *args, stdout=StringIO())
        espinosa = User.objects.get(email="je@battlehouselive.com")
        espinosa.lodging = "Candlewood Suites Ft. Lauderdale Airport/Cruise"
        espinosa.save()
        with mock.patch("core.management.commands.move_to_doral.geocode", return_value=None):
            call_command("move_to_doral", stdout=StringIO())
            call_command("move_to_doral", stdout=StringIO())

        # Oct 27 keeps the first call sheet; Oct 28 to Nov 7 follow day 18, once each.
        zone = timezone.get_current_timezone()
        oct_27 = Event.objects.filter(start__date=date(2026, 10, 27))
        self.assertTrue(oct_27.filter(title="Challenge 3", description="Jenga").exists())
        self.assertEqual(Event.objects.filter(title="Challenge 4", description="Water Hanging").count(), 11)
        self.assertFalse(Event.objects.filter(title="Challenge 3", description="Jenga", start__date__gte=date(2026, 10, 28)).exists())

        espinosa.refresh_from_db()
        self.assertEqual((espinosa.title, espinosa.department.name), ("Camera Operator", "Film Crew"))
        self.assertEqual(espinosa.lodging, "Candlewood Suites Miami - Doral")
        jessie = User.objects.get(email="jessier28221@gmail.com")
        garage_call = Event.objects.filter(title="Call time: PRIIME crew").latest("start")
        self.assertEqual(garage_call.start.astimezone(zone).time(), time(10, 30))
        self.assertIn(jessie, garage_call.attendees.all())
        self.assertFalse(User.objects.get(first_name="Miguel").has_usable_password())
        self.assertEqual(User.objects.get(email="ask@battlehouselive.com").department.name, "Production")
