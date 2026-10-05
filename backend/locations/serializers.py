from rest_framework import serializers

from . import geocoding
from .models import Location


class LocationSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(read_only=True)

    class Meta:
        model = Location
        fields = [
            "id",
            "name",
            "kind",
            "custom_type",
            "type_label",
            "address",
            "latitude",
            "longitude",
            "phone",
            "website",
            "contact_name",
            "notes",
            "updated_at",
        ]
        extra_kwargs = {"name": {"error_messages": {"blank": "Give this location a name."}}}

    def validate(self, attrs):
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError({"longitude": "Enter both latitude and longitude, or neither."})
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({"latitude": "Latitude must be between -90 and 90."})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({"longitude": "Longitude must be between -180 and 180."})
        if attrs.get("kind", getattr(self.instance, "kind", None)) != Location.Kind.OTHER:
            attrs["custom_type"] = ""

        # Look the address up when it's new or changed and no coordinates were given.
        address = attrs.get("address", getattr(self.instance, "address", ""))
        address_changed = "address" in attrs and attrs["address"] != getattr(self.instance, "address", None)
        coordinates_given = "latitude" in attrs or "longitude" in attrs
        if address and address_changed and not coordinates_given:
            point = geocoding.geocode(address)
            attrs["latitude"], attrs["longitude"] = point if point else (None, None)
        return attrs
