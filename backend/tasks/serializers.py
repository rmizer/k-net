from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True, default=None)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "assigned_to",
            "assigned_to_name",
            "department",
            "department_name",
            "due_date",
            "priority",
            "status",
            "is_overdue",
            "created_at",
            "completed_at",
        ]
        read_only_fields = ["completed_at"]
