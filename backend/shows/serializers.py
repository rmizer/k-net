from rest_framework import serializers

from accounts.models import User

from .models import Show


class ShowPersonSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="get_full_name")
    head_of_department_name = serializers.CharField(source="head_of_department.name", default=None)

    class Meta:
        model = User
        fields = ["id", "name", "head_of_department_name"]


class ShowSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    director = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True, role=User.Role.DIRECTOR), allow_null=True, required=False
    )
    director_name = serializers.CharField(source="director.get_full_name", read_only=True, default=None)
    other_directors = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True, role=User.Role.DIRECTOR), many=True, required=False
    )
    department_heads = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True, is_department_head=True), many=True, required=False
    )
    other_director_details = ShowPersonSerializer(source="other_directors", many=True, read_only=True)
    department_head_details = ShowPersonSerializer(source="department_heads", many=True, read_only=True)
    influencer_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Show
        fields = [
            "id",
            "name",
            "description",
            "start_date",
            "shooting_location",
            "status",
            "status_display",
            "seasons",
            "weeks_per_season",
            "director",
            "director_name",
            "other_directors",
            "other_director_details",
            "department_heads",
            "department_head_details",
            "influencer_count",
            "updated_at",
        ]
        extra_kwargs = {
            "name": {"error_messages": {"blank": "Enter the show name."}},
            "description": {"error_messages": {"blank": "Enter a description."}},
            "seasons": {"error_messages": {"invalid": "Enter a whole number."}},
            "weeks_per_season": {"error_messages": {"invalid": "Enter a whole number."}},
        }

    def validate_name(self, name):
        name = name.strip()
        existing = Show.objects.filter(name__iexact=name)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("A show with this name already exists.")
        return name

    def validate(self, attrs):
        # The director who creates a show leads it unless they pick someone else.
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if self.instance is None and "director" not in attrs and user and user.role == User.Role.DIRECTOR:
            attrs["director"] = user
        # The lead director isn't also listed among the other directors.
        director = attrs.get("director", getattr(self.instance, "director", None))
        if "other_directors" in attrs and director:
            attrs["other_directors"] = [d for d in attrs["other_directors"] if d.pk != director.pk]
        return attrs

    def save(self, **kwargs):
        show = super().save(**kwargs)
        if show.director_id:
            show.other_directors.remove(show.director_id)
        return show
