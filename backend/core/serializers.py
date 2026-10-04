from django.utils import timezone
from rest_framework import serializers

from .models import ProductionSettings


class ProductionSettingsSerializer(serializers.ModelSerializer):
    today = serializers.SerializerMethodField()

    class Meta:
        model = ProductionSettings
        fields = ["name", "location_name", "latitude", "longitude", "time_zone", "units", "today"]
        # Location fields are set together through the location lookup endpoint.
        read_only_fields = ["location_name", "latitude", "longitude", "time_zone"]

    def get_today(self, production):
        """Today's date where the production is."""
        return timezone.localdate(timezone=production.zone)


class LocationQuerySerializer(serializers.Serializer):
    query = serializers.CharField(max_length=200)
