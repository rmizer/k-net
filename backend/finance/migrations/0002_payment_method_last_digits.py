import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    """last4 becomes last_digits: four digits, or five for American Express."""

    dependencies = [
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(model_name="paymentmethod", old_name="last4", new_name="last_digits"),
        migrations.AlterField(
            model_name="paymentmethod",
            name="last_digits",
            field=models.CharField(
                blank=True,
                max_length=5,
                validators=[
                    django.core.validators.RegexValidator(
                        "^\d{4,5}$", "Enter the last four digits (five for American Express)."
                    )
                ],
                verbose_name="last digits",
            ),
        ),
    ]
