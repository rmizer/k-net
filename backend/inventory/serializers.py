from rest_framework import serializers

from documents.models import Document

from .models import InventoryItem


class ReceiptSummarySerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ["id", "title", "vendor", "amount", "purchase_date", "file_name", "url"]

    def get_url(self, document):
        return f"/api/documents/{document.pk}/file/"


class InventoryItemSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    item_type_display = serializers.CharField(source="get_item_type_display", read_only=True)
    quantity_unit_display = serializers.CharField(source="get_quantity_unit_display", read_only=True)
    size_unit_display = serializers.CharField(source="get_size_unit_display", read_only=True)
    receipt_details = ReceiptSummarySerializer(source="receipt", read_only=True)
    in_stock = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)
    deleted_by_name = serializers.CharField(source="deleted_by.get_full_name", read_only=True, default=None)
    receipt = serializers.PrimaryKeyRelatedField(
        queryset=Document.objects.filter(category=Document.Category.RECEIPT),
        allow_null=True,
        required=False,
        error_messages={"does_not_exist": "Pick a receipt from Documents."},
    )

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "name",
            "department",
            "department_name",
            "item_type",
            "item_type_display",
            "purchased_on",
            "expires_on",
            "receipt",
            "receipt_details",
            "quantity",
            "quantity_unit",
            "quantity_unit_display",
            "piece_count",
            "piece_label",
            "size",
            "size_unit",
            "size_unit_display",
            "storage_location",
            "details",
            "brand",
            "model_number",
            "serial_numbers",
            "asset_tag",
            "warranty_expires",
            "in_stock",
            "created_by_name",
            "created_at",
            "updated_at",
            "deleted_at",
            "deleted_by_name",
        ]
        read_only_fields = ["deleted_at"]
        extra_kwargs = {
            "name": {"error_messages": {"blank": "Name the item."}},
            "storage_location": {"error_messages": {"blank": "Where is it stored?"}},
            "quantity": {
                "error_messages": {"min_value": "The quantity can't be below 0.", "invalid": "Enter a number."}
            },
            "size": {"error_messages": {"min_value": "The size can't be below 0.", "invalid": "Enter a number."}},
        }

    def get_department_name(self, item):
        return item.department.name if item.department else "Other"

    def get_in_stock(self, item):
        return item.quantity > 0

    def validate_serial_numbers(self, value):
        # One per line, without blank lines or stray spaces.
        return "\n".join(line.strip() for line in value.splitlines() if line.strip())

    def validate(self, attrs):
        piece_count = attrs.get("piece_count", getattr(self.instance, "piece_count", None))
        if piece_count is None and "piece_label" in attrs:
            # A label means nothing without a count.
            attrs["piece_label"] = ""
        size = attrs.get("size", getattr(self.instance, "size", None))
        size_unit = attrs.get("size_unit", getattr(self.instance, "size_unit", ""))
        if size is not None and not size_unit:
            raise serializers.ValidationError({"size_unit": "Pick a unit for the size."})
        if size is None and size_unit:
            attrs["size_unit"] = ""
        return attrs
