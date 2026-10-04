from rest_framework import serializers

from .models import Resource


class ResourceSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = Resource
        fields = [
            "id",
            "company_name",
            "category",
            "category_display",
            "contact_name",
            "phone",
            "email",
            "website",
            "address",
            "notes",
            "updated_at",
        ]
        extra_kwargs = {
            "company_name": {"error_messages": {"blank": "Enter the company name."}},
            "phone": {"error_messages": {"blank": "Enter a phone number."}},
        }
