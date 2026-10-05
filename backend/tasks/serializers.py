from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True, default=None)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)
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
            "created_by_name",
            "created_at",
            "completed_at",
        ]
        read_only_fields = ["completed_at"]
        extra_kwargs = {"title": {"error_messages": {"blank": "Give the task a title."}}}

    def validate(self, attrs):
        assignee = attrs.get("assigned_to", getattr(self.instance, "assigned_to", None))
        department = attrs.get("department", getattr(self.instance, "department", None))
        if assignee is None and department is None:
            raise serializers.ValidationError({"assigned_to": "Assign the task to a person, a department, or both."})
        return attrs
