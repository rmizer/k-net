from rest_framework.test import APITestCase

from accounts.models import Department, User
from tasks.models import Task


def make_user(email, role=User.Role.STAFF, **fields):
    return User.objects.create_user(email=email, first_name=email.split("@")[0], role=role, **fields)


class DepartmentPageTests(APITestCase):
    """The Culinary example: Coach K (Director), Gloria (Assistant), Josh (head
    of Culinary), his sous chef, and a Tech head who can look but not change."""

    def setUp(self):
        self.culinary = Department.objects.create(name="Culinary", page=Department.Page.CULINARY)
        self.tech = Department.objects.create(name="Tech", page=Department.Page.TECH)
        self.film = Department.objects.create(name="Film Crew", page=Department.Page.FILM_AUDIO)
        self.audio = Department.objects.create(name="Audio", page=Department.Page.FILM_AUDIO)
        self.director = make_user("coachk@test.com", User.Role.DIRECTOR)
        self.assistant = make_user("gloria@test.com", User.Role.ASSISTANT)
        self.josh = make_user(
            "josh@test.com", department=self.culinary, is_department_head=True, head_of_department=self.culinary
        )
        self.sous = make_user("karter@test.com", department=self.culinary)
        self.shopper = make_user("shopper@test.com", department=self.culinary)
        self.lisa = make_user(
            "lisa@test.com", department=self.tech, is_department_head=True, head_of_department=self.tech
        )
        self.techie = make_user("techie@test.com", department=self.tech)
        self.camera = make_user("camera@test.com", department=self.film)
        self.audio_tech = make_user("audio@test.com", department=self.audio)

    def pages(self, user):
        self.client.force_authenticate(user)
        return [page["slug"] for page in self.client.get("/api/department-pages/").data]

    def test_who_sees_which_pages(self):
        self.assertEqual(len(self.pages(self.director)), 9)
        self.assertEqual(len(self.pages(self.assistant)), 9)
        self.assertEqual(len(self.pages(self.lisa)), 8)  # heads see every page but Finance
        self.assertNotIn("finance", self.pages(self.lisa))
        self.assertEqual(self.pages(self.techie), ["tech"])
        self.assertEqual(self.pages(self.sous), ["culinary"])
        self.assertEqual(self.pages(self.camera), ["film-audio"])
        self.assertEqual(self.pages(self.audio_tech), ["film-audio"])

        self.client.force_authenticate(self.techie)
        self.assertEqual(self.client.get("/api/department-pages/culinary/").status_code, 403)
        self.assertEqual(self.client.get("/api/department-pages/nope/").status_code, 404)

    def test_finance_is_only_for_finance_and_managers(self):
        finance = Department.objects.get(page=Department.Page.FINANCE)  # made by a migration
        head = make_user("cfo@test.com", department=finance, is_department_head=True, head_of_department=finance)
        bookkeeper = make_user("books@test.com", department=finance)
        self.assertEqual(len(self.pages(head)), 9)
        self.assertEqual(self.pages(bookkeeper), ["finance"])
        for user, allowed in [(self.director, True), (bookkeeper, True), (head, True), (self.lisa, False), (self.techie, False)]:
            self.client.force_authenticate(user)
            status = self.client.get("/api/finance/overview/").status_code
            self.assertEqual(status == 200, allowed, user.email)
            self.assertEqual(self.client.get("/api/department-pages/finance/").status_code == 200, allowed, user.email)

    def test_heads_edit_only_their_own_page(self):
        self.client.force_authenticate(self.lisa)
        self.assertTrue(self.client.get("/api/department-pages/tech/").data["can_edit"])
        self.assertFalse(self.client.get("/api/department-pages/culinary/").data["can_edit"])

    def test_head_tasks_are_private_to_the_head(self):
        Task.objects.create(title="Order knives", assigned_to=self.josh, department=self.culinary)
        Task.objects.create(title="Prep chili", assigned_to=self.sous, department=self.culinary)
        Task.objects.create(title="Deep clean", department=self.culinary)

        self.client.force_authenticate(self.sous)
        page = self.client.get("/api/department-pages/culinary/").data
        self.assertIsNone(page["head_tasks"])
        self.assertEqual({task["title"] for task in page["staff_tasks"]}, {"Prep chili", "Deep clean"})
        self.assertEqual([head["name"] for head in page["heads"]], ["josh"])

        self.client.force_authenticate(self.josh)
        page = self.client.get("/api/department-pages/culinary/").data
        self.assertEqual([task["title"] for task in page["head_tasks"]], ["Order knives"])

        self.client.force_authenticate(self.director)
        page = self.client.get("/api/department-pages/culinary/").data
        self.assertEqual([task["title"] for task in page["head_tasks"]], ["Order knives"])

        # Another department's head can look at the page, but not at Josh's tasks.
        self.client.force_authenticate(self.lisa)
        self.assertIsNone(self.client.get("/api/department-pages/culinary/").data["head_tasks"])

    def test_heads_assign_tasks_in_their_department_only(self):
        self.client.force_authenticate(self.josh)
        response = self.client.post("/api/tasks/", {"title": "Buy onions", "assigned_to": self.shopper.pk})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["department"], self.culinary.pk)  # filled in from the person
        task = response.data["id"]

        response = self.client.patch(f"/api/tasks/{task}/", {"assigned_to": self.sous.pk, "title": "Buy shallots"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.delete(f"/api/tasks/{task}/").status_code, 204)

        response = self.client.post("/api/tasks/", {"title": "Rack cables", "assigned_to": self.techie.pk})
        self.assertEqual(response.status_code, 403)
        response = self.client.post("/api/tasks/", {"title": "Rack cables", "department": self.tech.pk})
        self.assertEqual(response.status_code, 403)

        # Staff still can't add tasks.
        self.client.force_authenticate(self.sous)
        self.assertEqual(self.client.post("/api/tasks/", {"title": "Nap"}).status_code, 403)

    def test_head_can_only_update_status_of_tasks_given_to_them(self):
        task = Task.objects.create(
            title="Budget", assigned_to=self.josh, department=self.culinary, created_by=self.director
        )
        self.client.force_authenticate(self.josh)
        self.assertEqual(self.client.patch(f"/api/tasks/{task.pk}/", {"status": "done"}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/tasks/{task.pk}/", {"title": "No budget"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/tasks/{task.pk}/").status_code, 403)

    def test_shared_page_head_manages_both_departments(self):
        head = make_user("dp@test.com", department=self.film, is_department_head=True, head_of_department=self.film)
        self.client.force_authenticate(head)
        response = self.client.post("/api/tasks/", {"title": "Check levels", "assigned_to": self.audio_tech.pk})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["department"], self.audio.pk)
