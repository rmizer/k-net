from datetime import date

from rest_framework.test import APITestCase

from accounts.models import User

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
