from rest_framework import serializers

from documents.models import Document

from .models import Vehicle

RENTAL_FIELDS = ["rented_from", "rental_reference", "rented_on", "return_by", "return_to"]


class VehicleDocumentSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "category",
            "category_display",
            "vendor",
            "amount",
            "purchase_date",
            "file_name",
            "uploaded_by_name",
            "created_at",
        ]


class VehicleSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    ownership_display = serializers.CharField(source="get_ownership_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    driver_name = serializers.CharField(source="driver.get_full_name", read_only=True, default=None)
    documents = serializers.PrimaryKeyRelatedField(many=True, queryset=Document.objects.all(), required=False)
    document_details = VehicleDocumentSerializer(source="documents", many=True, read_only=True)
    receipt_total = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "name",
            "kind",
            "kind_display",
            "description",
            "make_model",
            "year",
            "color",
            "vin",
            "license_plate",
            "plate_state",
            "ownership",
            "ownership_display",
            *RENTAL_FIELDS,
            "storage_location",
            "keys_location",
            "driver",
            "driver_name",
            "status",
            "status_display",
            "documents",
            "document_details",
            "receipt_total",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "name": {"error_messages": {"blank": "Name the vehicle, e.g. Party bus."}},
            "description": {"error_messages": {"blank": "Describe the vehicle."}},
            "license_plate": {"error_messages": {"blank": "Enter the license plate."}},
            "storage_location": {"error_messages": {"blank": "Where is it parked when it isn't in use?"}},
            "year": {
                "error_messages": {
                    "min_value": "Enter a four-digit year.",
                    "max_value": "Enter a four-digit year.",
                    "invalid": "Enter a four-digit year.",
                }
            },
        }

    def to_representation(self, vehicle):
        data = super().to_representation(vehicle)
        # Files open through the vehicle, so whoever can see it can open them.
        for document in data["document_details"]:
            document["url"] = f"/api/vehicles/{vehicle.pk}/documents/{document['id']}/file/"
        return data

    def validate_documents(self, documents):
        user = self.context["request"].user
        if user.is_manager_level:
            return documents
        already = set(self.instance.documents.values_list("pk", flat=True)) if self.instance else set()
        if any(doc.pk not in already and doc.uploaded_by_id != user.pk for doc in documents):
            raise serializers.ValidationError("You can only link receipts and documents you uploaded.")
        return documents

    def get_receipt_total(self, vehicle):
        """What the receipts linked to this vehicle add up to, as a string like "123.45"."""
        total = sum(
            (doc.amount for doc in vehicle.documents.all() if doc.category == Document.Category.RECEIPT and doc.amount),
            start=0,
        )
        return f"{total:.2f}"

    def validate_vin(self, value):
        vin = "".join(value.split()).upper()
        if not vin:
            return ""
        if len(vin) != 17 or not vin.isalnum():
            raise serializers.ValidationError("A VIN is 17 letters and numbers.")
        if set(vin) & {"I", "O", "Q"}:
            raise serializers.ValidationError("VINs never use I, O or Q. Check for a 1 or 0.")
        return vin

    def validate_license_plate(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        ownership = attrs.get("ownership", getattr(self.instance, "ownership", Vehicle.Ownership.RENTED))
        if ownership == Vehicle.Ownership.OWNED:
            # Rental details don't apply to a vehicle the company owns.
            for field in RENTAL_FIELDS:
                attrs[field] = None if field in ("rented_on", "return_by") else ""
        rented_on = attrs.get("rented_on", getattr(self.instance, "rented_on", None))
        return_by = attrs.get("return_by", getattr(self.instance, "return_by", None))
        if rented_on and return_by and return_by.date() < rented_on:
            raise serializers.ValidationError({"return_by": "It can't be due back before it was picked up."})
        return attrs
