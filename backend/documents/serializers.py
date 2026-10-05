from django.core.validators import FileExtensionValidator
from rest_framework import serializers

from .models import ALLOWED_EXTENSIONS, Document

MAX_UPLOAD_MB = 20


class DocumentSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True, default=None)
    file = serializers.FileField(write_only=True, validators=[FileExtensionValidator(ALLOWED_EXTENSIONS)])
    file_name = serializers.CharField(read_only=True)
    file_size = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "category",
            "category_display",
            "file",
            "file_name",
            "file_size",
            "notes",
            "expires_on",
            "vendor",
            "amount",
            "purchase_date",
            "status",
            "status_display",
            "status_changed_at",
            "uploaded_by_name",
            "is_mine",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status_changed_at"]
        extra_kwargs = {"title": {"error_messages": {"blank": "Give this document a name."}}}

    def get_file_size(self, document):
        try:
            return document.file.size
        except (OSError, ValueError):
            return None

    def get_is_mine(self, document):
        request = self.context.get("request")
        return bool(request and document.uploaded_by_id == request.user.pk)

    def validate_file(self, file):
        if file.size > MAX_UPLOAD_MB * 1024 * 1024:
            raise serializers.ValidationError(f"Files can be up to {MAX_UPLOAD_MB} MB.")
        return file

    def validate(self, attrs):
        request = self.context["request"]
        if not request.user.is_manager_level:
            # Everyone else can only file receipts, and can't move them along.
            attrs["category"] = Document.Category.RECEIPT
            attrs.pop("status", None)

        category = attrs.get("category", getattr(self.instance, "category", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        if category == Document.Category.RECEIPT and amount is None:
            raise serializers.ValidationError({"amount": "Enter the receipt total."})
        if amount is not None and amount < 0:
            raise serializers.ValidationError({"amount": "The amount can't be negative."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("status", None)  # New receipts always start as Submitted.
        return super().create(validated_data)

    def update(self, instance, validated_data):
        status = validated_data.pop("status", None)
        if status:
            instance.set_status(status)
        old_file = instance.file if "file" in validated_data else None
        instance = super().update(instance, validated_data)
        if old_file and old_file.name != instance.file.name:
            old_file.storage.delete(old_file.name)
        return instance
