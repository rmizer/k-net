from django.db import transaction
from rest_framework import serializers

from .models import Challenge, Check, SupplyItem


class SupplyItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = SupplyItem
        fields = ["id", "name", "quantity", "category", "category_display", "note", "checked"]
        extra_kwargs = {"name": {"error_messages": {"blank": "Name the item."}}}


class ChallengeSerializer(serializers.ModelSerializer):
    """A challenge with its supply list, written in one go: items sent with an id
    are updated, without one added, and any left out removed."""

    supplies = SupplyItemSerializer(many=True, required=False)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    participant_names = serializers.SerializerMethodField()
    show_name = serializers.CharField(source="show.name", read_only=True, default=None)
    location_display = serializers.CharField(source="get_location_display", read_only=True)
    cleanup_owner_name = serializers.CharField(source="cleanup_owner.get_full_name", read_only=True, default=None)
    safety_to_do = serializers.ListField(read_only=True)
    content_warnings = serializers.ListField(
        child=serializers.ChoiceField(choices=list(Challenge.CONTENT_WARNINGS.items())), required=False
    )
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Challenge
        fields = [
            "id",
            "name",
            "date",
            "show",
            "show_name",
            "week",
            "description",
            "participants",
            "participant_names",
            "rewards",
            "location",
            "location_display",
            "location_details",
            "cleanup_plan",
            "cleanup_owner",
            "cleanup_owner_name",
            "waivers",
            "allergy_check",
            "medic",
            "safety_to_do",
            "content_warnings",
            "other_content_warnings",
            "status",
            "status_display",
            "supplies",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "name": {"error_messages": {"blank": "Give the challenge a name."}},
            "description": {"error_messages": {"blank": "Describe the challenge."}},
            "week": {"error_messages": {"min_value": "Weeks start at 1.", "invalid": "Enter a week number."}},
            "date": {"error_messages": {"null": "Pick the challenge date.", "invalid": "Pick the challenge date."}},
        }

    def validate_content_warnings(self, warnings):
        # Kept in display order, without repeats.
        return [key for key in Challenge.CONTENT_WARNINGS if key in warnings]

    def validate(self, attrs):
        status = attrs.get("status", self.instance.status if self.instance else Challenge.Status.PLANNING)
        if status != Challenge.Status.PLANNING:
            missing = {
                field: f"{label}: mark it Done or Not needed before the challenge is {status}."
                for field, label in Challenge.SAFETY_CHECKS.items()
                if attrs.get(field, getattr(self.instance, field, Check.TODO)) == Check.TODO
            }
            if missing:
                raise serializers.ValidationError(missing)
        return attrs

    def get_participant_names(self, challenge):
        return sorted(influencer.name for influencer in challenge.participants.all())

    @transaction.atomic
    def create(self, validated_data):
        supplies = validated_data.pop("supplies", [])
        challenge = super().create(validated_data)
        self._save_supplies(challenge, supplies)
        return challenge

    @transaction.atomic
    def update(self, instance, validated_data):
        supplies = validated_data.pop("supplies", None)
        instance = super().update(instance, validated_data)
        if supplies is not None:
            self._save_supplies(instance, supplies)
        return instance

    def _save_supplies(self, challenge, rows):
        existing = {item.pk: item for item in challenge.supplies.all()}
        kept = set()
        for position, row in enumerate(rows):
            row = {**row, "position": position}
            item = existing.get(row.pop("id", None))
            if item is None:
                item = SupplyItem.objects.create(challenge=challenge, **row)
            else:
                for field, value in row.items():
                    setattr(item, field, value)
                item.save()
            kept.add(item.pk)
        challenge.supplies.exclude(pk__in=kept).delete()


class SupplyCheckSerializer(serializers.ModelSerializer):
    """Checking a supply off (or back on) without saving the whole challenge."""

    class Meta:
        model = SupplyItem
        fields = ["id", "checked"]
