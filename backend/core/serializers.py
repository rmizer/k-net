from rest_framework import serializers

from .models import ProductionSettings


class ProductionSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionSettings
        fields = ["name", "location_name", "latitude", "longitude", "time_zone", "units"]
        # Location fields are set together through the location lookup endpoint.
        read_only_fields = ["location_name", "latitude", "longitude", "time_zone"]


class LocationQuerySerializer(serializers.Serializer):
    query = serializers.CharField(max_length=200)
