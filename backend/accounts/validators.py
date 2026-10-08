import re

from django.core.exceptions import ValidationError

PASSWORD_HELP = "At least 10 characters, with a capital letter, a number and a special character."


class PasswordComplexityValidator:
    """Passwords need a capital letter, a number and a special character
    (length is checked by MinimumLengthValidator)."""

    RULES = [
        (r"[A-Z]", "a capital letter"),
        (r"[0-9]", "a number"),
        (r"[^A-Za-z0-9]", "a special character such as ! or #"),
    ]

    def validate(self, password, user=None):
        missing = [label for pattern, label in self.RULES if not re.search(pattern, password)]
        if missing:
            if len(missing) > 1:
                missing = [", ".join(missing[:-1]) + " and " + missing[-1]]
            raise ValidationError(f"Your password needs {missing[0]}.", code="password_too_simple")

    def get_help_text(self):
        return PASSWORD_HELP
