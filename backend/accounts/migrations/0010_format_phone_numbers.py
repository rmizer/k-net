from django.db import migrations


def format_phones(apps, schema_editor):
    """Saved numbers like 1234567890 become (123) 456-7890, as new ones are."""
    from accounts.models import format_phone

    User = apps.get_model("accounts", "User")
    for user in User.objects.exclude(phone="", emergency_contact_phone=""):
        phone, emergency = format_phone(user.phone), format_phone(user.emergency_contact_phone)
        if (phone, emergency) != (user.phone, user.emergency_contact_phone):
            User.objects.filter(pk=user.pk).update(phone=phone, emergency_contact_phone=emergency)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0009_user_title")]

    operations = [migrations.RunPython(format_phones, migrations.RunPython.noop)]
