import re

from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import User, format_phone

PASSWORD = "A-strong-test-password-1"


def make_user(email, role, **extra):
    return User.objects.create_user(
        email=email, password=PASSWORD, first_name="Test", last_name=role, role=role, **extra
    )


class AuthTests(APITestCase):
    def setUp(self):
        self.staff = make_user("staff@test.com", User.Role.STAFF)

    def test_login_and_me(self):
        response = self.client.post("/api/auth/login/", {"email": "staff@test.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "staff")
        self.assertEqual(self.client.get("/api/auth/me/").data["email"], "staff@test.com")

    def test_login_email_is_case_insensitive(self):
        response = self.client.post("/api/auth/login/", {"email": "Staff@Test.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)

    def test_me_lists_assignable_roles(self):
        director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.client.force_authenticate(director)
        self.assertEqual(self.client.get("/api/auth/me/").data["assignable_roles"], ["assistant", "staff"])
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/auth/me/").data["assignable_roles"], [])

    def test_bad_password_rejected(self):
        response = self.client.post("/api/auth/login/", {"email": "staff@test.com", "password": "nope"})
        self.assertEqual(response.status_code, 400)

    def test_me_is_null_when_signed_out(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data)

    def test_anonymous_cannot_edit_profile(self):
        self.assertEqual(self.client.patch("/api/auth/me/", {"phone": "1"}).status_code, 403)

    def test_anonymous_cannot_read_directory(self):
        self.assertEqual(self.client.get("/api/users/").status_code, 403)

    def test_logout(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)

    def test_profile_cannot_change_own_role(self):
        self.client.force_authenticate(self.staff)
        self.client.patch("/api/auth/me/", {"role": "director", "phone": "555-1234"})
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.role, "staff")
        self.assertEqual(self.staff.phone, "555-1234")


class RoleFlagTests(APITestCase):
    def test_only_site_managers_get_admin_access(self):
        manager = make_user("sm@test.com", User.Role.SITE_MANAGER)
        director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.assertTrue(manager.is_staff and manager.is_superuser)
        self.assertFalse(director.is_staff or director.is_superuser)

    def test_manager_level(self):
        self.assertTrue(make_user("a@test.com", User.Role.ASSISTANT).is_manager_level)
        self.assertFalse(make_user("s@test.com", User.Role.STAFF).is_manager_level)


class AccountCreationTests(APITestCase):
    def setUp(self):
        self.manager = make_user("sm@test.com", User.Role.SITE_MANAGER)
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.assistant = make_user("asst@test.com", User.Role.ASSISTANT)
        self.staff = make_user("staff@test.com", User.Role.STAFF)

    def create(self, actor, role):
        self.client.force_authenticate(actor)
        return self.client.post(
            "/api/users/",
            {"email": f"new-{role}@test.com", "first_name": "New", "last_name": "Person",
             "role": role, "password": PASSWORD},
        )

    def test_site_manager_can_create_directors_and_assistants(self):
        self.assertEqual(self.create(self.manager, "director").status_code, 201)
        self.assertEqual(self.create(self.manager, "assistant").status_code, 201)

    def test_director_cannot_create_director(self):
        self.assertEqual(self.create(self.director, "director").status_code, 400)

    def test_director_can_create_assistant_and_staff(self):
        self.assertEqual(self.create(self.director, "assistant").status_code, 201)
        self.assertEqual(self.create(self.director, "staff").status_code, 201)

    def test_assistant_cannot_create_director(self):
        self.assertEqual(self.create(self.assistant, "director").status_code, 400)

    def test_staff_cannot_create_accounts(self):
        self.assertEqual(self.create(self.staff, "staff").status_code, 403)

    def test_director_cannot_edit_site_manager(self):
        self.client.force_authenticate(self.director)
        response = self.client.patch(f"/api/users/{self.manager.pk}/", {"phone": "555-0000"})
        self.assertEqual(response.status_code, 400)

    def test_only_site_managers_delete_accounts(self):
        self.client.force_authenticate(self.director)
        self.assertEqual(self.client.delete(f"/api/users/{self.staff.pk}/").status_code, 403)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.delete(f"/api/users/{self.manager.pk}/").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/users/{self.staff.pk}/").status_code, 204)
        self.staff.refresh_from_db()
        self.assertFalse(self.staff.is_active)


class PhoneFormatTests(APITestCase):
    def test_us_numbers_are_formatted_however_they_were_typed(self):
        for typed in ["1234567890", "123-456-7890", "123.456.7890", "+1 123 456 7890", "(123)4567890"]:
            self.assertEqual(format_phone(typed), "(123) 456-7890", typed)

    def test_other_numbers_are_kept_as_typed(self):
        for typed in ["", "+44 20 7946 0958", "555-0100", "123-456-7890 ext 4"]:
            self.assertEqual(format_phone(typed), typed)

    def test_saved_numbers_are_formatted(self):
        director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.client.force_authenticate(director)
        response = self.client.post(
            "/api/users/",
            {"email": "new@test.com", "first_name": "Chico", "role": "staff", "phone": "7869854974",
             "emergency_contact_phone": "813.555.0100", "title": "Security Guard"},
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["phone"], "(786) 985-4974")
        self.assertEqual(response.data["emergency_contact_phone"], "(813) 555-0100")
        self.assertEqual(response.data["title"], "Security Guard")
        self.assertEqual(response.data["last_name"], "")


class DirectoryManagementTests(APITestCase):
    def setUp(self):
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.client.force_authenticate(self.director)

    def add(self, **fields):
        data = {"email": "new@test.com", "first_name": "New", "last_name": "Person", "role": "staff", **fields}
        return self.client.post("/api/users/", data)

    def test_temporary_password_returned_once_when_none_given(self):
        response = self.add()
        self.assertEqual(response.status_code, 201)
        temp = response.data["temporary_password"]
        self.assertTrue(User.objects.get(email="new@test.com").check_password(temp))
        listing = self.client.get(f"/api/users/{response.data['id']}/").data
        self.assertNotIn("temporary_password", listing)

    def test_no_temporary_password_when_password_given(self):
        response = self.add(password=PASSWORD)
        self.assertNotIn("temporary_password", response.data)

    def test_duplicate_email_rejected_case_insensitively(self):
        self.add()
        response = self.add(email="NEW@test.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_readding_removed_person_explains_restore(self):
        user = self.add().data
        User.objects.filter(pk=user["id"]).update(is_active=False)
        response = self.add()
        self.assertIn("removed account", str(response.data["email"]))

    def test_names_required(self):
        self.assertEqual(self.add(first_name="").status_code, 400)

    def test_director_assigns_department(self):
        from .models import Department
        dept = Department.objects.create(name="Tech")
        response = self.add(department=dept.pk)
        self.assertEqual(response.data["department_name"], "Tech")

    def test_department_names_unique_case_insensitively(self):
        self.assertEqual(self.client.post("/api/departments/", {"name": "Catering"}).status_code, 201)
        self.assertEqual(self.client.post("/api/departments/", {"name": " catering "}).status_code, 400)

    def test_staff_cannot_add_departments(self):
        self.client.force_authenticate(make_user("s@test.com", User.Role.STAFF))
        self.assertEqual(self.client.post("/api/departments/", {"name": "X"}).status_code, 403)


class SiteManagerTests(APITestCase):
    def setUp(self):
        self.manager = make_user("sm@test.com", User.Role.SITE_MANAGER)
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.pending = make_user("new@test.com", User.Role.STAFF, email_verified=False)

    def test_site_manager_assigns_any_role(self):
        self.client.force_authenticate(self.manager)
        for role in ("director", "assistant", "site_manager", "staff"):
            response = self.client.patch(f"/api/users/{self.pending.pk}/", {"role": role})
            self.assertEqual(response.status_code, 200, role)
            self.assertEqual(response.data["role"], role)

    def test_nobody_changes_their_own_role(self):
        self.client.force_authenticate(self.manager)
        response = self.client.patch(f"/api/users/{self.manager.pk}/", {"role": "staff"})
        self.assertEqual(response.status_code, 400)
        self.manager.refresh_from_db()
        self.assertEqual(self.manager.role, "site_manager")

    def test_account_status_visible_to_site_managers_only(self):
        self.client.force_authenticate(self.manager)
        self.assertFalse(self.client.get(f"/api/users/{self.pending.pk}/").data["email_verified"])
        self.client.force_authenticate(self.director)
        self.assertNotIn("last_login", self.client.get(f"/api/users/{self.pending.pk}/").data)

    def test_site_manager_verifies_by_hand(self):
        self.client.force_authenticate(self.director)
        self.assertEqual(self.client.post(f"/api/users/{self.pending.pk}/verify/").status_code, 403)
        self.client.force_authenticate(self.manager)
        response = self.client.post(f"/api/users/{self.pending.pk}/verify/")
        self.assertTrue(response.data["email_verified"])
        self.pending.refresh_from_db()
        self.assertTrue(self.pending.email_verified)


class EmergencyContactVisibilityTests(APITestCase):
    def setUp(self):
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)
        self.other = make_user(
            "other@test.com", User.Role.STAFF,
            emergency_contact_name="Pat", emergency_contact_phone="555-9999",
        )

    def get_other(self, viewer):
        self.client.force_authenticate(viewer)
        return self.client.get(f"/api/users/{self.other.pk}/").data

    def test_staff_cannot_see_others_emergency_contacts(self):
        self.assertNotIn("emergency_contact_name", self.get_other(self.staff))

    def test_director_sees_emergency_contacts(self):
        self.assertEqual(self.get_other(self.director)["emergency_contact_name"], "Pat")

    def test_user_sees_own_emergency_contact(self):
        self.assertEqual(self.get_other(self.other)["emergency_contact_phone"], "555-9999")


@override_settings(SITE_URL="https://knet.example.com")
class SignupTests(APITestCase):
    FORM = {
        "first_name": "Sam",
        "last_name": "Rivera",
        "email": "Sam.Rivera@Example.com",
        "password": "Clapperboard#42",
        "phone": "813-555-0100",
        "accept_privacy": True,
    }

    def setUp(self):
        cache.clear()  # Reset the sign-up rate limits between tests.

    def signup(self, **changes):
        return self.client.post("/api/auth/signup/", {**self.FORM, **changes}, format="json")

    def verification_link(self):
        match = re.search(r"https://knet\.example\.com/verify-email\?(\S+)", mail.outbox[-1].body)
        return dict(item.split("=", 1) for item in match.group(1).split("&"))

    def test_signup_creates_unverified_staff_and_sends_email(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email="sam.rivera@example.com")
        self.assertEqual(user.role, User.Role.STAFF)
        self.assertFalse(user.email_verified)
        self.assertIsNotNone(user.privacy_accepted_at)
        self.assertEqual(user.phone, "(813) 555-0100")
        self.assertEqual(mail.outbox[0].to, ["sam.rivera@example.com"])
        self.assertIn("support.knet@gmail.com", mail.outbox[0].from_email)

    def test_unverified_user_cannot_log_in(self):
        self.signup()
        response = self.client.post(
            "/api/auth/login/", {"email": "sam.rivera@example.com", "password": self.FORM["password"]}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "email_unverified")

    def test_verification_link_signs_in_once(self):
        self.signup()
        link = self.verification_link()
        response = self.client.post("/api/auth/verify-email/", link, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["email"], "sam.rivera@example.com")
        self.assertEqual(self.client.get("/api/auth/me/").data["role"], "staff")
        self.assertTrue(User.objects.get(email="sam.rivera@example.com").email_verified)
        # The link can't be used again.
        self.client.logout()
        self.assertEqual(self.client.post("/api/auth/verify-email/", link, format="json").status_code, 400)

    def test_bad_verification_token_rejected(self):
        self.signup()
        link = self.verification_link() | {"token": "nope"}
        self.assertEqual(self.client.post("/api/auth/verify-email/", link, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/auth/verify-email/", {}, format="json").status_code, 400)

    def test_all_fields_and_privacy_required(self):
        for field in ["first_name", "last_name", "email", "password", "phone"]:
            response = self.signup(**{field: ""})
            self.assertEqual(response.status_code, 400, field)
            self.assertIn(field, response.data)
        response = self.signup(accept_privacy=False)
        self.assertIn("accept_privacy", response.data)
        self.assertFalse(User.objects.exists())

    def test_password_rules(self):
        for password in ["Short#1", "nocapital#123", "NoNumber#here", "NoSpecial123x"]:
            response = self.signup(password=password)
            self.assertEqual(response.status_code, 400, password)
            self.assertIn("password", response.data)

    def test_existing_account_email_rejected(self):
        make_user("sam.rivera@example.com", User.Role.STAFF)
        response = self.signup()
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_signing_up_again_before_verifying_resends(self):
        self.signup()
        response = self.signup(first_name="Samantha")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get().first_name, "Samantha")
        self.assertEqual(len(mail.outbox), 2)

    def test_honeypot_creates_nothing(self):
        response = self.signup(website="http://spam.example")
        self.assertEqual(response.status_code, 201)
        self.assertFalse(User.objects.exists())
        self.assertEqual(mail.outbox, [])

    def test_resend_verification(self):
        self.signup()
        response = self.client.post("/api/auth/resend-verification/", {"email": "SAM.RIVERA@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        # Unknown and already-verified addresses get the same answer and no email.
        make_user("verified@test.com", User.Role.STAFF)
        for email in ["nobody@test.com", "verified@test.com"]:
            self.assertEqual(self.client.post("/api/auth/resend-verification/", {"email": email}).status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

    def test_signup_is_rate_limited(self):
        for i in range(10):
            self.signup(email=f"person{i}@example.com")
        self.assertEqual(self.signup(email="one-more@example.com").status_code, 429)


class RemovalRequestTests(APITestCase):
    def setUp(self):
        self.manager = make_user("sm@test.com", User.Role.SITE_MANAGER)
        self.director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.staff = make_user("staff@test.com", User.Role.STAFF)

    def request_removal(self, viewer, person, reason="Left the production."):
        self.client.force_authenticate(viewer)
        return self.client.post(f"/api/users/{person.pk}/request-removal/", {"reason": reason})

    def test_director_requests_and_site_managers_are_emailed(self):
        from django.core import mail

        response = self.request_removal(self.director, self.staff)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["sm@test.com"])
        self.assertIn("Left the production.", mail.outbox[0].body)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.is_active)  # Nothing is deleted until a Site Manager acts.
        # Asking again doesn't duplicate the request or the email.
        self.assertEqual(self.request_removal(self.director, self.staff).status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_cannot_request_removal_above_own_level_or_as_staff(self):
        self.assertEqual(self.request_removal(self.director, self.manager).status_code, 403)
        self.assertEqual(self.request_removal(self.staff, self.director).status_code, 403)

    def test_site_manager_approves_or_dismisses(self):
        removal = self.request_removal(self.director, self.staff).data
        self.client.force_authenticate(self.director)
        self.assertEqual(self.client.get("/api/removal-requests/").status_code, 403)
        self.client.force_authenticate(self.manager)
        self.assertEqual([r["person_name"] for r in self.client.get("/api/removal-requests/").data], ["Test staff"])
        self.client.post(f"/api/removal-requests/{removal['id']}/approve/")
        self.staff.refresh_from_db()
        self.assertFalse(self.staff.is_active)
        self.assertEqual(self.client.get("/api/removal-requests/").data, [])

        other = make_user("other@test.com", User.Role.STAFF)
        removal = self.request_removal(self.director, other).data
        self.client.force_authenticate(self.manager)
        self.client.post(f"/api/removal-requests/{removal['id']}/dismiss/")
        other.refresh_from_db()
        self.assertTrue(other.is_active)
        self.assertEqual(self.client.get("/api/removal-requests/").data, [])


@override_settings(SITE_URL="https://knet.example.com")
class EmailChangeTests(APITestCase):
    def setUp(self):
        cache.clear()  # Reset the rate limits between tests.
        self.user = make_user("old@test.com", User.Role.STAFF, slack_user_id="U123")
        self.client.force_authenticate(self.user)

    def request_change(self, email="New@Test.com", password=PASSWORD):
        return self.client.post("/api/auth/me/email/", {"email": email, "password": password}, format="json")

    def confirm(self):
        match = re.search(r"https://knet\.example\.com/confirm-email\?(\S+)", mail.outbox[-1].body)
        params = dict(item.split("=", 1) for item in match.group(1).split("&"))
        self.client.force_authenticate(None)  # The link works from any device.
        return self.client.post("/api/auth/confirm-email/", params, format="json")

    def test_change_waits_for_the_link_then_applies(self):
        response = self.request_change()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["pending_email"], "new@test.com")
        self.assertEqual(mail.outbox[-1].to, ["new@test.com"])
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "old@test.com")  # Nothing changes yet.

        response = self.confirm()
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertEqual((self.user.email, self.user.pending_email, self.user.slack_user_id), ("new@test.com", "", ""))
        self.assertIsNotNone(self.user.email_changed_at)
        self.assertEqual(mail.outbox[-1].to, ["old@test.com"])  # Heads-up to the old address.
        self.assertTrue(self.client.login(email="new@test.com", password=PASSWORD))

    def test_link_works_once(self):
        self.request_change()
        self.assertEqual(self.confirm().status_code, 200)
        mail.outbox.pop()  # The notice to the old address.
        self.assertEqual(self.confirm().status_code, 400)

    def test_asking_for_another_address_cancels_the_first_link(self):
        self.request_change("first@test.com")
        first_mail = mail.outbox[-1]
        self.request_change("second@test.com")
        mail.outbox[-1] = first_mail
        self.assertEqual(self.confirm().status_code, 400)

    def test_needs_the_current_password(self):
        response = self.request_change(password="wrong")
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)
        self.assertEqual(mail.outbox, [])

    def test_email_must_be_free(self):
        make_user("taken@test.com", User.Role.STAFF)
        self.assertEqual(self.request_change("Taken@test.com").status_code, 400)

    def test_once_every_two_weeks(self):
        from datetime import timedelta

        from django.utils import timezone

        self.request_change()
        self.confirm()
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        response = self.request_change("again@test.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("two weeks", str(response.data["email"]))

        User.objects.filter(pk=self.user.pk).update(email_changed_at=timezone.now() - timedelta(days=15))
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        self.assertEqual(self.request_change("again@test.com").status_code, 200)

    def test_cancel_pending_change(self):
        self.request_change()
        response = self.client.delete("/api/auth/me/email/")
        self.assertEqual(response.data["pending_email"], "")
        self.assertEqual(self.confirm().status_code, 400)

    def test_email_is_still_read_only_on_the_profile(self):
        self.client.patch("/api/auth/me/", {"email": "sneaky@test.com"}, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "old@test.com")

    def test_manager_changing_someones_email_isnt_limited(self):
        director = make_user("dir@test.com", User.Role.DIRECTOR)
        self.client.force_authenticate(director)
        response = self.client.patch(f"/api/users/{self.user.pk}/", {"email": "fixed@test.com"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertEqual((self.user.email, self.user.slack_user_id), ("fixed@test.com", ""))
        self.assertIsNone(self.user.email_changed_at)
