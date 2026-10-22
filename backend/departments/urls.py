from django.urls import path

from . import views

urlpatterns = [
    path("department-pages/", views.page_list, name="department-pages"),
    path("department-pages/<slug:slug>/", views.page_detail, name="department-page"),
]
